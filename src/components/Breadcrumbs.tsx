import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { nodeTitle } from '../content'
import { WIKI_ROOT, type TrailEntry } from '../tree'
import './Breadcrumbs.css'

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
    crumbs.length > 3 ? [crumbs[0]!, 'gap', crumbs[crumbs.length - 2]!, crumbs[crumbs.length - 1]!] : crumbs

  return (
    <nav className="crumbs" aria-label="You are here">
      <ol className="crumbs__list">
        {shown.map((crumb, index) => {
          const isLast = index === shown.length - 1
          return (
            <Fragment key={crumb === 'gap' ? 'gap' : crumb.route}>
              {index > 0 ? (
                <li className="crumbs__sep" aria-hidden="true">
                  /
                </li>
              ) : null}
              <li className={`crumbs__item${isLast ? ' crumbs__item--current' : ''}`}>
                {crumb === 'gap' ? (
                  <span className="crumbs__gap">
                    …<span className="visually-hidden">intermediate categories</span>
                  </span>
                ) : isLast ? (
                  <span aria-current="page">{crumb.label}</span>
                ) : (
                  <Link to={crumb.route}>{crumb.label}</Link>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
