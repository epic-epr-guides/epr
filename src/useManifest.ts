import { useEffect, useState } from 'react'
import { ContentError, fetchManifest, type Manifest } from './content'

export type ManifestState =
  | { status: 'loading' }
  | { status: 'ready'; manifest: Manifest }
  | { status: 'error'; error: ContentError }

/** Loads `content/manifest.json` once for the lifetime of the app. */
export function useManifest(): ManifestState {
  const [state, setState] = useState<ManifestState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetchManifest(controller.signal)
      .then((manifest) => setState({ status: 'ready', manifest }))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setState({
          status: 'error',
          error:
            cause instanceof ContentError
              ? cause
              : new ContentError('The list of guides could not be read.', '', 'malformed'),
        })
      })
    return () => controller.abort()
  }, [])

  return state
}
