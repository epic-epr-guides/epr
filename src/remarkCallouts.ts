/**
 * Adds GitHub-style callouts to guide Markdown:
 *
 *     > [!NOTE]
 *     > Keep the summary short.
 *
 * The marker is stripped from the text and recorded on the blockquote as a
 * `data-callout` attribute, which `MarkdownRenderer` turns into a coloured
 * alert box. A blockquote with no marker is left completely alone, so existing
 * guides keep the plain quote styling they already have.
 *
 * `dataCallout` must also be allowed through `rehype-sanitize` — see the schema
 * in MarkdownRenderer.tsx, or the attribute is silently dropped and the box
 * renders as an ordinary quote.
 */

/** Minimal shape of the mdast nodes this plugin touches. */
interface MdastNode {
  type: string
  value?: string
  children?: MdastNode[]
  data?: { hProperties?: Record<string, string> }
}

export const CALLOUT_KINDS = ['note', 'tip', 'important', 'warning', 'caution'] as const
export type CalloutKind = (typeof CALLOUT_KINDS)[number]

const MARKER = /^\[!(note|tip|important|warning|caution)\][ \t]*/i

function walk(node: MdastNode, visit: (node: MdastNode) => void): void {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

export function remarkCallouts() {
  return (tree: MdastNode): void => {
    walk(tree, (node) => {
      if (node.type !== 'blockquote') return

      const paragraph = node.children?.[0]
      if (!paragraph || paragraph.type !== 'paragraph') return
      const firstChild = paragraph.children?.[0]
      if (!firstChild || firstChild.type !== 'text' || typeof firstChild.value !== 'string') return

      const match = MARKER.exec(firstChild.value)
      if (!match) return

      firstChild.value = firstChild.value.slice(match[0].length)

      // `> [!NOTE]` on its own line leaves an empty text node followed by a line
      // break; drop both so the alert does not open with blank space.
      if (firstChild.value === '') {
        paragraph.children?.shift()
        if (paragraph.children?.[0]?.type === 'break') paragraph.children.shift()
      }
      if ((paragraph.children?.length ?? 0) === 0) node.children?.shift()

      node.data = {
        ...node.data,
        hProperties: { ...node.data?.hProperties, dataCallout: match[1]!.toLowerCase() },
      }
    })
  }
}
