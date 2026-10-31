import { useState, useEffect, useCallback, Suspense } from 'react'
import { Outlet, useSearchParams } from 'react-router-dom'
import BottomNav from './BottomNav'
import IntroOverlay from './IntroOverlay'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { INTRO_STORAGE_KEY, localDateKey, prefersReducedMotion, shouldShowIntro } from '../introSchedule'

function readIntroShownOn() {
  try {
    return localStorage.getItem(INTRO_STORAGE_KEY)
  } catch {
    return null // Utan lagring visas intron vid varje inloggning, inte vid varje sidbyte.
  }
}

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
  const [searchParams, setSearchParams] = useSearchParams()
  // Intron spelas första gången appen öppnas varje dag (AppShell monteras efter inloggning).
  // 'playing' → 'leaving' (sidan glider till full storlek) → 'done'.
  const [introPhase, setIntroPhase] = useState(() => (
    !prefersReducedMotion() && shouldShowIntro({ lastShownOn: readIntroShownOn(), search: `?${searchParams}` })
      ? 'playing'
      : 'done'
  ))
  const introActive = introPhase !== 'done'

  const showBanner = permissionState === 'default' && !bannerDismissed && !introActive

  async function handleAllow() {
    if (await requestPermission()) setBannerDismissed(true)
  }

  const handleIntroLeave = useCallback(() => setIntroPhase('leaving'), [])

  const handleIntroDone = useCallback(() => {
    try {
      localStorage.setItem(INTRO_STORAGE_KEY, localDateKey())
    } catch {
      // Ingen lagring: intron visas igen vid nästa inloggning.
    }
    setIntroPhase('done')
    if (searchParams.get('intro') === '1') {
      const next = new URLSearchParams(searchParams)
      next.delete('intro')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const appClassName = `app${introActive ? ' app--intro' : ''}${introPhase === 'leaving' ? ' app--intro-leaving' : ''}`

  return (
    <div className={appClassName}>
      {introActive && <IntroOverlay onLeave={handleIntroLeave} onDone={handleIntroDone} />}
      {showBanner && (
        <NotificationBanner
          onAllow={handleAllow}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
      {toast && (
        <PushToast title={toast.title} body={toast.body} onClose={clearToast} />
      )}
      <div className="app-page">
        <main className="main-content">
          {error && <p className="auth-error" role="alert">{error}</p>}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
