import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { MANIFEST_PATH, nodeTitle, type Manifest } from './content'
import { locate, segmentsFromSplat, WIKI_ROOT, type Located } from './tree'
import { useManifest } from './useManifest'
import { SIDEBAR_QUERY, useMediaQuery } from './useMediaQuery'
import { Breadcrumbs } from './components/Breadcrumbs'
import { EmptyState } from './components/EmptyState'
import { FolderView } from './components/FolderView'
import { GuideView } from './components/GuideView'
import { NavDrawer } from './components/NavDrawer'
import './App.css'

const SITE_NAME = 'EPR Support Wiki'

export default function App() {
  const manifestState = useManifest()
  const isSidebar = useMediaQuery(SIDEBAR_QUERY)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // Every navigation dismisses the drawer and returns the reader to the top of
  // the new page — mid-page scroll carried over from a long guide is disorienting.
  useEffect(() => {
    setDrawerOpen(false)
    if (!location.hash) window.scrollTo(0, 0)
  }, [location.pathname, location.hash])

  const activeSegments = segmentsFromSplat(
    location.pathname.startsWith(`${WIKI_ROOT}/`) ? location.pathname.slice(WIKI_ROOT.length + 1) : '',
  )

  return (
    <div className={`shell${isSidebar ? ' shell--sidebar' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to the guide
      </a>

      <header className="appbar">
        {/* No menu button until there is a tree behind it — a button that opens
            nothing is worse than no button. */}
        {!isSidebar && manifestState.status === 'ready' ? (
          <button
            type="button"
            className="appbar__menu"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="appbar__menu-label">Menu</span>
          </button>
        ) : null}
        <Link className="appbar__brand" to={WIKI_ROOT}>
          {SITE_NAME}
        </Link>
      </header>

      <div className="shell__body">
        {manifestState.status === 'ready' ? (
          <NavDrawer
            tree={manifestState.manifest.tree}
            activeSegments={activeSegments}
            open={drawerOpen}
            isSidebar={isSidebar}
            onClose={closeDrawer}
          />
        ) : null}

        <main className="main" id="main">
          <div className="main__inner">
            {manifestState.status === 'loading' ? (
              <p className="main__loading" role="status">
                Loading the list of guides…
              </p>
            ) : manifestState.status === 'error' ? (
              <EmptyState title="Content not available" tone="problem" detail={manifestState.error.url}>
                <p>{manifestState.error.message}</p>
                <p>
                  This site reads its guides from a file called <code>{MANIFEST_PATH}</code> on the
                  web server. Until that file is in place and readable, no guides can be shown.
                </p>
                <p>Please pass this on to the IT support team — there is nothing to fix on your device.</p>
              </EmptyState>
            ) : (
              <WikiRoutes manifest={manifestState.manifest} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function WikiRoutes({ manifest }: { manifest: Manifest }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={WIKI_ROOT} replace />} />
      <Route path="/wiki" element={<WikiHome manifest={manifest} />} />
      <Route path="/wiki/*" element={<ContentPage manifest={manifest} />} />
      <Route path="*" element={<UnknownPage />} />
    </Routes>
  )
}

function WikiHome({ manifest }: { manifest: Manifest }) {
  useDocumentTitle(SITE_NAME)
  return (
    <>
      <Breadcrumbs trail={[]} />
      <FolderView
        title="All guides"
        segments={[]}
        nodes={manifest.tree}
        intro="Choose a category to see the guides inside it."
      />
    </>
  )
}

function ContentPage({ manifest }: { manifest: Manifest }) {
  const params = useParams()
  const segments = segmentsFromSplat(params['*'])
  const found: Located | null = locate(manifest.tree, segments)

  useDocumentTitle(found ? `${nodeTitle(found.node)} — ${SITE_NAME}` : `Not found — ${SITE_NAME}`)

  if (!found) return <UnknownPage />

  return (
    <>
      <Breadcrumbs trail={found.trail} />
      {found.node.type === 'guide' ? (
        <GuideView contentPath={found.contentPath} title={nodeTitle(found.node)} />
      ) : (
        <FolderView
          title={nodeTitle(found.node)}
          segments={found.trail[found.trail.length - 1]?.segments ?? []}
          nodes={found.node.children}
        />
      )}
    </>
  )
}

function UnknownPage() {
  useDocumentTitle(`Page not found — ${SITE_NAME}`)
  return (
    <EmptyState title="We couldn't find that page">
      <p>
        The address you followed does not match any guide in the menu. The guide may have been
        renamed, moved, or withdrawn.
      </p>
      <p>
        <Link to={WIKI_ROOT}>Go to the list of all guides</Link>
      </p>
    </EmptyState>
  )
}

function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}
