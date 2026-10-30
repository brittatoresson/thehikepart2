import { useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
} from 'firebase/auth'
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function register(email, password, displayName) {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    try {
      await updateProfile(user, { displayName })
      await setDoc(doc(db, 'users', user.uid), {
        displayName,
        email,
        role: 'guest',
        createdAt: serverTimestamp(),
      })
    } catch (error) {
      // Ta bort kontot igen så att gästen kan försöka på nytt med samma e-post
      // i stället för att fastna med ett konto utan profil.
      await deleteUser(user).catch(deleteError => {
        console.error('Kontot kunde inte tas bort efter misslyckad registrering', deleteError)
      })
      throw error
    }
    return user
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  function logout() {
    return signOut(auth)
  }

  useEffect(() => {
    let unsubscribeProfile = () => {}
    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      unsubscribeProfile()
      unsubscribeProfile = () => {}
      setCurrentUser(user)
      if (!user) {
        setUserProfile(null)
        setLoading(false)
        return
      }
      setLoading(true)
      // Lyssnar i stället för att läsa en gång: profilen skapas först efter att
      // kontot loggats in vid registrering, och läsningen får inte fastna offline.
      unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), snap => {
        setUserProfile(snap.exists() ? snap.data() : null)
        setLoading(false)
      }, error => {
        console.error('Kunde inte läsa användarprofilen', error)
        setUserProfile(null)
        setLoading(false)
      })
    })
    return () => {
      unsubscribeProfile()
      unsubscribeAuth()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, register, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
