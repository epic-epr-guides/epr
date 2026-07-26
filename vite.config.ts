import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { defineConfig, type Plugin, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const CONTENT_DIR = resolve(process.cwd(), 'content')

const MIME: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

/**
 * Serves the project-root `content/` folder at `/content/*` during `npm run dev`
 * and `npm run preview`, so `fetch('content/manifest.json')` behaves identically
 * in development and on the real static host.
 *
 * Dev/admin-time only. `content/` is deliberately NOT bundled into `dist/` —
 * the two are independent deployables (see README §Deploying).
 */
function serveContentDir(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const rawUrl = req.url ?? '/'
    if (!rawUrl.startsWith('/content/')) return next()
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()

    let relative: string
    try {
      relative = decodeURIComponent(rawUrl.slice('/content/'.length).split('?')[0]!)
    } catch {
      res.statusCode = 400
      res.end('Bad request')
      return
    }

    // Refuse anything that escapes content/ once normalised.
    const filePath = join(CONTENT_DIR, normalize(relative))
    if (filePath !== CONTENT_DIR && !filePath.startsWith(CONTENT_DIR + sep)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }

    let stat: ReturnType<typeof statSync>
    try {
      stat = statSync(filePath)
    } catch {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Not found')
      return
    }
    if (!stat.isFile()) {
      res.statusCode = 404
      res.end('Not found')
      return
    }

    const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
    res.setHeader('Content-Type', type)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'no-cache')

    // Range support so scrubbing a video works the same locally as on the host.
    const range = req.headers.range
    const match = range?.match(/^bytes=(\d*)-(\d*)$/)
    if (match) {
      const startRaw = match[1]
      const endRaw = match[2]
      let start = startRaw ? Number(startRaw) : 0
      let end = endRaw ? Number(endRaw) : stat.size - 1
      if (!startRaw && endRaw) {
        // Suffix range: last N bytes.
        start = Math.max(0, stat.size - Number(endRaw))
        end = stat.size - 1
      }
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stat.size) {
        res.statusCode = 416
        res.setHeader('Content-Range', `bytes */${stat.size}`)
        res.end()
        return
      }
      end = Math.min(end, stat.size - 1)
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
      res.setHeader('Content-Length', String(end - start + 1))
      if (req.method === 'HEAD') return res.end()
      createReadStream(filePath, { start, end }).pipe(res)
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Length', String(stat.size))
    if (req.method === 'HEAD') return res.end()
    createReadStream(filePath).pipe(res)
  }

  return {
    name: 'epr-wiki:serve-content-dir',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  // Relative base: the built app works from the webroot *or* any subfolder
  // without a rebuild. Combined with hash routing, no host config is needed.
  base: './',
  plugins: [react(), tailwindcss(), serveContentDir()],
  build: {
    target: 'es2020',
    // Keep the markdown renderer out of the initial payload (see App.tsx).
    chunkSizeWarningLimit: 700,
  },
})
