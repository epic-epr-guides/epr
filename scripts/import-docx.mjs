#!/usr/bin/env node
/**
 * Converts a Word document into a guide under `content/`.
 *
 * Run on the ADMIN'S OWN MACHINE only:
 *
 *   npm run import:docx -- "path/to/guide.docx" --into 03-my-category
 *
 * Options
 *   --into <folder>   Category folder inside content/ (created if missing).
 *   --as <file.md>    Output file name. Defaults to a slug of the document title.
 *   --names a,b,c     File names for the images, in the order they first appear.
 *   --dry-run         Print what would be written without writing anything.
 *
 * What it does NOT do: rewrite, summarise or tidy the author's words. Text is
 * carried across verbatim, including typos. The only structural change is
 * promoting the document's own bold, larger-than-body paragraphs to Markdown
 * headings — the text of those lines is matched, never retyped.
 *
 * Known limits, reported per run rather than hidden:
 *   - Text boxes are converted as ordinary paragraphs; the arrow shapes that
 *     point them at part of a screenshot cannot be represented in Markdown, so
 *     labels like "click here" lose their target.
 *   - SmartArt, WordArt and embedded objects are dropped.
 *   - Word's auto-generated "A screenshot of a computer" alt text is discarded
 *     rather than published as if it were real alt text.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename, join, resolve } from 'node:path'
import mammoth from 'mammoth'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

const CONTENT_DIR = resolve(process.cwd(), 'content')

// --- arguments -------------------------------------------------------------

const argv = process.argv.slice(2)
const positional = argv.filter((a) => !a.startsWith('--'))
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}
const source = positional[0]
const into = flag('into')
const asName = flag('as')
const names = (flag('names') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const dryRun = argv.includes('--dry-run')

if (!source || !into) {
  console.error('Usage: npm run import:docx -- "file.docx" --into <category-folder> [--as name.md] [--names a,b,c]')
  process.exitCode = 1
  process.exit()
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[’'"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// --- heading detection -----------------------------------------------------

/**
 * Finds paragraphs the author formatted as headings by hand — bold and larger
 * than body text — and returns their exact text keyed to a heading level.
 *
 * Word stores sizes in half-points, so `w:sz` 28 is 14pt and 32 is 16pt. Text
 * inside text boxes is skipped: nested `w:p` elements there would otherwise
 * confuse a flat scan, and callout labels are not headings.
 */
async function detectHeadings(docxPath) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await readFile(docxPath))
  const entry = zip.file('word/document.xml')
  if (!entry) return new Map()
  let xml = await entry.async('string')

  // Remove drawing/text-box content so only body paragraphs remain.
  xml = xml.replace(/<w:txbxContent>[\s\S]*?<\/w:txbxContent>/g, '')
  xml = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, '')

  const headings = new Map()
  for (const match of xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const body = match[1]
    const runs = [...body.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)].map((m) => m[1])
    if (runs.length === 0) continue

    let text = ''
    let bold = false
    let maxHalfPoints = 0
    for (const run of runs) {
      if (/<w:b\s*\/>|<w:b\s/.test(run)) bold = true
      const size = /<w:sz w:val="(\d+)"/.exec(run)
      if (size) maxHalfPoints = Math.max(maxHalfPoints, Number(size[1]))
      text += [...run.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('')
    }

    text = decodeXml(text).trim()
    if (!text || !bold) continue
    if (maxHalfPoints >= 32) headings.set(text, 1)
    else if (maxHalfPoints >= 26) headings.set(text, 2)
  }
  return headings
}

function decodeXml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

// --- conversion ------------------------------------------------------------

const docxPath = resolve(source)
const targetDir = join(CONTENT_DIR, into)
const mediaDir = join(targetDir, 'media')

const headings = await detectHeadings(docxPath)

/** Image buffers keyed by content hash, so a reused picture is written once. */
const seen = new Map()
const written = []

