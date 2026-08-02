import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Asclepius, List } from '@phosphor-icons/react'
import { MANIFEST_PATH, nodeTitle, type Manifest } from './content'
import { locate, segmentsFromSplat, WIKI_ROOT, type Located } from './tree'
import { useManifest } from './useManifest'
import { SIDEBAR_QUERY, useMediaQuery } from './useMediaQuery'
import { Breadcrumbs } from './components/Breadcrumbs'
import { EmptyState } from './components/EmptyState'
import { FolderView } from './components/FolderView'
import { GuideView } from './components/GuideView'
import { NavDrawer } from './components/NavDrawer'

const SITE_NAME = 'EPIC EPR Support Guide'

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
    location.pathname.startsWith(`${WIKI_ROOT}/`)
      ? location.pathname.slice(WIKI_ROOT.length + 1)
      : '',
  )

  return (
    <div className="min-h-dvh">
      {/* Decorative backdrop: layered gradients plus a dissolving dot grid.
          `pointer-events-none` keeps it from swallowing taps. */}
      <div aria-hidden="true" className="aurora pointer-events-none fixed inset-0 -z-10" />
      <div aria-hidden="true" className="halftone pointer-events-none fixed inset-0 -z-10" />

      <a
        href="#main"
        className="absolute top-0 left-0 z-60 -translate-y-full rounded-br-xl bg-ink-900 px-4 py-3 font-semibold text-white focus-visible:translate-y-0"
      >
        Skip to the guide
      </a>

      {/* Frosted rather than filled: no background colour, so what shows through
          is the blurred page behind it. The hairline and shadow do the work of
          separating it from the content that scrolls underneath. */}
      <header className="sticky top-0 z-30 flex min-h-16 items-center gap-1 border-b border-ink-900/5 px-3 pt-[env(safe-area-inset-top)] shadow-md shadow-ink-900/10 backdrop-blur-xs lg:px-5">
        {/* No menu button until there is a tree behind it — a button that opens
            nothing is worse than no button. */}
        {!isSidebar && manifestState.status === 'ready' ? (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            className="inline-flex min-h-tap items-center gap-1.5 rounded-xl px-2.5 font-semibold text-ink-700 transition hover:text-ink-900 hover:bg-white/50 active:bg-teal-soft"
          >
            <List size={22} weight="bold" aria-hidden="true" />
            Menu
          </button>
        ) : null}

        {/* The mark and the wordmark are two separate links to the same place.
            On a phone only the mark shows, pushed to the right opposite the menu
            button. From lg the mark returns to the left and the wordmark takes
            the right edge. The mark carries its own short accessible name so a
            screen reader is not read the site title twice on desktop. */}
        <Link
          to={WIKI_ROOT}
          aria-label="Home"
          className="ml-auto inline-flex min-h-tap shrink-0 items-center rounded-xl px-2 transition hover:bg-white/50 lg:ml-0"
        >
          <Asclepius size={26} weight="duotone" aria-hidden="true" className="text-teal-deep" />
        </Link>

        {/* `min-w-0` with `truncate` lets the title give way rather than overflow. */}
        <Link
          to={WIKI_ROOT}
          className="hidden min-w-0 truncate rounded-xl px-2 py-2 font-display font-bold tracking-tight text-ink-900 transition hover:bg-white/50 lg:ml-auto lg:block lg:text-xl"
        >
          {SITE_NAME}
        </Link>
      </header>

      <div className={isSidebar ? 'grid grid-cols-[19rem_minmax(0,1fr)] items-start' : undefined}>
        {manifestState.status === 'ready' ? (
          <NavDrawer
            tree={manifestState.manifest.tree}
            activeSegments={activeSegments}
            open={drawerOpen}
            isSidebar={isSidebar}
            onClose={closeDrawer}
          />
        ) : null}

        {/* Column 2 explicitly: the sidebar is fixed and therefore out of flow,
            so without this `main` would be auto-placed into the empty 19rem
            first track and squeezed. */}
        <main id="main" className="min-w-0 lg:col-start-2">
          <div className="mx-auto max-w-[72ch] px-4 pb-24 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 lg:px-10">
            {manifestState.status === 'loading' ? (
              <p role="status" className="py-10 text-ink-500">
                Loading the list of guides…
              </p>
            ) : manifestState.status === 'error' ? (
              <EmptyState
                title="Content not available"
                tone="problem"
                detail={manifestState.error.url}
              >
                <p>{manifestState.error.message}</p>
                <p>
                  This site reads its guides from a file called <code>{MANIFEST_PATH}</code> on the
                  web server. Until that file is in place and readable, no guides can be shown.
                </p>
                <p>
                  Please pass this on to the IT support team — there is nothing to fix on your
                  device.
                </p>
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
      {/* The home page heading is the site name itself, so it is passed in
          rather than hard-coded a second time inside FolderView. */}
      <FolderView
        title={SITE_NAME}
        segments={[]}
        nodes={manifest.tree}
        intro="Clear and hopefully easy-to-follow guides for everyday tasks in the EPR system. Choose a category to begin."
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
        <Link to={WIKI_ROOT} className="font-medium text-teal-dark underline underline-offset-4">
          Go to the list of all guides
        </Link>
      </p>
    </EmptyState>
  )
}

function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}
