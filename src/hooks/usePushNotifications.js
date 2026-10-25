import { useState, useEffect } from 'react'
import { getToken, onMessage } from 'firebase/messaging'
import { doc, updateDoc } from 'firebase/firestore'
import { messaging, db } from '../firebase'
import { useAuth } from '../context/AuthContext'

export function usePushNotifications() {
  const { currentUser } = useAuth()
  const [permissionState, setPermissionState] = useState(
    () => ('Notification' in window ? Notification.permission : 'denied')
  )
  const [toast, setToast] = useState(null)

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
        }
      } catch (err) {
        console.warn('Push setup:', err.message)
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
    if (!('Notification' in window) || !messaging) return
    try {
      const result = await Notification.requestPermission()
      setPermissionState(result)
    } catch (err) {
      console.warn('Permission request:', err.message)
    }
  }

  return { permissionState, requestPermission, toast, clearToast: () => setToast(null) }
}
