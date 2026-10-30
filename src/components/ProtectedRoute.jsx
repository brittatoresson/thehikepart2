import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function ProtectedRoute() {
  const { currentUser, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="auth-splash">
        <div className="auth-splash-dot" />
      </div>
    )
  }

  return currentUser ? <Outlet /> : <Navigate to="/login" replace state={{
    openOsa: location.pathname === '/' && new URLSearchParams(location.search).get('osa') === '1',
  }} />
}
