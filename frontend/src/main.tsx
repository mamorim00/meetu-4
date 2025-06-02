import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppWrapper } from './AppWrapper.tsx'
import './index.css'


// ── Service Worker Registration ──
// Only attempt to register if the browser supports service workers
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
  });
}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWrapper />
  </StrictMode>,
)
