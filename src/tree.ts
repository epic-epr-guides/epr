/**
 * Mapping between the manifest tree, paths inside `content/`, and router URLs.
 *
 * Router URL   `/wiki/appointments/book-appointment`
 * Content path `appointments/book-appointment.md`
 *
 * The `.md` extension is dropped from URLs; folder URLs have no extension to
 * drop, so a lookup against the manifest is what distinguishes the two.
 */

import { stripMdExtension, stripSortPrefix, type ContentNode, type FolderNode } from './content'

export const WIKI_ROOT = '/wiki'

/** The URL segment a node is addressed by. */
export function segmentFor(node: ContentNode): string {
  return node.type === 'guide' ? stripMdExtension(node.name) : node.name
}

/** Router path for a list of URL segments. */
export function routeForSegments(segments: string[]): string {
  if (segments.length === 0) return WIKI_ROOT
  return `${WIKI_ROOT}/${segments.map(encodeURIComponent).join('/')}`
}

/** Splits a `/wiki/*` splat into decoded segments. */
export function segmentsFromSplat(splat: string | undefined): string[] {
  return (splat ?? '')
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
}

export interface TrailEntry {
  node: ContentNode
  /** URL segments from the wiki root down to and including this node. */
  segments: string[]
  route: string
}

export interface Located {
  node: ContentNode
  /** Ancestors first, the node itself last. */
  trail: TrailEntry[]
  /** Path inside `content/` — includes `.md` for guides. */
  contentPath: string
}

function matches(node: ContentNode, segment: string): boolean {
  const own = segmentFor(node)
  if (own === segment) return true
  // Tolerate links that omit a `01-` sort prefix, so hand-typed and older
  // URLs keep working after a folder is re-ordered.
  return stripSortPrefix(own) === stripSortPrefix(segment)
}

/** Resolves URL segments against the manifest. Returns null if nothing matches. */
export function locate(tree: ContentNode[], segments: string[]): Located | null {
  const trail: TrailEntry[] = []
  /** Real file/folder names, for building the content path. */
  const names: string[] = []
  /** Canonical URL segments, for building crumb links. */
  const walked: string[] = []
  let level: ContentNode[] = tree
  let current: ContentNode | null = null

  for (const [index, segment] of segments.entries()) {
    const found: ContentNode | undefined = level.find((node) => matches(node, segment))
    if (!found) return null

    // A guide is always a leaf, so it can only match the final segment.
    if (found.type === 'guide' && index !== segments.length - 1) return null

    current = found
    names.push(found.name)
    walked.push(segmentFor(found))
    trail.push({ node: found, segments: [...walked], route: routeForSegments(walked) })
    level = found.type === 'folder' ? found.children : []
  }

  if (!current) return null
  return { node: current, trail, contentPath: names.join('/') }
}

export function childrenOf(node: ContentNode): ContentNode[] {
  return node.type === 'folder' ? node.children : []
}

/** True when the folder contains no entries at all. */
export function isEmptyFolder(node: ContentNode): node is FolderNode {
  return node.type === 'folder' && node.children.length === 0
}

/** Total number of guides at or below a node, used to describe folders honestly. */
export function countGuides(nodes: ContentNode[]): number {
  return nodes.reduce(
    (total, node) => total + (node.type === 'guide' ? 1 : countGuides(node.children)),
    0,
  )
}

/**
 * Resolves a relative href written inside a guide against that guide's own
 * folder. Returns a path inside `content/` with `./` and `../` collapsed.
 */
export function resolveRelative(fromContentPath: string, href: string): string {
  const fromDir = fromContentPath.replace(/[^/]*$/, '')
  const base = new URL(`epr:/${fromDir}`)
  const resolved = new URL(href, base)
  return resolved.pathname.replace(/^\/+/, '')
}

/** Router path for a content path such as `appointments/book-appointment.md`. */
export function routeForContentPath(contentPath: string): string {
  const segments = contentPath.split('/').filter(Boolean)
  const last = segments.pop()
  if (last === undefined) return WIKI_ROOT
  return routeForSegments([...segments, stripMdExtension(last)])
}
