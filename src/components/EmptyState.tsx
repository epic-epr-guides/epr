import type { ReactNode } from 'react'
import './EmptyState.css'

interface EmptyStateProps {
  /** Plain-English heading. No jargon, no error codes. */
  title: string
  /** One or two sentences saying what a reader can actually do next. */
  children?: ReactNode
  tone?: 'neutral' | 'problem'
  /** Shown in small print — the file path a technical colleague would need. */
  detail?: string
}

/**
 * The single component for loading-finished-but-nothing-to-show and for errors.
 * Deliberately never invents replacement content for a missing file.
 */
export function EmptyState({ title, children, tone = 'neutral', detail }: EmptyStateProps) {
  return (
    <div className={`empty-state empty-state--${tone}`} role={tone === 'problem' ? 'alert' : undefined}>
      <h2 className="empty-state__title">{title}</h2>
      {children ? <div className="empty-state__body">{children}</div> : null}
      {detail ? (
        <p className="empty-state__detail">
          <span className="empty-state__detail-label">For IT support:</span>{' '}
          <code>{detail}</code>
        </p>
      ) : null}
    </div>
  )
}
