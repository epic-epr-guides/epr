import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'epr-theme'

/** Matches the meta tag the pre-paint script in index.html leaves behind. */
const THEME_COLOUR: Record<Theme, string> = {
  dark: '#0b1a1f',
  light: '#f4f9fb',
}

/**
 * The theme is already on <html> by the time React mounts — the inline script
 * in index.html puts it there before the first paint. This hook reads that
 * rather than deciding again, so the two can never disagree and the page never
 * flashes the wrong colours.
 *
 * Dark is the default. Only an explicit stored choice selects light.
 */
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    // Keeps the browser chrome (mobile address bar, form controls) in step.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOUR[theme])

    // Storage can throw in private mode. A reader who cannot persist the choice
    // should still get the theme they picked for this visit.
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* not fatal */
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
