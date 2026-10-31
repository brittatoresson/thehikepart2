import { lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Register from './pages/Register'

// Sidorna bakom inloggningen laddas vid behov så att första laddningen blir mindre.
const Home = lazy(() => import('./pages/Home'))
const FAQ = lazy(() => import('./pages/FAQ'))
const DressCode = lazy(() => import('./pages/DressCode'))
const MusicWishes = lazy(() => import('./pages/MusicWishes'))
const PhotoGallery = lazy(() => import('./pages/PhotoGallery'))
const Contact = lazy(() => import('./pages/Contact'))
const Admin = lazy(() => import('./pages/Admin'))

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Home />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/dress-code" element={<DressCode />} />
              <Route path="/music" element={<MusicWishes />} />
              <Route path="/gallery" element={<PhotoGallery />} />
              <Route path="/contact" element={<Contact />} />
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
