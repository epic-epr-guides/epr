/**
 * Typed access to the admin-authored `content/` folder.
 *
 * Everything the app displays originates here. Nothing on this side of the app
 * invents, summarises or supplies fallback prose — if a file is missing or empty
 * the caller is expected to show an honest empty/error state.
 */

export interface GuideNode {
  type: 'guide'
  /** File name as it exists on disk, including the `.md` extension. */
  name: string
  /** Optional display title. Falls back to a name derived from the file name. */
  title?: string
}

export interface FolderNode {
  type: 'folder'
  /** Folder name as it exists on disk. */
  name: string
  title?: string
  children: ContentNode[]
}

export type ContentNode = FolderNode | GuideNode

export interface Manifest {
  version: number
  tree: ContentNode[]
}

/** The manifest file the app expects to find, relative to the app's own URL. */
export const MANIFEST_PATH = 'content/manifest.json'

export class ContentError extends Error {
  constructor(
    message: string,
    /** The URL that was being read, for display in error states. */
    readonly url: string,
    readonly kind: 'missing' | 'malformed' | 'network' = 'network',
  ) {
    super(message)
    this.name = 'ContentError'
  }
}

/**
 * Directory URL of the deployed app, with any hash/query and `index.html`
 * stripped. All content URLs resolve against this, so the app works from the
 * webroot or from a subfolder with no configuration.
 */
const APP_BASE: URL = (() => {
  const url = new URL(document.baseURI)
  url.hash = ''
  url.search = ''
  if (!url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/[^/]*$/, '')
  }
  return url
})()

/** Percent-encodes each path segment while leaving the separators intact. */
function encodePath(path: string): string {
  return path.split('/').filter(Boolean).map(encodeURIComponent).join('/')
}

/**
 * Absolute URL for a path inside `content/`.
 * `contentUrl('appointments/media/booking.mp4')` → `<app>/content/appointments/media/booking.mp4`
 */
export function contentUrl(pathInsideContent: string): string {
  return new URL(`content/${encodePath(pathInsideContent)}`, APP_BASE).href
}

/** URL of the manifest, for display in error states. */
export function manifestUrl(): string {
  return new URL(MANIFEST_PATH, APP_BASE).href
}

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

/**
 * Strips a leading sort prefix such as `01-` or `02_` used to order the
 * navigation. `01-getting-started` → `getting-started`.
 */
export function stripSortPrefix(name: string): string {
  return name.replace(/^\d+\s*[-_.]\s*/, '')
}

export function stripMdExtension(name: string): string {
  return name.replace(/\.md$/i, '')
}

/**
 * Display name derived from a file or folder name, used only when the manifest
 * supplies no `title`. `01-book-appointment.md` → `Book Appointment`.
 */
export function deriveTitle(name: string): string {
  const base = stripSortPrefix(stripMdExtension(name))
  const words = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!words) return name
  return words.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase())
}

/** The title to show for a node: manifest `title` first, derived name second. */
export function nodeTitle(node: ContentNode): string {
  const title = node.title?.trim()
  return title ? title : deriveTitle(node.name)
}

// ---------------------------------------------------------------------------
// Manifest validation
// ---------------------------------------------------------------------------

function validateNode(value: unknown, where: string): ContentNode {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${where} is not an object`)
  }
  const raw = value as Record<string, unknown>

  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    throw new Error(`${where} is missing a "name"`)
  }
  if (raw.name.includes('/') || raw.name.includes('\\') || raw.name.includes('..')) {
    throw new Error(`${where} has an invalid "name" (${raw.name}) — names cannot contain paths`)
  }
  if (raw.title !== undefined && typeof raw.title !== 'string') {
    throw new Error(`${where} has a "title" that is not text`)
  }
  const title = typeof raw.title === 'string' ? raw.title : undefined

  if (raw.type === 'guide') {
    return title === undefined
      ? { type: 'guide', name: raw.name }
      : { type: 'guide', name: raw.name, title }
  }

  if (raw.type === 'folder') {
    const children = raw.children
    if (children !== undefined && !Array.isArray(children)) {
      throw new Error(`${where} has "children" that is not a list`)
    }
    const list = Array.isArray(children) ? children : []
    const folder: FolderNode = {
      type: 'folder',
      name: raw.name,
      children: list.map((child, i) => validateNode(child, `${where} → child ${i + 1}`)),
    }
    return title === undefined ? folder : { ...folder, title }
  }

  throw new Error(`${where} has an unknown "type" (${String(raw.type)}) — expected "folder" or "guide"`)
}

export function validateManifest(value: unknown): Manifest {
  if (typeof value !== 'object' || value === null) {
    throw new Error('the file does not contain a JSON object')
  }
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.tree)) {
    throw new Error('the "tree" list is missing')
  }
  const version = typeof raw.version === 'number' ? raw.version : 1
  return {
    version,
    tree: raw.tree.map((node, i) => validateNode(node, `entry ${i + 1}`)),
  }
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

export async function fetchManifest(signal?: AbortSignal): Promise<Manifest> {
  const url = manifestUrl()
  let response: Response
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ContentError('The site could not be reached.', url, 'network')
  }
  if (response.status === 404) {
    throw new ContentError('The content list was not found.', url, 'missing')
  }
  if (!response.ok) {
    throw new ContentError(`The server responded with ${response.status}.`, url, 'network')
  }

  const text = await response.text()
  // A misconfigured host can answer a missing file with index.html; JSON.parse
  // then fails, which is reported as "malformed" rather than a blank screen.
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ContentError('The content list is not valid JSON.', url, 'malformed')
  }
  try {
    return validateManifest(parsed)
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'it is not in the expected format'
    throw new ContentError(`The content list could not be read: ${detail}.`, url, 'malformed')
  }
}

/** Fetches a guide's raw Markdown. `pathInsideContent` ends in `.md`. */
export async function fetchGuide(pathInsideContent: string, signal?: AbortSignal): Promise<string> {
  const url = contentUrl(pathInsideContent)
  let response: Response
  try {
    response = await fetch(url, { signal, headers: { Accept: 'text/markdown, text/plain' } })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ContentError('The site could not be reached.', url, 'network')
  }
  if (response.status === 404) {
    throw new ContentError('This guide is listed in the menu but its file is missing.', url, 'missing')
  }
  if (!response.ok) {
    throw new ContentError(`The server responded with ${response.status}.`, url, 'network')
  }
  return response.text()
}
