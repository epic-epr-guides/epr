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
 *  - A guide's title comes from its first `# H1`, falling back to its file name.
 *  - `01-` style sort prefixes order the menu and are stripped from titles.
 *  - Folders are listed before guides, each alphabetically by file name.
 *  - Media files (.mp4, .png, …) are skipped — guides link to them directly.
 *  - Folders containing no guides at any depth are left out (this is what keeps
 *    `media/` folders from appearing in the menu).
 *  - A folder title you edited by hand in the previous manifest is preserved.
 */

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, relative, resolve } from 'node:path'

const CONTENT_DIR = resolve(process.cwd(), 'content')
const MANIFEST_FILE = join(CONTENT_DIR, 'manifest.json')
/** Media flagged as unsafe to publish until replaced. See §Unsafe media in the README. */
const NEEDS_REPLACING_FILE = join(CONTENT_DIR, '.needs-replacing.json')

/** Extensions that are guides. Everything else is either media or ignored. */
const GUIDE_EXTENSION = '.md'

/** Files and folders the walker never descends into or lists. */
const IGNORED = new Set(['manifest.json', '.ds_store', 'thumbs.db', '.git', 'node_modules'])

function stripSortPrefix(name) {
  return name.replace(/^\d+\s*[-_.]\s*/, '')
}

function deriveTitle(name) {
  const base = stripSortPrefix(name.replace(/\.md$/i, ''))
  const words = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!words) return name
  return words.replace(/\b\p{Ll}/gu, (character) => character.toUpperCase())
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
async function readExistingFolderTitles() {
  const titles = new Map()
  try {
    const previous = JSON.parse(await readFile(MANIFEST_FILE, 'utf8'))
    const walk = (nodes, prefix) => {
      for (const node of nodes ?? []) {
        if (node?.type !== 'folder' || typeof node.name !== 'string') continue
        const path = prefix ? `${prefix}/${node.name}` : node.name
        if (typeof node.title === 'string' && node.title.trim() !== '') {
          titles.set(path, node.title)
        }
        walk(node.children, path)
      }
    }
    walk(previous?.tree, '')
  } catch {
    // No previous manifest, or it is unreadable. Titles are simply derived.
  }
  return titles
}

/** Recursively builds the tree for one directory. Returns a list of nodes. */
async function walk(directory, prefix, existingTitles, warnings) {
  const entries = await readdir(directory, { withFileTypes: true })

  const folders = []
  const guides = []

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (IGNORED.has(entry.name.toLowerCase())) continue
    if (entry.name.startsWith('.')) continue

    const entryPath = join(directory, entry.name)
    const contentPath = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      const children = await walk(entryPath, contentPath, existingTitles, warnings)
      // A folder with no guides beneath it is not a category — this is how
      // `media/` folders stay out of the menu.
      if (children.length === 0) continue
      folders.push({
        type: 'folder',
        name: entry.name,
        title: existingTitles.get(contentPath) ?? deriveTitle(entry.name),
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
      name: entry.name,
      title: (await readH1(entryPath)) ?? deriveTitle(entry.name),
    })
  }

  // Folders before files, so categories sit above loose guides in the menu.
  return [...folders, ...guides]
}

/**
 * Checks media listed in `.needs-replacing.json` and reports anything still
 * byte-identical to the flagged original. Sits in the manifest step because that
 * is the one command an admin cannot skip when adding content — a note in a
 * README is too easy to walk past when the risk is publishing patient data.
 *
 * Once a file is genuinely replaced its hash changes and it stops being
 * reported, so the check needs no manual bookkeeping.
 */
async function checkFlaggedMedia() {
  let list
  try {
    list = JSON.parse(await readFile(NEEDS_REPLACING_FILE, 'utf8'))
  } catch {
    return [] // No list, or unreadable — nothing to check.
  }

  const outstanding = []
  for (const entry of list.files ?? []) {
    if (typeof entry?.path !== 'string') continue
    try {
      const bytes = await readFile(join(CONTENT_DIR, entry.path))
      const hash = createHash('sha1').update(bytes).digest('hex')
      if (typeof entry.sha1 === 'string' && hash.startsWith(entry.sha1)) {
        outstanding.push(entry)
      }
    } catch {
      // Deleted counts as dealt with.
    }
  }
  return outstanding
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
  const existingTitles = await readExistingFolderTitles()
  const tree = await walk(CONTENT_DIR, '', existingTitles, warnings)

  await writeFile(MANIFEST_FILE, `${JSON.stringify({ version: 1, tree }, null, 2)}\n`, 'utf8')

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
  const flagged = await checkFlaggedMedia()
  if (flagged.length > 0) {
    const line = '='.repeat(72)
    console.log(`\n${line}`)
    console.log('  DO NOT UPLOAD YET')
    console.log(line)
    console.log(`  ${flagged.length} image${flagged.length === 1 ? '' : 's'} still contain${flagged.length === 1 ? 's' : ''} identifiable patient data.`)
    console.log('  This site has no authentication: uploading publishes them to anyone')
    console.log('  who can reach the URL.\n')
    for (const entry of flagged) {
      console.log(`  - content/${entry.path}`)
      if (entry.contains) console.log(`      ${entry.contains}`)
    }
    console.log('\n  Replace each with a screenshot from a training/PLAY environment using')
    console.log('  fictional patients, then remove its entry from')
    console.log('  content/.needs-replacing.json and run this again.')
    console.log(`${line}\n`)
    // Non-zero exit so a scripted or CI-style run cannot sail past this.
    process.exitCode = 2
    return
  }

  console.log('\nNow upload the whole content folder to the web server, overwriting what is there.')
}

await main()
