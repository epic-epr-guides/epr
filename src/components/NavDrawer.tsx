import { useEffect, useId, useMemo, useRef, useState, type HTMLAttributes } from 'react'
import { NavLink } from 'react-router-dom'
import { nodeTitle, type ContentNode, type FolderNode } from '../content'
import { countGuides, routeForSegments, segmentFor } from '../tree'
import './NavDrawer.css'

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
    () => activeSegments.slice(0, -1).map((_, index) => activeSegments.slice(0, index + 1).join('/')),
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

  const tree$ = (
    <div className="nav-tree">
      {tree.length === 0 ? (
        <p className="nav-tree__empty">No categories have been added yet.</p>
      ) : (
        <NodeList
          nodes={tree}
          parentSegments={[]}
          depth={0}
          activeSegments={activeSegments}
          expanded={expanded}
          onToggle={toggle}
          onSelect={isSidebar ? undefined : onClose}
        />
      )}
    </div>
  )

  if (isSidebar) {
    return (
      <nav className="nav nav--sidebar" aria-labelledby={titleId}>
        <h2 className="nav__heading" id={titleId}>
          Guides
        </h2>
        {tree$}
      </nav>
    )
  }

  return (
    <>
      <div
        className={`nav__scrim${isDrawerOpen ? ' nav__scrim--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`nav nav--drawer${isDrawerOpen ? ' nav--open' : ''}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // Keeps the closed drawer out of the tab order and away from screen readers.
        {...inertWhenClosed(isDrawerOpen)}
      >
        <div className="nav__bar">
          <h2 className="nav__heading" id={titleId}>
            Guides
          </h2>
          <button
            type="button"
            className="nav__close"
            onClick={onClose}
            data-drawer-initial-focus
          >
            <span aria-hidden="true">✕</span>
            <span className="visually-hidden">Close the menu</span>
          </button>
        </div>
        <nav aria-labelledby={titleId} className="nav__scroll">
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
  activeSegments: string[]
  expanded: ReadonlySet<string>
  onToggle: (key: string) => void
  /** Called after a guide is chosen, to dismiss the drawer. */
  onSelect?: (() => void) | undefined
}

function NodeList(props: NodeListProps) {
  const { nodes, parentSegments, depth } = props
  return (
    <ul className="nav-tree__list" data-depth={depth}>
      {nodes.map((node) => {
        const segments = [...parentSegments, segmentFor(node)]
        return (
          <li key={segments.join('/')} className="nav-tree__item">
            {node.type === 'folder' ? (
              <FolderRow {...props} node={node} segments={segments} />
            ) : (
              <NavLink
                to={routeForSegments(segments)}
                className={({ isActive }) => `nav-tree__guide${isActive ? ' nav-tree__guide--active' : ''}`}
                style={{ paddingLeft: `${0.9 + depth * 0.85}rem` }}
                onClick={props.onSelect}
              >
                {nodeTitle(node)}
              </NavLink>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function FolderRow(props: NodeListProps & { node: FolderNode; segments: string[] }) {
  const { node, segments, depth, activeSegments, expanded, onToggle } = props
  const key = segments.join('/')
  const isOpen = expanded.has(key)
  const listId = `nav-${key.replace(/[^a-z0-9]+/gi, '-')}`
  const contains = activeSegments.slice(0, segments.length).join('/') === key
  const guideCount = countGuides(node.children)

  return (
    <>
      <button
        type="button"
        className={`nav-tree__folder${contains ? ' nav-tree__folder--on-path' : ''}`}
        style={{ paddingLeft: `${0.9 + depth * 0.85}rem` }}
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => onToggle(key)}
      >
        <svg
          className={`nav-tree__chevron${isOpen ? ' nav-tree__chevron--open' : ''}`}
          viewBox="0 0 20 20"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="nav-tree__folder-label">{nodeTitle(node)}</span>
        <span className="nav-tree__count">
          {guideCount}
          <span className="visually-hidden"> {guideCount === 1 ? 'guide' : 'guides'}</span>
        </span>
      </button>
      <div id={listId} hidden={!isOpen}>
        {node.children.length === 0 ? (
          <p className="nav-tree__empty" style={{ paddingLeft: `${1.75 + depth * 0.85}rem` }}>
            No guides in this folder yet
          </p>
        ) : (
          <NodeList {...props} nodes={node.children} parentSegments={segments} depth={depth + 1} />
        )}
      </div>
    </>
  )
}
