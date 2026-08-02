import { Link } from 'react-router-dom'
import { Article, Asclepius, CaretRight, FolderSimple } from '@phosphor-icons/react'
import { nodeTitle, type ContentNode } from '../content'
import { countGuides, routeForSegments, segmentFor } from '../tree'
import { EmptyState } from './EmptyState'

/** Where readers report a guide that has gone out of date. */
const REPORT_EMAIL = 'sample@email.com'

interface FolderViewProps {
  title: string
  nodes: ContentNode[]
  /** URL segments of this folder, empty for the wiki home page. */
  segments: string[]
  /** Shown above the list on the home page only. */
  intro?: string
}

/**
 * A category page: the list of what is inside a folder. Also serves as the wiki
 * home page, where the folder is the root of the tree and gets a hero header.
 */
export function FolderView({ title, nodes, segments, intro }: FolderViewProps) {
  const isHome = segments.length === 0

  return (
    <div className="pb-4">
      <header className={isHome ? 'pt-4 text-center sm:pt-8' : 'pt-2'}>
        {isHome ? (
          <div className="animate-fade-up flex justify-center">
            <span className="inline-flex size-20 items-center justify-center rounded-3xl bg-surface shadow-xl shadow-teal-mid/40 ring-2 ring-teal-mid sm:size-24">
              <Asclepius size={46} weight="duotone" className="text-teal-deep" aria-hidden="true" />
            </span>
          </div>
        ) : null}

        <h1
          className={`animate-fade-up stagger-1 font-display font-extrabold tracking-tight text-ink-900 ${
            isHome ? 'mt-7 text-4xl leading-tight sm:text-5xl' : 'text-3xl leading-tight sm:text-4xl'
          }`}
        >
          {title}
        </h1>

        {intro ? (
          <p
            className={`animate-fade-up stagger-2 mt-3.5 text-lg leading-relaxed text-ink-700 ${
              isHome ? 'mx-auto max-w-md' : ''
            }`}
          >
            {intro}
          </p>
        ) : null}
      </header>

      {nodes.length === 0 ? (
        <EmptyState title="No guides in this folder yet">
          <p>
            Nothing has been added to this category. Use the menu to look in another category, or
            ask the IT support team when a guide is expected here.
          </p>
        </EmptyState>
      ) : (
        <ul className="mt-9 grid gap-3.5 sm:grid-cols-2">
          {nodes.map((node, index) => {
            const childSegments = [...segments, segmentFor(node)]
            const isFolder = node.type === 'folder'
            const count = isFolder ? countGuides(node.children) : 0
            const Icon = isFolder ? FolderSimple : Article
            return (
              <li
                key={childSegments.join('/')}
                className="animate-fade-up"
                // Cards arrive in sequence rather than all at once.
                style={{ animationDelay: `${Math.min(index, 6) * 0.07 + 0.25}s` }}
              >
                <Link
                  to={routeForSegments(childSegments)}
                  className="group flex min-h-tap items-center gap-3.5 rounded-2xl bg-surface/80 p-4 shadow-sm ring-1 ring-ink-900/5 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md hover:ring-teal-deep/25 active:translate-y-0 active:bg-teal-soft sm:p-5"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-soft text-teal-deep">
                    <Icon size={24} weight="duotone" aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block font-display font-bold tracking-tight text-ink-900">
                      {nodeTitle(node)}
                    </span>
                    {isFolder ? (
                      <span className="block text-sm text-ink-500">
                        {count} {count === 1 ? 'guide' : 'guides'}
                      </span>
                    ) : null}
                  </span>

                  <CaretRight
                    size={17}
                    weight="bold"
                    aria-hidden="true"
                    className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-teal-deep"
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {/* Home page only — it is a statement about the site as a whole, and
          repeating it under every category would train readers to skip it. */}
      {isHome ? (
        <p className="animate-fade-up mt-10 border-t border-ink-900/10 pt-5 text-sm leading-relaxed text-ink-500">
          <span className="font-semibold text-ink-700">Disclaimer:</span> These are unofficial tips
          to help you navigate EPIC and are not official guidance. Features and processes may change
          with future updates. If you spot any incorrect information or have additional tips that
          could benefit others, please report them to{' '}
          <a
            href={`mailto:${REPORT_EMAIL}`}
            className="font-medium break-all text-teal-dark underline underline-offset-4"
          >
            {REPORT_EMAIL}
          </a>
        </p>
      ) : null}
    </div>
  )
}
