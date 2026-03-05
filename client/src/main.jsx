import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initRuntime } from './runtime'

async function bootstrap() {
  await initRuntime()
  const { default: App } = await import('./App.jsx')

  // Disable native browser/webview context menu globally.
  if (typeof window !== 'undefined' && !window.__kodoContextMenuDisabled) {
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })
    window.__kodoContextMenuDisabled = true
  }

  // Disable dev/browser shortcuts in production build.
  if (import.meta.env.PROD && typeof window !== 'undefined' && !window.__kodoProdShortcutsDisabled) {
    window.addEventListener('keydown', (e) => {
      const key = String(e.key || '').toLowerCase()
      const blockFind = (e.ctrlKey || e.metaKey) && key === 'f'
      const blockRefresh = key === 'f5'
      if (!blockFind && !blockRefresh) return
      e.preventDefault()
      e.stopPropagation()
    }, { capture: true })
    window.__kodoProdShortcutsDisabled = true
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
