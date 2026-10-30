import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function AdminRoute() {
  const { userProfile, loading } = useAuth()
  if (loading) return null
  if (userProfile?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}
