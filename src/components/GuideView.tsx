import { Suspense, lazy, useEffect, useState } from 'react'
import { ContentError, contentUrl, fetchGuide } from '../content'
import { EmptyState } from './EmptyState'

// The markdown parser is the heaviest part of the app and is not needed to draw
// the shell or the navigation, so it is fetched only when a guide is opened.
const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'))

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; markdown: string }
  | { status: 'error'; error: ContentError }

interface GuideViewProps {
  /** Path inside `content/`, including `.md`. */
  contentPath: string
  /** Title from the manifest, shown while the file is still loading. */
  title: string
}

export function GuideView({ contentPath, title }: GuideViewProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    fetchGuide(contentPath, controller.signal)
      .then((markdown) => setState({ status: 'ready', markdown }))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setState({
          status: 'error',
          error:
            cause instanceof ContentError
              ? cause
              : new ContentError('This guide could not be read.', contentUrl(contentPath)),
        })
      })
    return () => controller.abort()
  }, [contentPath])

  if (state.status === 'loading') {
    return <GuideSkeleton title={title} />
  }

  if (state.status === 'error') {
    return (
      <EmptyState title="We couldn't load this guide" tone="problem" detail={state.error.url}>
        <p>{state.error.message}</p>
        <p>
          Try reloading the page. If it still will not open, let the IT support team know which
          guide you were trying to read.
        </p>
      </EmptyState>
    )
  }

  if (state.markdown.trim() === '') {
    return (
      <EmptyState title="This guide has not been written yet" detail={contentUrl(contentPath)}>
        <p>
          The file for this guide exists but is empty. Nothing is missing from your device — there
          is simply no content here yet.
        </p>
      </EmptyState>
    )
  }

  return (
    <article className="animate-fade-up pb-4">
      <Suspense fallback={<GuideSkeleton title={title} />}>
        <MarkdownRenderer markdown={state.markdown} guidePath={contentPath} />
      </Suspense>
    </article>
  )
}

/** Shows the known title immediately so the page never looks blank. */
function GuideSkeleton({ title }: { title: string }) {
  return (
    <div className="pt-2">
      <h1 className="font-display text-3xl leading-tight font-extrabold tracking-tight text-ink-900 sm:text-4xl">
        {title}
      </h1>
      <p role="status" className="mt-3 text-base text-ink-500">
        Loading this guide…
      </p>
      <div aria-hidden="true" className="mt-8 space-y-3.5">
        {['96%', '88%', '92%', '64%'].map((width) => (
          <span
            key={width}
            style={{ width }}
            className="block h-3.5 animate-pulse rounded-full bg-teal-soft"
          />
        ))}
      </div>
    </div>
  )
}