const { value: html, messages } = await mammoth.convertToHtml(
  { path: docxPath },
  {
    convertImage: mammoth.images.imgElement(async (image) => {
      const buffer = await image.read()
      const hash = createHash('sha1').update(buffer).digest('hex')
      if (seen.has(hash)) return { src: seen.get(hash) }

      const extension = (image.contentType ?? 'image/png').split('/')[1].replace('jpeg', 'jpg')
      const name = names[written.length] ?? `screenshot-${String(written.length + 1).padStart(2, '0')}`
      const fileName = `${slug(name)}.${extension}`
      seen.set(hash, `./media/${fileName}`)
      written.push({ fileName, buffer, hash })
      // Word's auto-generated description is not real alt text; drop it.
      return { src: `./media/${fileName}`, alt: '' }
    }),
  },
)

// Promote the author's hand-formatted heading paragraphs. Matched on exact
// text, so no wording is ever retyped or altered.
let structured = html
for (const [text, level] of headings) {
  const escaped = escapeForRegex(escapeHtml(text))
  const pattern = new RegExp(`<p>(?:<strong>)?\\s*${escaped}\\s*(?:</strong>)?</p>`, 'g')
  structured = structured.replace(pattern, `<h${level}>${escapeHtml(text)}</h${level}>`)
}

/**
 * Word anchors a floating image to whichever paragraph it happens to sit near,
 * which is often a list item even though the picture is drawn below the whole
 * list. Left alone that image becomes a bullet, wrecking the list. Lift any
 * image out of a list and re-emit it directly after the list, preserving order.
 */
function liftImagesOutOfLists(source) {
  return source.replace(/<(ul|ol)\b[^>]*>[\s\S]*?<\/\1>/g, (list) => {
    const images = [...list.matchAll(/<img\b[^>]*>/g)].map((m) => m[0])
    if (images.length === 0) return list
    const stripped = list.replace(/<img\b[^>]*>/g, '')
    return `${stripped}${images.map((img) => `<p>${img}</p>`).join('')}`
  })
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escapeForRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
})
turndown.use(gfm)
// Keep an image on its own line so the renderer can treat it as a figure.
turndown.addRule('blockImage', {
  filter: (node) => node.nodeName === 'IMG',
  replacement: (_content, node) => `\n\n![${node.getAttribute('alt') ?? ''}](${node.getAttribute('src')})\n\n`,
})

const markdown = `${turndown
  .turndown(liftImagesOutOfLists(structured))
  .replace(/\n{3,}/g, '\n\n')
  // Turndown pads bullets to a 4-character marker; `- ` is equivalent and reads
  // better when an admin opens the file in Notepad.
  .replace(/^-\s{3}/gm, '- ')
  .trim()}\n`

const h1 = /^#\s+(.+)$/m.exec(markdown)
const fileName = asName ?? `${slug(h1?.[1] ?? basename(docxPath, '.docx'))}.md`

// --- report and write ------------------------------------------------------

console.log(`Source:   ${docxPath}`)
console.log(`Guide:    content/${into}/${fileName}`)
console.log(`Headings: ${[...headings].map(([t, l]) => `h${l} "${t}"`).join(', ') || '(none detected)'}`)
console.log(`Images:   ${written.length} unique (${seen.size} reference${seen.size === 1 ? '' : 's'} deduplicated by content)`)
for (const image of written) console.log(`          media/${image.fileName}  sha1:${image.hash.slice(0, 10)}`)
if (messages.length) {
  console.log('Converter notes:')
  for (const message of messages) console.log(`          ${message.type}: ${message.message}`)
}

if (dryRun) {
  console.log('\n--- dry run, nothing written ---\n')
  console.log(markdown)
} else {
  await mkdir(mediaDir, { recursive: true })
  await writeFile(join(targetDir, fileName), markdown, 'utf8')
  for (const image of written) await writeFile(join(mediaDir, image.fileName), image.buffer)
  console.log('\nWritten. Now run `npm run manifest`, then check the guide in the browser.')
}
