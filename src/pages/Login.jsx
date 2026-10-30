import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import AuthHeader from '../components/AuthHeader'

const ERROR_MESSAGES = {
  'auth/user-not-found': 'Ingen användare med den e-postadressen.',
  'auth/wrong-password': 'Felaktigt lösenord.',
  'auth/invalid-credential': 'Felaktig e-postadress eller lösenord.',
  'auth/invalid-email': 'Ogiltig e-postadress.',
  'auth/too-many-requests': 'För många försök. Vänta en stund och försök igen.',
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(location.state?.openOsa ? '/?osa=1' : '/')
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
        <h2>Logga in</h2>
        {error && <p className="auth-error">{error}</p>}
        <form onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Loggar in…' : 'Logga in'}
          </button>
        </form>
        <p className="auth-switch">
          Ny gäst? <Link to="/register" state={location.state}>Registrera dig här</Link>
        </p>
      </div>
    </div>
  )
}
