import { useState, useEffect, useRef } from 'react'
import {
  collection, addDoc, deleteDoc, onSnapshot, doc, getDocFromServer,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'
import { useAuth } from '../context/useAuth'
import SpotifySearchLink from '../components/SpotifySearchLink'
import ConfirmDialog from '../components/ConfirmDialog'
import { applyVoteResult, replaceWish, sortByVotes, voteErrorMessage } from '../lib/votes'

export default function MusicWishes() {
  const { currentUser, userProfile } = useAuth()
  const isAdmin = userProfile?.role === 'admin'
  const [wishes, setWishes] = useState([])
  const [song, setSong] = useState('')
  const [artist, setArtist] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [votingId, setVotingId] = useState(null)
  const voteInFlight = useRef(false)
  const [confirm, setConfirm] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'wishes'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      setWishes(sortByVotes(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      setLoading(false)
      setLoadError('')
    }, () => {
      setLoading(false)
      setLoadError('Kunde inte hämta musikönskningarna. Ladda om sidan för att försöka igen.')
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!song.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await addDoc(collection(db, 'wishes'), {
        song: song.trim(),
        artist: artist.trim(),
        message: message.trim(),
        userId: currentUser.uid,
        displayName: userProfile?.displayName ?? currentUser.displayName ?? 'Gäst',
        createdAt: serverTimestamp(),
        votes: [],
        voteCount: 0,
      })
      setSong('')
      setArtist('')
      setMessage('')
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 3000)
    } catch {
      setError('Kunde inte skicka din önskning. Försök igen.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVote(wish) {
    const voted = !wish.votes?.includes(currentUser.uid)
    if (voteInFlight.current || (wish.userId === currentUser.uid && voted)) return
    voteInFlight.current = true
    setVotingId(wish.id)
    setError('')
    try {
      const { data } = await httpsCallable(functions, 'voteForWish')({ wishId: wish.id, voted })
      // Visa det begärda läget direkt. Svarets `voted`-flagga används inte:
      // en äldre publicerad funktion kan svara med ett annat läge än det
      // sparade, och då doldes "Röstat" tills sidan laddades om.
      setWishes(previous => applyVoteResult(previous, wish.id, currentUser.uid, voted, data))
    } catch (err) {
      console.error('Kunde inte uppdatera röst', err)
      setError(voteErrorMessage(err))
    } finally {
      voteInFlight.current = false
      setVotingId(null)
    }
    // Facit är dokumentet i Firestore. Läs om önskningen från servern efter
    // varje försök, så att listan visar det sparade läget även om lyssnaren
    // hann före svaret eller svaret inte beskrev det sparade läget.
    try {
      const latest = await getDocFromServer(doc(db, 'wishes', wish.id))
      setWishes(previous => replaceWish(previous, wish.id, latest.exists() ? latest.data() : null))
    } catch (err) {
      console.warn('Kunde inte läsa om önskningen efter röstningen', err)
    }
  }

  function requestDelete(wish) {
    const isOwn = wish.userId === currentUser.uid
    setConfirm({
      message: isOwn
        ? `Ta bort din önskning ”${wish.song}”?`
        : `Ta bort ”${wish.song}” som ${wish.displayName ?? 'en gäst'} önskat?`,
      onConfirm: () => deleteWish(wish),
    })
  }

  // Ägaren och admin får radera enligt Firestore-reglerna; lyssnaren ovan tar
  // bort posten hos alla andra.
  async function deleteWish(wish) {
    setConfirm(null)
    setDeletingId(wish.id)
    setError('')
    try {
      await deleteDoc(doc(db, 'wishes', wish.id))
      setWishes(previous => replaceWish(previous, wish.id, null))
    } catch (err) {
      console.error('Kunde inte ta bort musikönskning', { id: wish.id, code: err.code }, err)
      setError(err.code === 'permission-denied'
        ? 'Du har inte behörighet att ta bort den här önskningen.'
        : 'Önskningen kunde inte tas bort. Kontrollera anslutningen och försök igen.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="page">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="page-header">
        <h1 className="page-title">Musikönskningar</h1>
        <p className="page-subtitle">Vilken låt vill du dansa till?</p>
      </div>

      <div className="music-form">
        {submitted && <p className="music-success" role="status">Tack för din önskning!</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="song">Låttitel</label>
            <input
              id="song"
              type="text"
              placeholder="T.ex. Unwritten"
              value={song}
              onChange={e => setSong(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="artist">Artist</label>
            <input
              id="artist"
              type="text"
              placeholder="T.ex. Natasha Bedingfield"
              value={artist}
              onChange={e => setArtist(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="message">Meddelande (valfritt)</label>
            <input
              id="message"
              type="text"
              placeholder='T.ex. "Måste spelas vid middagen!"'
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={120}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Skickar…' : 'Skicka önskning'}
          </button>
        </form>
      </div>

      <h2 className="music-list-title">
        Inkomna önskningar
        {wishes.length > 0 && (
          <span className="music-count">{wishes.length}</span>
        )}
      </h2>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {loadError && <p className="auth-error" role="alert">{loadError}</p>}

      {loading ? <p className="music-empty">Laddar önskningar…</p> : !loadError && wishes.length === 0 ? (
        <p className="music-empty">Inga önskningar ännu — bli den första!</p>
      ) : (
        <div className="music-list">
          {wishes.map(wish => {
            const isOwn = wish.userId === currentUser.uid
            const hasVoted = Boolean(wish.votes?.includes(currentUser.uid))
            const canDelete = isOwn || isAdmin
            const voteBlocked = isOwn && !hasVoted
            return (
              <article
                key={wish.id}
                className={`music-item${isOwn ? ' music-item--own' : ''}`}
              >
                <div className="music-item-body">
                  <p className="music-item-title">{wish.song}</p>
                  {wish.artist && (
                    <p className="music-item-artist">{wish.artist}</p>
                  )}
                  {wish.message && (
                    <p className="music-item-message">”{wish.message}”</p>
                  )}
                  <div className="music-item-meta">
                    <span className="music-item-by">{wish.displayName}</span>
                    <span>
                      <SpotifySearchLink song={wish.song} artist={wish.artist} />
                    </span>
                    {canDelete && (
                      <span>
                        <button
                          type="button"
                          className="music-item-delete"
                          onClick={() => requestDelete(wish)}
                          disabled={deletingId !== null}
                          aria-label={isOwn
                            ? `Ta bort din önskning ${wish.song}`
                            : `Ta bort önskningen ${wish.song}`}
                        >
                          {deletingId === wish.id ? 'Tar bort…' : 'Ta bort'}
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className={`vote-btn${hasVoted ? ' vote-btn--voted' : ''}${voteBlocked ? ' vote-btn--own' : ''}`}
                  onClick={() => handleVote(wish)}
                  disabled={voteBlocked || votingId !== null}
                  aria-label={hasVoted ? `Ta bort din röst på ${wish.song}` : `Rösta på ${wish.song}`}
                  aria-pressed={hasVoted}
                  aria-busy={votingId === wish.id}
                  title={hasVoted ? 'Ta bort din röst'
                    : isOwn ? 'Du kan inte rösta på din egen önskning' : 'Rösta'}
                >
                  <span className="vote-icon" aria-hidden="true">{hasVoted ? '♥' : '♡'}</span>
                  <span className="vote-count">{wish.voteCount ?? 0}</span>
                  {hasVoted && <span className="vote-status">Röstat</span>}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
