import { useState, useEffect, useCallback } from 'react'
import { getToken, onMessage } from 'firebase/messaging'
import { doc, updateDoc } from 'firebase/firestore'
import { messaging, db } from '../firebase'
import { useAuth } from '../context/useAuth'

export function usePushNotifications() {
  const { currentUser } = useAuth()
  const [permissionState, setPermissionState] = useState(
    () => ('Notification' in window && messaging ? Notification.permission : 'denied')
  )
  const [toast, setToast] = useState(null)
  const [error, setError] = useState('')
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!currentUser || !messaging || permissionState !== 'granted') return

    async function setupToken() {
      try {
        if (!('serviceWorker' in navigator)) return
        // Push hanteras av sw.js (registreras i main.jsx). En egen registrering på
        // samma scope skulle ersätta den och ta bort offline-cachen.
        const swReg = await navigator.serviceWorker.ready
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: swReg,
        })
        if (token) {
          await updateDoc(doc(db, 'users', currentUser.uid), { fcmToken: token })
          setError('')
        } else {
          setError('Notiser kunde inte aktiveras. Försök igen genom att ladda om sidan.')
        }
      } catch (err) {
        console.warn('Push setup:', err.message)
        setError('Notiser kunde inte aktiveras. Kontrollera anslutningen och ladda om sidan.')
      }
    }

    setupToken()

    const unsub = onMessage(messaging, payload => {
      const title = payload.notification?.title ?? 'June 5th'
      const body = payload.notification?.body ?? ''
      setToast({ title, body })
    })

    return unsub
  }, [currentUser, permissionState])

  async function requestPermission() {
    if (!('Notification' in window) || !messaging) {
      setError('Notiser stöds inte i den här webbläsaren.')
      return false
    }
    try {
      const result = await Notification.requestPermission()
      setPermissionState(result)
      setError('')
      return result !== 'default'
    } catch (err) {
      console.warn('Permission request:', err.message)
      setError('Notisbehörigheten kunde inte ändras. Försök igen.')
      return false
    }
  }

  return { permissionState, requestPermission, toast, clearToast, error }
}
