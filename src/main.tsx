import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles/global.css'

/**
 * Hash routing (`/#/wiki/appointments/book-appointment`) is deliberate: deep
 * links then work on any static host — IIS, Apache, a file share — with no
 * rewrite rule and no server configuration. See README §Deep links to switch
 * to clean URLs if the host can be configured.
 */
const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element in index.html')

createRoot(container).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
