import { useState, useEffect } from 'react'
import SpotifySearchLink from '../components/SpotifySearchLink'
import {
  collection,
  deleteDoc, updateDoc, doc, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'
import { useAuth } from '../context/useAuth'
import { useLiveCollection } from '../hooks/useLiveCollection'

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
        <p className="confirm-msg">{message}</p>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel}>Avbryt</button>
          <button className="confirm-delete" onClick={onConfirm}>Ta bort</button>
        </div>
      </div>
    </div>
  )
}

const TABS = [
  { id: 'guests', label: 'Gäster' },
  { id: 'osa', label: 'OSA' },
  { id: 'faq', label: 'FAQ' },
  { id: 'music', label: 'Musik' },
  { id: 'photos', label: 'Bilder' },
  { id: 'push', label: 'Notiser' },
]

function GuestExport() {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  async function handleExport() {
    setExporting(true)
    setError('')
    try {
      const { data } = await httpsCallable(functions, 'exportGuests')()
      const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `gastlista-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      try {
        link.click()
      } finally {
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (err) {
      setError(err.code === 'functions/permission-denied'
        ? 'Endast admin kan exportera gästlistan.'
        : 'Kunde inte exportera gästlistan. Kontrollera anslutningen och försök igen.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="admin-export">
      <button className="btn-primary" onClick={handleExport} disabled={exporting}>
        {exporting ? 'Exporterar…' : 'Exportera gästlista och matpreferenser'}
      </button>
      <p className="admin-export-help">En rad per anmäld person, inklusive namn, kontaktens e-post, närvaro och allergier/matpreferenser. Registrerade som inte svarat eller tackat nej ingår också.</p>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  )
}

function GuestsTab() {
  const { items: guests, loading, error } = useLiveCollection('users', 'createdAt')

  if (loading) return <p role="status">Hämtar gäster…</p>
  if (error) return <p className="auth-error" role="alert">{error}</p>

  return (
    <div>
      <p className="admin-count">{guests.length} registrerade gäster</p>
      <div className="admin-list">
        {guests.map(g => (
          <div key={g.id} className="admin-row">
            <div>
              <p className="admin-row-title">{g.displayName}</p>
              <p className="admin-row-sub">{g.email}</p>
            </div>
            <span className={`admin-badge${g.role === 'admin' ? ' admin-badge--admin' : ''}`}>
              {g.role === 'admin' ? 'Admin' : 'Gäst'}
            </span>
          </div>
        ))}
        {guests.length === 0 && (
          <p className="admin-empty">Inga registrerade gäster ännu.</p>
        )}
      </div>
    </div>
  )
}

function OsaTab() {
  const usersState = useLiveCollection('users', 'createdAt')
  const rsvpsState = useLiveCollection('rsvps')
  const users = usersState.items
  const rsvps = Object.fromEntries(rsvpsState.items.map(item => [item.id, item]))

  if (usersState.loading || rsvpsState.loading) return <p role="status">Hämtar OSA…</p>
  if (usersState.error || rsvpsState.error) {
    return <p className="auth-error" role="alert">{usersState.error || rsvpsState.error}</p>
  }

  const attendingGuestCount = Object.values(rsvps)
    .filter(r => r.attending === true)
    // Ett ja-svar utan namnrader är minst kontaktpersonen själv (samma som CSV-exporten).
    .reduce((sum, r) => sum + (r.guests?.length || 1), 0)
  const decliningGuestCount = Object.values(rsvps)
    .filter(r => r.attending === false)
    .reduce((sum, r) => sum + (r.guests?.length || 1), 0)
  const pending = users.filter(u => !rsvps[u.id])

  const dietaryCounts = Object.values(rsvps)
    .filter(r => r.attending === true)
    .flatMap(r => r.guests || [])
    .map(g => g.dietary)
    .filter(Boolean)
    .flatMap(d => d.split(/[,\n]/).map(s => s.trim()).filter(Boolean))
    .reduce((acc, d) => {
      const key = d.charAt(0).toUpperCase() + d.slice(1).toLowerCase()
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

  return (
    <div>
      <div className="osa-summary">
        <div className="osa-summary-item osa-summary-item--yes">
          <p className="osa-summary-num">{attendingGuestCount}</p>
          <p className="osa-summary-label">Kommer</p>
        </div>
        <div className="osa-summary-item osa-summary-item--no">
          <p className="osa-summary-num">{decliningGuestCount}</p>
          <p className="osa-summary-label">Kommer ej</p>
        </div>
        <div className="osa-summary-item osa-summary-item--pending">
          <p className="osa-summary-num">{pending.length}</p>
          <p className="osa-summary-label">Ej svarat</p>
        </div>
      </div>

      {Object.keys(dietaryCounts).length > 0 && (
        <div className="osa-dietary-summary">
          <p className="osa-dietary-title">Allergier &amp; matpreferenser</p>
          <div className="osa-dietary-list">
            {Object.entries(dietaryCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => (
                <div key={label} className="osa-dietary-item">
                  <span className="osa-dietary-label">{label}</span>
                  <span className="osa-dietary-count">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="admin-list">
        {users.length === 0 && <p className="admin-empty">Inga registrerade gäster ännu.</p>}
        {users.map(u => {
          const rsvp = rsvps[u.id]
          return (
            <div key={u.id} className="admin-row admin-row--osa">
              <div className="admin-row-body">
                <p className="admin-row-title">{u.displayName}</p>
                {rsvp && rsvp.guests?.length > 0 && (
                  <div className="osa-guest-list">
                    {rsvp.guests.map((g, i) => (
                      <div key={i} className="osa-guest-item">
                        <span className="osa-guest-name">{g.name}</span>
                        {rsvp.attending === true && g.dietary && <span className="osa-guest-dietary">{g.dietary}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {!rsvp && <p className="admin-row-meta osa-pending">Ej svarat</p>}
              </div>
              {rsvp && (
                <span className={`admin-badge${rsvp.attending ? ' admin-badge--yes' : ' admin-badge--no'}`}>
                  {rsvp.attending ? 'Kommer' : 'Kommer ej'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MusicTab() {
  const { items: wishes, loading, error: loadError } = useLiveCollection('wishes', 'voteCount', 'desc')
  const [confirm, setConfirm] = useState(null)
  const [error, setError] = useState('')

  async function setStatus(id, status) {
    setError('')
    try {
      await updateDoc(doc(db, 'wishes', id), { status })
    } catch (err) {
      console.error('Kunde inte ändra status på musikönskning', { id, code: err.code }, err)
      setError('Statusen kunde inte ändras. Kontrollera anslutningen och försök igen.')
    }
  }

  function deleteWish(id) {
    setConfirm({
      message: 'Ta bort denna musikönskning?',
      onConfirm: async () => {
        setConfirm(null)
        setError('')
        try {
          await deleteDoc(doc(db, 'wishes', id))
        } catch (err) {
          console.error('Kunde inte ta bort musikönskning', { id, code: err.code }, err)
          setError('Önskningen kunde inte tas bort. Kontrollera anslutningen och försök igen.')
        }
      },
    })
  }

  return (
    <>
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {loadError && <p className="auth-error" role="alert">{loadError}</p>}
      {loading && <p role="status">Hämtar önskningar…</p>}
      <div className="admin-list">
        {!loading && !loadError && wishes.length === 0 && (
          <p className="admin-empty">Inga önskningar ännu.</p>
        )}
        {wishes.map(w => (
          <div key={w.id} className="admin-row admin-row--wish">
            <div className="admin-row-body">
              <p className="admin-row-title">♪ {w.song}</p>
              {w.artist && <p className="admin-row-sub">{w.artist}</p>}
              {w.message && <p className="admin-row-msg">"{w.message}"</p>}
              <p className="admin-row-meta">
                {w.displayName} · {w.voteCount ?? 0} röster
              </p>
              <SpotifySearchLink song={w.song} artist={w.artist} />
            </div>
            <div className="admin-row-actions">
              <button
                className={`admin-status-btn${w.status === 'confirmed' ? ' active-confirm' : ''}`}
                onClick={() => setStatus(w.id, w.status === 'confirmed' ? 'pending' : 'confirmed')}
                aria-label="Bekräfta önskning"
                title="Bekräfta"
              >✓</button>
              <button
                className={`admin-status-btn${w.status === 'declined' ? ' active-decline' : ''}`}
                onClick={() => setStatus(w.id, w.status === 'declined' ? 'pending' : 'declined')}
                aria-label="Avböj önskning"
                title="Avböj"
              >✗</button>
              <button
                className="admin-delete-btn"
                onClick={() => deleteWish(w.id)}
                aria-label="Ta bort önskning"
                title="Ta bort"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function PhotosTab() {
  const { items: photos, loading, error: loadError } = useLiveCollection('photos', 'createdAt', 'desc')
  const [deleting, setDeleting] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteSuccess, setDeleteSuccess] = useState('')

  function deletePhoto(photo) {
    setConfirm({
      message: `Ta bort bilden uppladdad av ${photo.displayName}?`,
      onConfirm: async () => {
        setConfirm(null)
        setDeleting(photo.id)
        setDeleteError('')
        setDeleteSuccess('')
        try {
          await httpsCallable(functions, 'deletePhoto')({ photoId: photo.id })
          setDeleteSuccess('Bilden har tagits bort.')
        } catch (error) {
          console.error('Admin kunde inte ta bort bild', { photoId: photo.id, code: error.code }, error)
          setDeleteError('Bilden kunde inte tas bort. Kontrollera anslutningen och försök igen.')
        } finally {
          setDeleting(null)
        }
      },
    })
  }

  return (
    <>
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div>
        <p className="admin-count">{photos.length} bilder</p>
        {loading && <p role="status">Hämtar bilder…</p>}
        {loadError && <p className="auth-error" role="alert">{loadError}</p>}
        {deleteError && <p className="auth-error" role="alert">{deleteError}</p>}
        {deleteSuccess && <p className="music-success" role="status">{deleteSuccess}</p>}
        <div className="admin-photo-grid">
          {!loading && !loadError && photos.length === 0 && (
            <p className="admin-empty">Inga bilder ännu.</p>
          )}
          {photos.map(photo => (
            <div key={photo.id} className="admin-photo-item">
              <img src={photo.url} alt="" loading="lazy" />
              <p className="admin-photo-name">{photo.displayName}</p>
              <button
                className="admin-photo-delete"
                onClick={() => deletePhoto(photo)}
                disabled={deleting === photo.id}
                aria-label="Ta bort bild"
              >✕</button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function PushTab() {
  const { userProfile } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [sendError, setSendError] = useState('')
  const { items: history, loading, error: loadError } = useLiveCollection('notifications', 'sentAt', 'desc')

  async function handleSend(e) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) {
      setSendError('Fyll i både rubrik och meddelande.')
      return
    }
    setSending(true)
    setResult(null)
    setSendError('')
    try {
      await addDoc(collection(db, 'notification_queue'), {
        title: title.trim(),
        body: body.trim(),
        sentBy: userProfile?.displayName ?? 'Admin',
        createdAt: serverTimestamp(),
      })
      setResult('✓ Notisen skickas till alla gäster som har slagit på notiser. Antal mottagare syns i historiken.')
      setTitle('')
      setBody('')
    } catch (err) {
      console.error('Kunde inte köa notisen', err)
      setSendError('Notisen kunde inte skickas. Kontrollera anslutningen och försök igen.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="music-form">
        {result && <p className="music-success" role="status">{result}</p>}
        {sendError && <p className="auth-error" role="alert">{sendError}</p>}
        <form onSubmit={handleSend}>
          <div className="form-group">
            <label htmlFor="push-title">Rubrik</label>
            <input
              id="push-title"
              type="text"
              placeholder="T.ex. Välkomna!"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={50}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="push-body">Meddelande</label>
            <input
              id="push-body"
              type="text"
              placeholder="T.ex. Middagen serveras om 30 minuter."
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={120}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={sending}>
            {sending ? 'Skickar…' : 'Skicka till alla gäster'}
          </button>
        </form>
      </div>

      {loading && <p role="status">Hämtar notishistorik…</p>}
      {loadError && <p className="auth-error" role="alert">{loadError}</p>}
      {history.length > 0 && (
        <>
          <h2 className="music-list-title">
            Historik
            <span className="music-count">{history.length}</span>
          </h2>
          <div className="admin-list">
            {history.map(n => (
              <div key={n.id} className="admin-row">
                <div>
                  <p className="admin-row-title">{n.title}</p>
                  <p className="admin-row-sub">{n.body}</p>
                  <p className="admin-row-meta">
                    {n.sentBy} · {n.successCount ?? 0} mottog
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FaqTab() {
  const [items, setItems] = useState([])
  const [savedItems, setSavedItems] = useState([])
  const [version, setVersion] = useState(0)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function reload() {
    setLoading(true)
    setError('')
    setSuccess('')
    setRetry(value => value + 1)
  }

  useEffect(() => {
    let active = true
    httpsCallable(functions, 'getFaqs')()
      .then(({ data }) => {
        if (!active) return
        setItems(data.items)
        setSavedItems(data.items)
        setVersion(data.version)
        setError('')
      })
      .catch(err => {
        console.error('Kunde inte läsa FAQ i adminpanelen', err)
        if (active) setError('FAQ kunde inte hämtas. Kontrollera anslutningen och försök igen.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [retry])

  const isDirty = JSON.stringify(items) !== JSON.stringify(savedItems)

  function updateItem(id, field, value) {
    setItems(current => current.map(item => item.id === id ? { ...item, [field]: value } : item))
    setSuccess('')
  }

  function moveItem(index, offset) {
    setItems(current => {
      const target = index + offset
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setSuccess('')
  }

  function addItem(event) {
    event.preventDefault()
    setItems(current => [...current, { id: crypto.randomUUID(), q: question.trim(), a: answer.trim() }])
    setQuestion('')
    setAnswer('')
    setError('')
    setSuccess('')
  }

  async function save() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const { data } = await httpsCallable(functions, 'saveFaqs')({ items, version })
      setItems(data.items)
      setSavedItems(data.items)
      setVersion(data.version)
      setSuccess('FAQ har sparats och visas nu för gästerna.')
    } catch (err) {
      console.error('Kunde inte spara FAQ', err)
      setError(err.code === 'functions/aborted'
        ? 'FAQ har ändrats av en annan admin. Hämta senaste versionen innan du sparar igen.'
        : err.code === 'functions/permission-denied'
          ? 'Endast admin kan ändra FAQ.'
          : 'FAQ kunde inte sparas. Kontrollera anslutningen och försök igen.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="admin-empty" role="status">Hämtar FAQ…</p>
  if (error && items.length === 0) {
    return (
      <div className="faq-admin-message" role="alert">
        <p>{error}</p>
        <button type="button" className="btn-primary" onClick={reload}>Försök igen</button>
      </div>
    )
  }

  return (
    <div className="faq-admin">
      <p className="admin-count">Ändringar visas för gäster först när du sparar.</p>
      {error && (
        <div className="faq-admin-message" role="alert">
          <p>{error}</p>
          {error.includes('ändrats av en annan admin') && (
            <button type="button" className="btn-primary" onClick={reload}>Hämta senaste FAQ</button>
          )}
        </div>
      )}
      {success && <p className="music-success" role="status">{success}</p>}

      <fieldset disabled={saving} className="faq-admin-fields" aria-label="Redigera FAQ">
      <div className="faq-admin-list">
        {items.map((item, index) => (
          <section className="faq-admin-item" key={item.id} aria-label={`FAQ ${index + 1}`}>
            <div className="faq-admin-order">
              <span>#{index + 1}</span>
              <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`Flytta ${item.q} upp`}>↑</button>
              <button type="button" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} aria-label={`Flytta ${item.q} ner`}>↓</button>
              <button type="button" className="faq-admin-remove" onClick={() => {
                setItems(current => current.filter(entry => entry.id !== item.id))
                setSuccess('')
              }} aria-label={`Ta bort ${item.q}`}>Ta bort</button>
            </div>
            <div className="form-group">
              <label htmlFor={`faq-question-${item.id}`}>Fråga</label>
              <input id={`faq-question-${item.id}`} value={item.q} maxLength={250} onChange={event => updateItem(item.id, 'q', event.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor={`faq-answer-${item.id}`}>Svar</label>
              <textarea id={`faq-answer-${item.id}`} value={item.a} maxLength={4000} rows={3} onChange={event => updateItem(item.id, 'a', event.target.value)} />
            </div>
          </section>
        ))}
      </div>

      <form className="music-form faq-admin-add" onSubmit={addItem}>
        <h2>Lägg till fråga</h2>
        <div className="form-group">
          <label htmlFor="faq-new-question">Fråga</label>
          <input id="faq-new-question" value={question} maxLength={250} onChange={event => setQuestion(event.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="faq-new-answer">Svar</label>
          <textarea id="faq-new-answer" value={answer} maxLength={4000} rows={3} onChange={event => setAnswer(event.target.value)} required />
        </div>
        <button type="submit" className="btn-primary">Lägg till i listan</button>
      </form>
      </fieldset>

      <button type="button" className={`btn-primary faq-admin-save${success && !isDirty && !saving ? ' is-saved' : ''}`} onClick={save} disabled={!isDirty || saving || items.some(item => !item.q.trim() || !item.a.trim())}>
        {saving ? 'Sparar…' : 'Spara FAQ'}
      </button>
    </div>
  )
}

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
)

export default function Admin() {
  const [tab, setTab] = useState('guests')

  return (
    <div className="page admin-page">
      <div className="page-header">
        <h1 className="page-title">Adminpanel</h1>
        <p className="page-subtitle">Britta &amp; Johanna 2027</p>
      </div>

      <div className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`admin-tab${tab === t.id ? ' admin-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'guests' || tab === 'osa') && <GuestExport />}
      <div className="admin-content">
        {tab === 'guests' && <GuestsTab />}
        {tab === 'osa' && <OsaTab />}
        {tab === 'faq' && <FaqTab />}
        {tab === 'music' && <MusicTab />}
        {tab === 'photos' && <PhotosTab />}
        {tab === 'push' && <PushTab />}
      </div>
    </div>
  )
}
