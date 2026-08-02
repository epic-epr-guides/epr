import { useEffect, useId, useMemo, useRef, useState, type HTMLAttributes } from 'react'
import { NavLink } from 'react-router-dom'
import { CaretRight, X } from '@phosphor-icons/react'
import { nodeTitle, type ContentNode, type FolderNode } from '../content'
import { countGuides, routeForSegments, segmentFor } from '../tree'

interface NavDrawerProps {
  tree: ContentNode[]
  /** URL segments of the page currently being viewed. */
  activeSegments: string[]
  /** True when the mobile drawer is showing. Ignored in sidebar mode. */
  open: boolean
  /** True at ≥1024px, where the tree is a permanent sidebar. */
  isSidebar: boolean
  onClose: () => void
}

export function NavDrawer({ tree, activeSegments, open, isSidebar, onClose }: NavDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Folders on the path to the current page start open, so a reader who arrives
  // from a shared link can see where they are.
  const ancestors = useMemo(
    () =>
      activeSegments.slice(0, -1).map((_, index) => activeSegments.slice(0, index + 1).join('/')),
    [activeSegments],
  )
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(ancestors))

  useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current)
      for (const key of ancestors) next.add(key)
      return next
    })
  }, [ancestors])

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // --- Drawer behaviour (mobile only) -------------------------------------
  const isDrawerOpen = !isSidebar && open

  useEffect(() => {
    if (!isDrawerOpen) return

    // Stop the page behind the drawer scrolling under a dragging thumb.
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    panel?.querySelector<HTMLElement>('[data-drawer-initial-focus]')?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return

      // Focus trap: keep Tab inside the drawer while it is covering the page.
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null)
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused?.focus()
    }
  }, [isDrawerOpen, onClose])

  const heading = (
    <h2 id={titleId} className="text-xs font-bold tracking-[0.12em] text-ink-500 uppercase">
      Guides
    </h2>
  )

  const tree$ =
    tree.length === 0 ? (
      <p className="px-4 py-3 text-base text-ink-500 italic">No categories have been added yet.</p>
    ) : (
      <NodeList
        nodes={tree}
        parentSegments={[]}
        depth={0}
        compact={isSidebar}
        activeSegments={activeSegments}
        expanded={expanded}
        onToggle={toggle}
        onSelect={isSidebar ? undefined : onClose}
      />
    )

  if (isSidebar) {
    return (
      <nav
        aria-labelledby={titleId}
        // Frosted rather than bordered: a light translucent fill over the blur
        // separates the sidebar from the reading column, so no hairline is
        // needed on the right. The fill also keeps the panel readable further
        // down the page, where the halftone grid has faded out and the blur
        // alone has almost nothing to work with.
        // `fixed`, not `sticky`: the panel never moves, only the reading column
        // scrolls. Sticky silently degrades to static if any ancestor has become
        // a scroll container, and `body` sets `overflow-x: hidden`, which makes
        // it exactly that. Fixed is unconditional.
        //
        // Being out of flow, it no longer occupies the grid's first track. That
        // track is an explicit 19rem so the space is still reserved, and `main`
        // is pinned to column 2 in App.tsx.
        //
        // Full height rather than a max-height: with `max-h` the panel shrank to
        // fit its categories and the fill stopped mid-page, reading as a
        // floating card.
        className="fixed top-16 left-0 h-[calc(100dvh-4rem)] w-76 overflow-y-auto overscroll-contain bg-slate-400/10 py-6 pb-16 backdrop-blur-xl"
      >
        <div className="px-5 pb-2">{heading}</div>
        {tree$}
      </nav>
    )
  }

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-ink-900/45 backdrop-blur-[2px] transition-[opacity,visibility] duration-200 ${
          isDrawerOpen ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(21rem,88vw)] flex-col bg-white pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-2xl transition-transform duration-200 ease-out ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-[102%]'
        }`}
        // Keeps the closed drawer out of the tab order and away from screen readers.
        {...inertWhenClosed(isDrawerOpen)}
      >
        <div className="flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-ink-900/5 pt-[env(safe-area-inset-top)] pr-2 pl-5">
          {heading}
          <button
            type="button"
            onClick={onClose}
            data-drawer-initial-focus
            className="grid size-tap place-items-center rounded-xl text-ink-500 transition hover:text-ink-900 hover:bg-white/50 active:bg-teal-soft"
          >
            <X size={20} weight="bold" aria-hidden="true" />
            <span className="visually-hidden">Close the menu</span>
          </button>
        </div>
        <nav aria-labelledby={titleId} className="flex-1 overflow-y-auto overscroll-contain py-2 pb-10">
          {tree$}
        </nav>
      </div>
    </>
  )
}

/**
 * `inert` is not in React 18's typings, but browsers honour it and it is the
 * only way to take an off-canvas panel out of the tab order without unmounting
 * it (unmounting would lose the reader's expanded folders).
 */
function inertWhenClosed(isOpen: boolean): HTMLAttributes<HTMLDivElement> {
  return isOpen ? {} : ({ inert: '' } as unknown as HTMLAttributes<HTMLDivElement>)
}

interface NodeListProps {
  nodes: ContentNode[]
  parentSegments: string[]
  depth: number
  /** Sidebar mode: a mouse does not need 44px rows, so the list stays scannable. */
  compact: boolean
  activeSegments: string[]
  expanded: ReadonlySet<string>
  onToggle: (key: string) => void
  /** Called after a guide is chosen, to dismiss the drawer. */
  onSelect?: (() => void) | undefined
}

/** Shared row geometry, so folders and guides line up exactly. */
function rowClasses(compact: boolean): string {
  return [
    'flex w-full items-center gap-2.5 text-left transition',
    compact ? 'min-h-9 py-1.5 text-[0.9375rem]' : 'min-h-tap py-2.5 text-base',
  ].join(' ')
}

function indentFor(depth: number, compact: boolean): string {
  return `${(compact ? 1.25 : 1) + depth * 0.85}rem`
}

function NodeList(props: NodeListProps) {
  const { nodes, parentSegments, depth, compact } = props
  return (
    <ul>
      {nodes.map((node) => {
        const segments = [...parentSegments, segmentFor(node)]
        return (
          <li
            key={segments.join('/')}
            // Hairlines between top-level categories in the drawer only. In the
            // desktop sidebar they read as grid lines against the backdrop, and
            // the extra spacing there already separates the categories.
            className={
              depth === 0 && !compact ? 'border-t border-ink-900/5 first:border-t-0' : undefined
            }
          >
            {node.type === 'folder' ? (
              <FolderRow {...props} node={node} segments={segments} />
            ) : (
              <NavLink
                to={routeForSegments(segments)}
                onClick={props.onSelect}
                style={{ paddingLeft: indentFor(depth, compact), paddingRight: '1rem' }}
                className={({ isActive }) =>
                  `${rowClasses(compact)} ${
                    isActive
                      ? 'bg-teal-soft font-semibold text-teal-dark shadow-[inset_0.25rem_0_0_var(--color-teal-deep)]'
                      : 'text-ink-700 hover:bg-white/50 active:bg-teal-soft'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className={`size-1.5 shrink-0 rounded-full ${
                        isActive ? 'bg-teal-deep' : 'bg-ink-300'
                      }`}
                    />
                    <span className="min-w-0">{nodeTitle(node)}</span>
                  </>
                )}
              </NavLink>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function FolderRow(props: NodeListProps & { node: FolderNode; segments: string[] }) {
  const { node, segments, depth, compact, activeSegments, expanded, onToggle } = props
  const key = segments.join('/')
  const isOpen = expanded.has(key)
  const listId = `nav-${key.replace(/[^a-z0-9]+/gi, '-')}`
  const onPath = activeSegments.slice(0, segments.length).join('/') === key
  const guideCount = countGuides(node.children)

  return (
    <>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => onToggle(key)}
        style={{ paddingLeft: indentFor(depth, compact), paddingRight: '0.75rem' }}
        className={`${rowClasses(compact)} font-display font-semibold hover:bg-white/50 active:bg-teal-soft ${
          onPath ? 'text-teal-dark' : 'text-ink-900'
        }`}
      >
        <CaretRight
          size={15}
          weight="bold"
          aria-hidden="true"
          className={`shrink-0 text-ink-300 transition-transform duration-150 ${
            isOpen ? 'rotate-90' : ''
          }`}
        />
        <span className="min-w-0 flex-1">{nodeTitle(node)}</span>
        {/* The guide count is still announced to screen readers, so a
            non-sighted reader knows how big a category is before opening it —
            it is only the visible number badge that has gone. */}
        <span className="visually-hidden">
          {guideCount} {guideCount === 1 ? 'guide' : 'guides'}
        </span>
      </button>
      <div id={listId} hidden={!isOpen}>
        {node.children.length === 0 ? (
          <p
            style={{ paddingLeft: `${(compact ? 1.25 : 1) + depth * 0.85 + 1.5}rem` }}
            className="py-2 pr-4 text-sm text-ink-500 italic"
          >
            No guides in this folder yet
          </p>
        ) : (
          <NodeList {...props} nodes={node.children} parentSegments={segments} depth={depth + 1} />
        )}
      </div>
    </>
  )
}
