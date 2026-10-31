import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.error('Service workern kunde inte registreras', error)
    })
  })
}

// En flik som var öppen under en deploy kan försöka hämta en sid-chunk som inte
// finns längre. Ladda om en gång för att hämta den nya versionen.
window.addEventListener('vite:preloadError', event => {
  try {
    if (sessionStorage.getItem('chunk-reload') === location.pathname) return
    sessionStorage.setItem('chunk-reload', location.pathname)
  } catch {
    // Utan sessionStorage laddar vi ändå om; felet visas om det kvarstår.
  }
  event.preventDefault()
  location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
