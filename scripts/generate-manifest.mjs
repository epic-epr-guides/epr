#!/usr/bin/env node
/**
 * Regenerates `content/manifest.json` from whatever is in the local `content/`
 * folder.
 *
 * Run on the ADMIN'S OWN MACHINE only:
 *
 *     npm run manifest
 *
 * The web server never runs this and does not need Node installed. It only ever
 * serves the files in `content/` as plain static files.
 *
 * Rules it follows:
 *  - A folder becomes a category; a `.md` file becomes a guide.
 *  - Each entry's `path` is its single file or folder name on disk. Nesting is
 *    expressed with `children`, so a `path` never contains a slash.
 *  - A guide's title comes from its first `# H1`, falling back to its file name.
 *  - Media files (.mp4, .png, …) are skipped — guides link to them directly.
 *  - A folder named `media` is skipped. Any other folder becomes a category even
 *    when it holds no guides yet, so categories can be created up front.
 *  - Two kinds of hand edit in the previous manifest are preserved: a folder's
 *    `title`, and the ORDER of entries within a folder. Reorder the tree in
 *    manifest.json and it sticks; new files are appended to their category.
 *  - Otherwise: folders before guides, each alphabetically by file name.
 *  - Emits `"version": 2`. Version 1 used `name` where this uses `path`; the app
 *    detects an old manifest and says so rather than failing obscurely.
 */

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

const CONTENT_DIR = resolve(process.cwd(), 'content')
const MANIFEST_FILE = join(CONTENT_DIR, 'manifest.json')

/** Extensions that are guides. Everything else is either media or ignored. */
const GUIDE_EXTENSION = '.md'

/** Folder name reserved for a guide's images and video; never a category. */
const MEDIA_FOLDER = 'media'

/** Files and folders the walker never descends into or lists. */
const IGNORED = new Set(['manifest.json', '.ds_store', 'thumbs.db', '.git', 'node_modules'])

function stripSortPrefix(name) {
  return name.replace(/^\d+\s*[-_.]\s*/, '')
}

/** Must stay in step with the ACRONYMS set in src/content.ts. */
const ACRONYMS = new Set(['epic', 'epr', 'nhs', 'mrn', 'sact', 'tci', 'mdt', 'it', 'faq', 'ooh'])

function deriveTitle(name) {
  const base = stripSortPrefix(name.replace(/\.md$/i, ''))
  const words = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!words) return name
  return words
    .split(' ')
    .map((word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.replace(/^\p{Ll}/u, (character) => character.toUpperCase()),
    )
    .join(' ')
}

