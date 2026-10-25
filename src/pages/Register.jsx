import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthHeader from '../components/AuthHeader'

const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'Den e-postadressen är redan registrerad.',
  'auth/invalid-email': 'Ogiltig e-postadress.',
  'auth/weak-password': 'Lösenordet är för svagt. Välj minst 6 tecken.',
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (inviteCode.trim().toLowerCase() !== import.meta.env.VITE_INVITE_CODE.toLowerCase()) {
      return setError('Fel inbjudningskod. Kontrollera att du skrivit rätt.')
    }
    if (password !== confirm) {
      return setError('Lösenorden matchar inte.')
    }
    setError('')
    setSubmitting(true)
    try {
      await register(email, password, displayName.trim())
      navigate('/')
    } catch (err) {
      setError(ERROR_MESSAGES[err.code] ?? 'Något gick fel. Försök igen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <AuthHeader />

      <div className="auth-card">
        <h2>Skapa konto</h2>
        {error && <p className="auth-error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="inviteCode">Inbjudningskod</label>
            <input
              id="inviteCode"
              type="text"
              placeholder="Koden från inbjudan"
              autoComplete="off"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="displayName">Ditt namn</label>
            <input
              id="displayName"
              type="text"
              placeholder="Visas i appen"
              autoComplete="name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">E-postadress</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Lösenord</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Minst 6 tecken"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm">Bekräfta lösenord</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Registrerar…' : 'Skapa konto'}
          </button>
        </form>
        <p className="auth-switch">
          Har du redan ett konto? <Link to="/login">Logga in här</Link>
        </p>
      </div>
    </div>
  )
}
