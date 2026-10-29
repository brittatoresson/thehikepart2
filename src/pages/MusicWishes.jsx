import { useState, useEffect, useRef } from 'react'
import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'
import { useAuth } from '../context/AuthContext'
import SpotifySearchLink from '../components/SpotifySearchLink'

export default function MusicWishes() {
  const { currentUser, userProfile } = useAuth()
  const [wishes, setWishes] = useState([])
  const [song, setSong] = useState('')
  const [artist, setArtist] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [votingId, setVotingId] = useState(null)
  const voteInFlight = useRef(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'wishes'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
      setWishes(data)
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
      if (data.voted !== voted) {
        throw new Error('Servern bekräftade inte det begärda röstvalet.')
      }
      setWishes(previous => previous.map(item => item.id === wish.id
        ? {
          ...item,
          votes: voted
            ? [...new Set([...(item.votes ?? []), currentUser.uid])]
            : (item.votes ?? []).filter(uid => uid !== currentUser.uid),
          voteCount: data.voteCount,
        }
        : item).sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0)))
    } catch (err) {
      console.error('Kunde inte uppdatera röst', err)
      setError(err.code === 'functions/not-found'
        ? 'Musikönskningen finns inte kvar.'
        : 'Kunde inte registrera din röst. Kontrollera anslutningen och försök igen.')
    } finally {
      voteInFlight.current = false
      setVotingId(null)
    }
  }

  return (
    <div className="page">
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
            const hasVoted = wish.votes?.includes(currentUser.uid)
            return (
              <div
                key={wish.id}
                className={`music-item${isOwn ? ' music-item--own' : ''}`}
              >
                <div className="music-item-body">
                  <p className="music-item-title">♪ {wish.song}</p>
                  {wish.artist && (
                    <p className="music-item-artist">{wish.artist}</p>
                  )}
                  {wish.message && (
                    <p className="music-item-message">"{wish.message}"</p>
                  )}
                  <p className="music-item-by">— {wish.displayName}</p>
                  <SpotifySearchLink song={wish.song} artist={wish.artist} />
                </div>
                <button
                  className={`vote-btn${hasVoted ? ' vote-btn--voted' : ''}`}
                  onClick={() => handleVote(wish)}
                  disabled={(isOwn && !hasVoted) || votingId !== null}
                  aria-label={hasVoted ? `Ta bort din röst på ${wish.song}` : `Rösta på ${wish.song}`}
                  aria-pressed={Boolean(hasVoted)}
                  aria-busy={votingId === wish.id}
                  title={hasVoted ? 'Ta bort din röst'
                    : isOwn ? 'Du kan inte rösta på din egen önskning' : 'Rösta'}
                >
                  <span className="vote-icon" aria-hidden="true">♥</span>
                  <span className="vote-count">{wish.voteCount ?? 0}</span>
                  {hasVoted && <span className="vote-status">Röstat</span>}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
