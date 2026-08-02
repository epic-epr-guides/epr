import type { ReactNode } from 'react'
import { Info, WarningCircle } from '@phosphor-icons/react'

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
  const isProblem = tone === 'problem'
  const Icon = isProblem ? WarningCircle : Info

  return (
    <div
      className={`animate-fade-up my-6 rounded-2xl p-5 shadow-sm ring-1 backdrop-blur sm:p-6 ${
        isProblem ? 'bg-amber-soft/70 ring-amber-deep/20' : 'bg-surface/80 ring-ink-900/5'
      }`}
      role={isProblem ? 'alert' : undefined}
    >
      <div className="flex items-start gap-3.5">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl ${
            isProblem ? 'bg-surface/80 text-amber-deep' : 'bg-teal-soft text-teal-deep'
          }`}
        >
          <Icon size={26} weight="duotone" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">{title}</h2>
          {children ? <div className="mt-2 space-y-3 text-ink-700">{children}</div> : null}
        </div>
      </div>

      {detail ? (
        <p className="mt-5 border-t border-ink-900/10 pt-3.5 text-sm leading-relaxed text-ink-500">
          <span className="font-semibold">For IT support:</span>{' '}
          {/* Long URLs must wrap rather than widen the page. */}
          <code className="break-all font-mono text-[0.95em]">{detail}</code>
        </p>
      ) : null}
    </div>
  )
}
