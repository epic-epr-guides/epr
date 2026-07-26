import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { ArrowSquareOut, Info, Warning } from '@phosphor-icons/react'
import { contentUrl } from '../content'
import { resolveRelative, routeForContentPath } from '../tree'
import { remarkCallouts, type CalloutKind } from '../remarkCallouts'

const VIDEO_PATTERN = /\.(mp4|webm|ogv)(?:[?#].*)?$/i
const MARKDOWN_PATTERN = /\.md(?:[?#].*)?$/i
/** Anything with a scheme, or a protocol-relative URL, is not ours to resolve. */
const ABSOLUTE_PATTERN = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i

function isVideo(url: string): boolean {
  return VIDEO_PATTERN.test(url)
}

/**
 * `remarkCallouts` marks a blockquote with `data-callout`. Sanitising runs after
 * that and drops any attribute not explicitly allowed, so it has to be listed
 * here or the alert silently renders as a plain quote.
 */
const SANITIZE_SCHEMA = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    blockquote: [...(defaultSchema.attributes?.blockquote ?? []), 'dataCallout'],
  },
}

/** Screen-reader label per callout kind — the box itself is only colour and an icon. */
const CALLOUT_LABELS: Record<CalloutKind, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
}

function readCalloutKind(node: unknown): CalloutKind | undefined {
  const properties = (node as { properties?: Record<string, unknown> } | undefined)?.properties
  const value = properties?.['dataCallout'] ?? properties?.['data-callout']
  return typeof value === 'string' && value in CALLOUT_LABELS ? (value as CalloutKind) : undefined
}

/**
 * Typography for rendered guide content, sized for reading a numbered procedure
 * one-thumbed on a phone while doing something else.
 *
 * Ordered lists are the core content type, so their markers get the display
 * face in teal. `list-style` stays `decimal` (rather than a CSS counter on a
 * `list-style: none` list) so Safari keeps announcing the numbers to screen
 * readers — only `::marker` is restyled.
 */
const PROSE_CLASSES = [
  'prose prose-lg max-w-none',
  // Headings
  'prose-headings:font-display prose-headings:tracking-tight prose-headings:text-ink-900',
  'prose-h1:text-3xl prose-h1:font-extrabold prose-h1:leading-tight sm:prose-h1:text-4xl',
  'prose-h2:mt-12 prose-h2:border-t prose-h2:border-ink-900/10 prose-h2:pt-8 prose-h2:text-2xl prose-h2:font-bold',
  'prose-h3:text-xl prose-h3:font-bold',
  // Body
  'prose-p:text-ink-700 prose-li:text-ink-700 prose-strong:font-semibold prose-strong:text-ink-900',
  // `py-0.5` grows an inline link's hit area without changing the line box, so
  // a thumb has something to aim at mid-sentence. Inline links in running text
  // are exempt from the 44px rule (WCAG 2.5.8), but 22px is needlessly mean.
  'prose-a:font-medium prose-a:text-teal-dark prose-a:underline-offset-4 prose-a:py-0.5',
  // Step markers
  '[&_ol>li::marker]:font-display [&_ol>li::marker]:font-bold [&_ol>li::marker]:text-teal-deep',
  '[&_ul>li::marker]:text-teal-mid',
  'prose-li:my-2',
  // Notes
  'prose-blockquote:rounded-r-2xl prose-blockquote:border-l-4 prose-blockquote:border-teal-deep',
  'prose-blockquote:bg-teal-soft/60 prose-blockquote:px-5 prose-blockquote:py-3.5',
  'prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-ink-900',
  '[&_blockquote_p]:before:content-none [&_blockquote_p]:after:content-none',
  // Exact values and code
  'prose-code:rounded-md prose-code:bg-white/90 prose-code:px-1.5 prose-code:py-0.5',
  'prose-code:font-medium prose-code:text-ink-900 prose-code:ring-1 prose-code:ring-ink-900/10',
  'prose-code:before:content-none prose-code:after:content-none',
  'prose-pre:rounded-2xl prose-pre:bg-white/90 prose-pre:text-ink-900 prose-pre:ring-1 prose-pre:ring-ink-900/10',
  '[&_pre_code]:bg-transparent [&_pre_code]:ring-0 [&_pre_code]:font-normal',
  // Media and rules. Screenshots carry their own window chrome and callout
  // boxes, so a border and rounded corners only fought with the image content.
  'prose-hr:border-ink-900/10',
].join(' ')

/**
 * A video referenced from a guide, played by the browser's own controls.
 * `preload="metadata"` keeps a guide light on a mobile connection — nothing but
 * the header is fetched until the reader presses play. `playsInline` stops iOS
 * hijacking playback into forced fullscreen.
 */
function VideoFigure({ src, caption }: { src: string; caption?: ReactNode }) {
  const hasCaption = caption !== undefined && caption !== null && caption !== ''
  return (
    <figure className="my-7">
      <video
        controls
        preload="metadata"
        playsInline
        src={src}
        // The aspect ratio reserves space before metadata loads, so the page
        // does not jump under the reader's thumb.
        className="aspect-video w-full rounded-2xl bg-ink-900 ring-1 ring-ink-900/10"
      >
        Your browser cannot play this video. You can{' '}
        <a href={src} download>
          download the file
        </a>{' '}
        instead.
      </video>
      {hasCaption ? (
        <figcaption className="mt-2.5 text-base leading-relaxed text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  )
}

interface MarkdownRendererProps {
  markdown: string
  /**
   * Path of the guide inside `content/`, e.g. `appointments/book.md`. Relative
   * links in the markdown resolve against this file's own folder.
   */
  guidePath: string
}

export default function MarkdownRenderer({ markdown, guidePath }: MarkdownRendererProps) {
  /** Turns an author's relative href into a path inside `content/`. */
  const toContentPath = (href: string) => resolveRelative(guidePath, href)

  const components: Components = {
    a({ href, children, ...rest }) {
      if (!href) return <>{children}</>

      // In-page anchor: leave it alone.
      if (href.startsWith('#')) {
        return (
          <a href={href} {...rest}>
            {children}
          </a>
        )
      }

      if (ABSOLUTE_PATTERN.test(href)) {
        const external = /^https?:/i.test(href)
        return external ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-baseline gap-1"
            {...rest}
          >
            {children}
            <ArrowSquareOut size={15} weight="bold" aria-hidden="true" className="translate-y-0.5" />
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        ) : (
          <a href={href} {...rest}>
            {children}
          </a>
        )
      }

      // A link to a video file becomes a player, with the link text as caption.
      if (isVideo(href)) {
        return <VideoFigure src={contentUrl(toContentPath(href))} caption={children} />
      }

      // A link to another guide navigates inside the app instead of downloading
      // the raw file. Any trailing #fragment is preserved.
      if (MARKDOWN_PATTERN.test(href)) {
        const [path, fragment] = splitFragment(href)
        const route = routeForContentPath(toContentPath(path))
        return (
          <Link to={fragment ? `${route}#${fragment}` : route} {...rest}>
            {children}
          </Link>
        )
      }

      // Any other relative link points at a file sitting in `content/`.
      return (
        <a href={contentUrl(toContentPath(href))} {...rest}>
          {children}
        </a>
      )
    },

    img({ src, alt, ...rest }) {
      if (!src) return null
      const resolved = ABSOLUTE_PATTERN.test(src) ? src : contentUrl(toContentPath(src))

      // `![alt](clip.mp4)` is treated exactly like `[alt](clip.mp4)`.
      if (isVideo(src)) return <VideoFigure src={resolved} caption={alt} />

      return <img src={resolved} alt={alt ?? ''} loading="lazy" decoding="async" {...rest} />
    },

    // A marked-up blockquote becomes a yellow alert box. An unmarked one keeps
    // the ordinary quote styling from PROSE_CLASSES.
    //
    // Rendered as a <div role="note">, NOT a <blockquote>: the `prose-blockquote:*`
    // styles have the same specificity as utilities set here, so a blockquote lost
    // the cascade and kept typography's teal left border and teal-tinted
    // background. A callout is an admonition rather than a quotation anyway, so
    // `role="note"` is also the more honest element.
    blockquote({ children, node, ...rest }) {
      const kind = readCalloutKind(node)
      if (!kind) return <blockquote {...rest}>{children}</blockquote>

      const Icon = kind === 'note' || kind === 'tip' ? Info : Warning
      return (
        <div
          role="note"
          data-callout={kind}
          className="my-6 flex items-start gap-3 rounded-2xl bg-amber-wash px-4 py-4 text-ink-900 ring-1 ring-amber-line sm:px-5"
        >
          {/* Matching the first line's height centres the icon on that line
              instead of letting it float above the text. */}
          <span className="flex h-[1.7778em] shrink-0 items-center">
            <Icon size={22} weight="duotone" aria-hidden="true" className="text-amber-deep" />
          </span>
          {/* Typography gives paragraphs a top margin, which would push the text
              down away from the icon; zero it at the edges only. */}
          <div className="min-w-0 flex-1 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
            <span className="visually-hidden">{CALLOUT_LABELS[kind]}: </span>
            {children}
          </div>
        </div>
      )
    },

    // A video renders as a <figure>, which is not legal inside a <p>. When a
    // paragraph holds nothing but the video link, drop the paragraph wrapper.
    p({ children, node, ...rest }) {
      if (node && holdsOnlyAVideo(node)) return <>{children}</>
      return <p {...rest}>{children}</p>
    },

    // A wide table scrolls inside its own box rather than widening the page.
    table({ children, ...rest }) {
      return (
        <div
          className="my-7 overflow-x-auto rounded-2xl bg-white/80 ring-1 ring-ink-900/10"
          tabIndex={0}
          role="group"
          aria-label="Table, scrolls sideways"
        >
          <table className="my-0 [&_th]:whitespace-nowrap" {...rest}>
            {children}
          </table>
        </div>
      )
    },
  }

  return (
    <div className={PROSE_CLASSES}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkCallouts]}
        // Guide files are admin-supplied but still untrusted input.
        rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
        components={components}
      >
        {markdown}
      </Markdown>
    </div>
  )
}

/** Minimal shape of the hast nodes react-markdown hands to a component. */
interface HastLike {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastLike[]
}

/** True when a paragraph's only meaningful child is a link or image to a video. */
function holdsOnlyAVideo(node: HastLike): boolean {
  const meaningful = (node.children ?? []).filter(
    (child) => !(child.type === 'text' && (child.value ?? '').trim() === ''),
  )
  if (meaningful.length !== 1) return false

  const only = meaningful[0]
  if (!only || only.type !== 'element') return false
  const url =
    only.tagName === 'a'
      ? only.properties?.href
      : only.tagName === 'img'
        ? only.properties?.src
        : undefined
  return typeof url === 'string' && isVideo(url)
}

function splitFragment(href: string): [string, string | undefined] {
  const index = href.indexOf('#')
  if (index === -1) return [href, undefined]
  return [href.slice(0, index), href.slice(index + 1)]
}
