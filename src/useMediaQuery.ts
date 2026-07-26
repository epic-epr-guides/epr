import { useEffect, useState } from 'react'

/**
 * Subscribes to a media query. Used to decide whether the navigation is a
 * drawer (phone/tablet) or a permanent sidebar (≥1024px) — the two need
 * genuinely different markup behaviour, not just different CSS.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    const sync = () => setMatches(list.matches)

    sync()
    list.addEventListener('change', sync)
    // Belt and braces: a missed `change` event would leave the navigation stuck
    // in the wrong mode (a drawer on a desktop, or worse, a sidebar with no way
    // to open it on a phone). `resize` re-reads the query and costs nothing.
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)

    return () => {
      list.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [query])

  return matches
}

/** The one breakpoint at which the drawer becomes a fixed sidebar. */
export const SIDEBAR_QUERY = '(min-width: 64rem)'
