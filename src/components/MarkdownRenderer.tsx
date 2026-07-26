import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { contentUrl } from '../content'
import { resolveRelative, routeForContentPath } from '../tree'
import './MarkdownRenderer.css'

const VIDEO_PATTERN = /\.(mp4|webm|ogv)(?:[?#].*)?$/i
const MARKDOWN_PATTERN = /\.md(?:[?#].*)?$/i
/** Anything with a scheme, or a protocol-relative URL, is not ours to resolve. */
const ABSOLUTE_PATTERN = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i

function isVideo(url: string): boolean {
  return VIDEO_PATTERN.test(url)
}

/**
 * A video referenced from a guide, played by the browser's own controls.
 * `preload="metadata"` keeps a guide light on a mobile connection — nothing but
 * the header is fetched until the reader presses play. `playsInline` stops iOS
 * hijacking playback into forced fullscreen.
 */
function VideoFigure({ src, caption }: { src: string; caption?: ReactNode }) {
  const hasCaption = caption !== undefined && caption !== null && caption !== ''
  return (
    <figure className="prose-video">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- captions are the author's job, in the guide text */}
      <video controls preload="metadata" playsInline src={src} className="prose-video__player">
        Your browser cannot play this video. You can{' '}
        <a href={src} download>
          download the file
        </a>{' '}
        instead.
      </video>
      {hasCaption ? <figcaption className="prose-video__caption">{caption}</figcaption> : null}
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
          <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
            {children}
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

    // A video renders as a <figure>, which is not legal inside a <p>. When a
    // paragraph holds nothing but the video link, drop the paragraph wrapper.
    p({ children, node, ...rest }) {
      if (node && holdsOnlyAVideo(node)) return <>{children}</>
      return <p {...rest}>{children}</p>
    },

    // A wide table scrolls inside its own box rather than widening the page.
    table({ children, ...rest }) {
      return (
        <div className="prose-table" tabIndex={0} role="group" aria-label="Table, scrolls sideways">
          <table {...rest}>{children}</table>
        </div>
      )
    },
  }

  return (
    <div className="prose">
      <Markdown
        remarkPlugins={[remarkGfm]}
        // Guide files are admin-supplied but still untrusted input.
        rehypePlugins={[rehypeSanitize]}
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
  const url = only.tagName === 'a' ? only.properties?.href : only.tagName === 'img' ? only.properties?.src : undefined
  return typeof url === 'string' && isVideo(url)
}

function splitFragment(href: string): [string, string | undefined] {
  const index = href.indexOf('#')
  if (index === -1) return [href, undefined]
  return [href.slice(0, index), href.slice(index + 1)]
}