/** First `# Heading` in a markdown file, ignoring anything inside a code fence. */
async function readH1(filePath) {
  let text
  try {
    text = await readFile(filePath, 'utf8')
  } catch {
    return undefined
  }
  let inFence = false
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.startsWith('```') || line.startsWith('~~~')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const heading = /^#\s+(.+?)\s*#*\s*$/.exec(line)
    if (heading) {
      // Strip the most common inline markdown so the menu shows plain text.
      return heading[1].replace(/[*_`]/g, '').trim() || undefined
    }
  }
  return undefined
}

/**
 * Folder titles from the previous manifest, keyed by path inside `content/`,
 * so a hand-edited category name survives a regeneration.
 */
async function readExisting() {
  /** Hand-edited folder titles, keyed by path inside `content/`. */
  const titles = new Map()
  /** Child order as last written, keyed by parent path ('' for the root). */
  const order = new Map()
  try {
    const previous = JSON.parse(await readFile(MANIFEST_FILE, 'utf8'))
    const walk = (nodes, prefix) => {
      const siblings = []
      for (const node of nodes ?? []) {
        // Tolerate the pre-v2 field name so one stale manifest does not silently
        // discard every hand-edited title and the whole authored order.
        const segment = typeof node?.path === 'string' ? node.path : node?.name
        if (typeof segment !== 'string') continue
        const path = prefix ? `${prefix}/${segment}` : segment
        siblings.push(segment)
        if (node.type === 'folder') {
          if (typeof node.title === 'string' && node.title.trim() !== '') {
            titles.set(path, node.title)
          }
          walk(node.children, path)
        }
      }
      order.set(prefix, siblings)
    }
    walk(previous?.tree, '')
  } catch {
    // No previous manifest, or it is unreadable. Titles and order are derived.
  }
  return { titles, order }
}

/**
 * Reorders one directory's entries to match the order in the previous manifest.
 *
 * Without numeric `01-` prefixes on folder names there is nothing else to
 * control navigation order, and plain alphabetical would bury "Getting Started"
 * behind whatever happens to sort first. So the authored order in
 * `manifest.json` is treated the same way as a hand-edited title: reorder the
 * entries there and the next run keeps it. Anything new is appended, so a
 * freshly added guide is easy to spot at the bottom of its category.
 */
function applyPreviousOrder(nodes, previousOrder) {
  if (!previousOrder || previousOrder.length === 0) return nodes
  const rank = new Map(previousOrder.map((segment, index) => [segment, index]))
  return nodes
    .map((node, index) => ({ node, index, rank: rank.get(node.path) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.node)
}

/** Recursively builds the tree for one directory. Returns a list of nodes. */
async function walk(directory, prefix, existing, warnings) {
  const entries = await readdir(directory, { withFileTypes: true })

  const folders = []
  const guides = []

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (IGNORED.has(entry.name.toLowerCase())) continue
    if (entry.name.startsWith('.')) continue

    const entryPath = join(directory, entry.name)
    const contentPath = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      // `media/` holds the images and video for the guides beside it, not
      // guides, so it is never a category. Every other folder is kept even when
      // it holds no guides yet, so a category can be created up front and shows
      // as "No guides in this folder yet" until the first guide lands in it.
      if (entry.name.toLowerCase() === MEDIA_FOLDER) continue
      const children = await walk(entryPath, contentPath, existing, warnings)
      folders.push({
        type: 'folder',
        path: entry.name,
        title: existing.titles.get(contentPath) ?? deriveTitle(entry.name),
        children,
      })
      continue
    }

    if (!entry.isFile()) continue
    if (!entry.name.toLowerCase().endsWith(GUIDE_EXTENSION)) continue

    if (/[A-Z\s]/.test(entry.name)) {
      warnings.push(
        `${contentPath} — file names become part of the web address; use lowercase and hyphens.`,
      )
    }

    guides.push({
      type: 'guide',
      path: entry.name,
      title: (await readH1(entryPath)) ?? deriveTitle(entry.name),
    })
  }

  // Folders before files by default, then overlaid with any order the previous
  // manifest authored.
  return applyPreviousOrder([...folders, ...guides], existing.order.get(prefix))
}

function countGuides(nodes) {
  return nodes.reduce(
    (total, node) => total + (node.type === 'guide' ? 1 : countGuides(node.children)),
    0,
  )
}

async function main() {
  try {
    await readdir(CONTENT_DIR)
  } catch {
    console.error(`No content folder found at ${CONTENT_DIR}`)
    console.error('Run this from the project root, where the content folder lives.')
    process.exitCode = 1
    return
  }

  const warnings = []
  const existing = await readExisting()
  const tree = await walk(CONTENT_DIR, '', existing, warnings)

  await writeFile(MANIFEST_FILE, `${JSON.stringify({ version: 2, tree }, null, 2)}\n`, 'utf8')

  const total = countGuides(tree)
  console.log(`Wrote ${relative(process.cwd(), MANIFEST_FILE)}`)
  console.log(`${total} guide${total === 1 ? '' : 's'} in ${tree.length} top-level entr${tree.length === 1 ? 'y' : 'ies'}.`)

  if (total === 0) {
    console.log('\nNo .md files were found, so the site will show an empty menu.')
  }
  if (warnings.length > 0) {
    console.log('\nWorth fixing:')
    for (const warning of warnings) console.log(`  - ${warning}`)
  }


  console.log('\nUpload the content folder to the web server, overwriting what is there.')
  console.log('(The GitHub Actions workflow does this for you on a push to main.)')
}

await main()
