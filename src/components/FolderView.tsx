import { Link } from 'react-router-dom'
import { nodeTitle, type ContentNode } from '../content'
import { countGuides, routeForSegments, segmentFor } from '../tree'
import { EmptyState } from './EmptyState'
import './FolderView.css'

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
 * home page, where the folder is the root of the tree.
 */
export function FolderView({ title, nodes, segments, intro }: FolderViewProps) {
  return (
    <div className="folder">
      <h1 className="folder__title">{title}</h1>
      {intro ? <p className="folder__intro">{intro}</p> : null}

      {nodes.length === 0 ? (
        <EmptyState title="No guides in this folder yet">
          <p>
            Nothing has been added to this category. Use the menu to look in another category, or
            ask the IT support team when a guide is expected here.
          </p>
        </EmptyState>
      ) : (
        <ul className="folder__list">
          {nodes.map((node) => {
            const childSegments = [...segments, segmentFor(node)]
            const count = node.type === 'folder' ? countGuides(node.children) : 0
            return (
              <li key={childSegments.join('/')}>
                <Link className="folder__row" to={routeForSegments(childSegments)}>
                  <span className={`folder__icon folder__icon--${node.type}`} aria-hidden="true">
                    {node.type === 'folder' ? '❯' : '§'}
                  </span>
                  <span className="folder__label">
                    <span className="folder__name">{nodeTitle(node)}</span>
                    {node.type === 'folder' ? (
                      <span className="folder__meta">
                        {count} {count === 1 ? 'guide' : 'guides'}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
