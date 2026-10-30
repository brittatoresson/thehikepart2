import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/useAuth'
import heroTopLeft from '../assets/botanical/hero_top_left.png'
import heroBottomRight from '../assets/botanical/hero_bottom_right.png'

const WEDDING = new Date('2027-06-05T14:00:00+02:00') // svensk sommartid, oavsett gästens tidszon
const WEDDING_DAY_END = Date.parse('2027-06-05T22:00:00.000Z') // 6 juni 2027 kl. 00.00 i Sverige (CEST)
const MAPS_URL = 'https://maps.google.com/?q=Östergötland,+Sverige'

function calcTimeLeft() {
  const now = Date.now()
  const diff = WEDDING - now
  if (diff <= 0) return { phase: now < WEDDING_DAY_END ? 'today' : 'after' }
  return {
    phase: 'counting',
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

function Countdown() {
  const [t, setT] = useState(calcTimeLeft)

  useEffect(() => {
    const id = setInterval(() => setT(calcTimeLeft()), 1000)
    return () => clearInterval(id)
  }, [])

  if (t.phase === 'today') return <p className="countdown-done">Det är idag! 🎉</p>
  if (t.phase === 'after') return <p className="countdown-done">Tack för att ni firade med oss! 💚</p>

  const units = [
    { value: t.days, label: 'dagar' },
    { value: t.hours, label: 'tim' },
    { value: t.minutes, label: 'min' },
    { value: t.seconds, label: 'sek' },
  ]

  return (
    <div className="countdown">
      {units.map(({ value, label }) => (
        <div key={label} className="countdown-unit">
          <p className="countdown-value">{String(value).padStart(2, '0')}</p>
          <p className="countdown-label">{label}</p>
        </div>
      ))}
    </div>
  )
}

const EMPTY_GUEST = () => ({ name: '', dietary: '' })

function RsvpModal({ onClose }) {
  const { currentUser, userProfile } = useAuth()
  const [attending, setAttending] = useState(null)
  const [guests, setGuests] = useState([EMPTY_GUEST()])
  const [hasExisting, setHasExisting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const ownName = userProfile?.displayName ?? currentUser.displayName ?? ''

  useEffect(() => {
    let active = true
    getDoc(doc(db, 'rsvps', currentUser.uid)).then(snap => {
      if (!active) return
      const d = snap.exists() ? snap.data() : null
      if (d) {
        setAttending(d.attending ?? null)
        setHasExisting(true)
      }
      setGuests(d?.guests?.length
        ? d.guests.map(g => ({ ...g, dietary: d.attending === false ? '' : g.dietary ?? '' }))
        : [{ name: ownName, dietary: '' }])
      setLoading(false)
    }).catch(err => {
      console.error('Kunde inte hämta OSA-svaret', err)
      if (!active) return
      setLoadError('Ditt svar kunde inte hämtas. Kontrollera anslutningen och försök igen.')
      setLoading(false)
    })
    return () => { active = false }
  }, [currentUser.uid, ownName, reloadKey])

  function retryLoad() {
    setLoadError('')
    setLoading(true)
    setReloadKey(value => value + 1)
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function updateGuest(i, field, value) {
    setGuests(prev => prev.map((g, idx) => idx === i ? { ...g, [field]: value } : g))
    setError('')
  }

  function addGuest() { setGuests(prev => [...prev, EMPTY_GUEST()]) }

  function removeGuest(i) {
    setGuests(prev => prev.filter((_, idx) => idx !== i))
    setError('')
  }

  function chooseAttending(value) {
    setAttending(value)
    if (!value) setGuests(current => current.map(g => ({ ...g, dietary: '' })))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (attending === null) return
    if (guests.some(g => !g.name.trim())) {
      setError('Fyll i namn på alla rader, eller ta bort tomma rader med ✕.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const cleanGuests = guests.map(g => ({
        name: g.name.trim(),
        dietary: attending ? g.dietary.trim() : '',
      }))
      const data = {
        userId: currentUser.uid,
        displayName: userProfile?.displayName ?? currentUser.displayName ?? '',
        attending,
        guests: cleanGuests,
        updatedAt: serverTimestamp(),
      }
      if (!hasExisting) data.submittedAt = serverTimestamp()
      await setDoc(doc(db, 'rsvps', currentUser.uid), data, { merge: true })
      setDone(true)
    } catch (err) {
      console.error('Kunde inte spara OSA-svaret', err)
      setError('Ditt svar kunde inte sparas. Kontrollera anslutningen och försök igen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">O.S.A.</h2>
          <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>
        </div>

        {loading ? (
          <p className="modal-loading">Laddar…</p>
        ) : loadError ? (
          <div role="alert">
            <p className="auth-error">{loadError}</p>
            <button type="button" className="btn-primary" onClick={retryLoad}>Försök igen</button>
          </div>
        ) : done ? (
          <div className="rsvp-done">
            <p className="rsvp-done-icon">{attending ? '🎉' : '💌'}</p>
            <p className="rsvp-done-title">
              {attending ? 'Vi ses den 5 juni!' : 'Tack för att du meddelade oss.'}
            </p>
            <button className="btn-primary" onClick={onClose}>Stäng</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {hasExisting && (
              <p className="rsvp-existing-note">Du har redan svarat. Du kan uppdatera nedan.</p>
            )}

            <p className="rsvp-question">Kan ni komma?</p>
            <div className="rsvp-toggle">
              <button
                type="button"
                className={`rsvp-toggle-btn${attending === true ? ' active' : ''}`}
                onClick={() => chooseAttending(true)}
              >
                Ja, vi kommer!
              </button>
              <button
                type="button"
                className={`rsvp-toggle-btn rsvp-toggle-btn--no${attending === false ? ' active' : ''}`}
                onClick={() => chooseAttending(false)}
              >
                Tyvärr nej
              </button>
            </div>

            {attending !== null && (
              <div className="rsvp-guests">
                <div className="rsvp-guests-header">
                  <span>Namn</span>
                  {attending && <span>Allergi / matpreferens</span>}
                </div>
                {guests.map((g, i) => (
                  <div key={i} className="rsvp-guest-row">
                    <input
                      type="text"
                      placeholder="Namn"
                      value={g.name}
                      onChange={e => updateGuest(i, 'name', e.target.value)}
                      className="rsvp-guest-input"
                      aria-label={`Namn, gäst ${i + 1}`}
                      required
                    />
                    {attending && <input
                      type="text"
                      placeholder="T.ex. glutenfri"
                      value={g.dietary}
                      onChange={e => updateGuest(i, 'dietary', e.target.value)}
                      className="rsvp-guest-input rsvp-guest-input--dietary"
                    />}
                    {guests.length > 1 && (
                      <button
                        type="button"
                        className="rsvp-guest-remove"
                        onClick={() => removeGuest(i)}
                        aria-label="Ta bort gäst"
                      >✕</button>
                    )}
                  </div>
                ))}
                <button type="button" className="rsvp-add-guest" onClick={addGuest}>
                  + Lägg till gäst
                </button>
              </div>
            )}

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button
              type="submit"
              className="btn-primary"
              style={{ marginTop: '1.25rem' }}
              disabled={submitting || attending === null}
            >
              {submitting ? 'Sparar…' : 'Skicka svar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const { userProfile, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const showRsvp = searchParams.get('osa') === '1'

  async function handleLogout() {
    setLoggingOut(true)
    setLogoutError('')
    try {
      await logout()
    } catch (error) {
      console.error('Kunde inte logga ut', error)
      setLogoutError('Du kunde inte loggas ut. Försök igen.')
    } finally {
      setLoggingOut(false)
    }
  }

  function setShowRsvp(open) {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (open) next.set('osa', '1')
      else next.delete('osa')
      return next
    }, { replace: !open })
  }

  return (
    <div className="page home-page">
      <div className="home-hero">
        <img className="home-floral home-floral--top-left" src={heroTopLeft} alt="" aria-hidden="true" fetchPriority="high" />
        <img className="home-floral home-floral--bottom-right" src={heroBottomRight} alt="" aria-hidden="true" />
        <div className="home-hero-content">
          <p className="home-eyebrow">Med glädje bjuder vi in er att fira</p>
          <h1 className="home-names"><span>Britta</span><span className="home-ampersand">&amp;</span><span>Johanna</span></h1>
          <div className="home-divider" aria-hidden="true">
            <span className="home-divider-line" />
            <span className="home-divider-icon">✦</span>
            <span className="home-divider-line" />
          </div>
          <p className="home-date">5 juni 2027</p>
          <a className="home-location" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
            Östergötland · Sverige
          </a>
        </div>
      </div>

      <Countdown />

      <div className="home-cards">
        <div className="info-card">
          <h2>Datum &amp; Tid</h2>
          <p>Lördagen den 5 juni 2027</p>
          <p>Vigseln börjar kl. 14:00</p>
        </div>
        <a className="info-card info-card--link" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
          <h2>Plats</h2>
          <p>Östergötland, Sverige</p>
          <p>Adress meddelas separat</p>
        </a>
        <button className="info-card info-card--link" onClick={() => setShowRsvp(true)}>
          <h2>O.S.A.</h2>
          <p>Vänligen svara senast</p>
          <p>1 april 2027</p>
        </button>
      </div>

      <div className="contact-account">
        <div className="contact-account-info">
          <span className="contact-account-label">Inloggad som</span>
          <span className="contact-account-name">{userProfile?.displayName ?? 'Gäst'}</span>
        </div>
        <button className="btn-logout" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? 'Loggar ut…' : 'Logga ut'}
        </button>
      </div>
      {logoutError && <p className="auth-error" role="alert">{logoutError}</p>}
      {showRsvp && <RsvpModal onClose={() => setShowRsvp(false)} />}
    </div>
  )
}
