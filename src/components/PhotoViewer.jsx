import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// Helskärmsvisning där man swipar mellan bilderna. Svepet sköts av webbläsarens
// scroll-snap, så bilden följer fingret utan eget gesthanterande. Bara aktuell
// bild och dess grannar laddas.
export default function PhotoViewer({ photos, index, onIndexChange, onClose }) {
  const trackRef = useRef()
  const closeRef = useRef()
  const settleTimer = useRef()
  const closed = useRef(false)
  const photo = photos[index]

  // Dubbeltryck på krysset får inte gå tillbaka två steg och lämna galleriet.
  const close = useCallback(() => {
    if (closed.current) return
    closed.current = true
    onClose()
  }, [onClose])

  // Scrolla till rätt bild vid öppning, och när index ändras utifrån (t.ex. framåt i historiken).
  useLayoutEffect(() => {
    const track = trackRef.current
    if (track && Math.round(track.scrollLeft / track.clientWidth) !== index) {
      track.scrollTo({ left: index * track.clientWidth, behavior: 'instant' })
    }
  }, [index])

  useEffect(() => {
    closeRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      clearTimeout(settleTimer.current)
    }
  }, [])

  useEffect(() => {
    function scrollToIndex(next, behavior = 'smooth') {
      const track = trackRef.current
      if (track) track.scrollTo({ left: next * track.clientWidth, behavior })
    }
    function onKey(event) {
      if (event.key === 'Escape') close()
      else if (event.key === 'ArrowRight' && index < photos.length - 1) scrollToIndex(index + 1)
      else if (event.key === 'ArrowLeft' && index > 0) scrollToIndex(index - 1)
    }
    // Vid rotation ändras bredden; håll kvar samma bild.
    function onResize() { scrollToIndex(index, 'instant') }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [index, photos.length, close])

  function handleScroll() {
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const track = trackRef.current
      if (!track) return
      const next = Math.min(photos.length - 1, Math.max(0, Math.round(track.scrollLeft / track.clientWidth)))
      if (next !== index) onIndexChange(next)
    }, 120)
  }

  if (!photo) return null

  return (
    <div className="gallery-fullscreen" role="dialog" aria-modal="true" aria-label={`Foto av ${photo.displayName}`}>
      <button
        ref={closeRef}
        className="gallery-fullscreen-close"
        onClick={close}
        aria-label="Stäng"
      >
        <CloseIcon />
      </button>
      <div className="gallery-fullscreen-track" ref={trackRef} onScroll={handleScroll}>
        {photos.map((item, i) => (
          <div className="gallery-fullscreen-slide" key={item.id} onClick={close}>
            {Math.abs(i - index) <= 1 && (
              <img
                src={item.url}
                alt={`Foto av ${item.displayName}`}
                onClick={event => event.stopPropagation()}
              />
            )}
          </div>
        ))}
      </div>
      <p className="gallery-fullscreen-caption" aria-live="polite">
        Foto av {photo.displayName}
        {photos.length > 1 && <span className="gallery-fullscreen-count"> · {index + 1} / {photos.length}</span>}
      </p>
    </div>
  )
}
