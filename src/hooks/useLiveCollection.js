import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'

export function useLiveCollection(name, sortField, direction = 'asc') {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const source = collection(db, name)
    const subscription = sortField ? query(source, orderBy(sortField, direction)) : source
    return onSnapshot(subscription, snapshot => {
      setItems(snapshot.docs.map(document => ({ ...document.data(), id: document.id })))
      setLoading(false)
      setError('')
    }, cause => {
      console.error(`Kunde inte hämta ${name}`, cause)
      setError('Listan kunde inte hämtas. Kontrollera anslutningen och ladda om sidan.')
      setLoading(false)
    })
  }, [name, sortField, direction])

  return { items, loading, error }
}
