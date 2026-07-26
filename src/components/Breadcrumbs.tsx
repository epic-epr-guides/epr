import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { CaretRight } from '@phosphor-icons/react'
import { nodeTitle } from '../content'
import { WIKI_ROOT, type TrailEntry } from '../tree'

interface Crumb {
  label: string
  route: string
}

interface BreadcrumbsProps {
  /** Ancestors first, current page last. Empty on the wiki home page. */
  trail: TrailEntry[]
}

export function Breadcrumbs({ trail }: BreadcrumbsProps) {
  if (trail.length === 0) return null

  const crumbs: Crumb[] = [
    { label: 'All guides', route: WIKI_ROOT },
    ...trail.map((entry) => ({ label: nodeTitle(entry.node), route: entry.route })),
  ]

  // On a narrow screen a deep path will not fit. Keep the root for orientation
  // and the last two for context, and collapse whatever is in between.
  const shown: (Crumb | 'gap')[] =
    crumbs.length > 3
      ? [crumbs[0]!, 'gap', crumbs[crumbs.length - 2]!, crumbs[crumbs.length - 1]!]
      : crumbs

  return (
    <nav aria-label="You are here" className="pt-2 pb-1 text-sm">
      {/* Truncate rather than scroll — the current page is what must stay readable. */}
      <ol className="flex min-w-0 flex-nowrap items-center gap-1">
        {shown.map((crumb, index) => {
          const isLast = index === shown.length - 1
          return (
            <Fragment key={crumb === 'gap' ? 'gap' : crumb.route}>
              {index > 0 ? (
                <li aria-hidden="true" className="shrink-0 text-ink-300">
                  <CaretRight size={13} weight="bold" />
                </li>
              ) : null}
              <li
                className={
                  isLast
                    ? // The current page absorbs the leftover width and truncates last.
                      'min-w-0 flex-1 truncate font-semibold text-ink-500'
                    : 'min-w-0 shrink-0 truncate'
                }
              >
                {crumb === 'gap' ? (
                  <span className="px-0.5 tracking-wider text-ink-300">
                    …<span className="visually-hidden">intermediate categories</span>
                  </span>
                ) : isLast ? (
                  <span aria-current="page">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.route}
                    // Keeps a 44px tap height without stretching the row.
                    className="inline-flex min-h-tap items-center font-medium text-teal-dark underline-offset-4 hover:underline"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
