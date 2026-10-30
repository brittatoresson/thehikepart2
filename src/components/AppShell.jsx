import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import { usePushNotifications } from '../hooks/usePushNotifications'

function NotificationBanner({ onAllow, onDismiss }) {
  return (
    <div className="notif-banner" role="complementary">
      <div className="notif-banner-text">
        <p className="notif-banner-title">Vill du få uppdateringar?</p>
        <p className="notif-banner-sub">Vi skickar notiser om viktiga nyheter inför bröllopsdagen.</p>
      </div>
      <div className="notif-banner-actions">
        <button className="notif-allow-btn" onClick={onAllow}>Tillåt</button>
        <button className="notif-dismiss-btn" onClick={onDismiss} aria-label="Stäng">✕</button>
      </div>
    </div>
  )
}

function PushToast({ title, body, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className="push-toast" role="alert">
      <div className="push-toast-text">
        <p className="push-toast-title">{title}</p>
        {body && <p className="push-toast-body">{body}</p>}
      </div>
      <button className="push-toast-close" onClick={onClose} aria-label="Stäng">✕</button>
    </div>
  )
}

export default function AppShell() {
  const { permissionState, requestPermission, toast, clearToast, error } = usePushNotifications()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const showBanner = permissionState === 'default' && !bannerDismissed

  async function handleAllow() {
    if (await requestPermission()) setBannerDismissed(true)
  }

  return (
    <div className="app">
      {showBanner && (
        <NotificationBanner
          onAllow={handleAllow}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
      {toast && (
        <PushToast title={toast.title} body={toast.body} onClose={clearToast} />
      )}
      <main className="main-content">
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
