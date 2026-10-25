import { useEffect, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import defaultFaqs from '../../functions/faq-defaults.json'
import FaqAnswer from '../components/FaqAnswer'

export default function FAQ() {
  const [faqs, setFaqs] = useState(defaultFaqs)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    httpsCallable(functions, 'getFaqs')()
      .then(({ data }) => {
        if (active) {
          setFaqs(data.items)
          setLoadError('')
        }
      })
      .catch(error => {
        console.error('Kunde inte hämta FAQ', error)
        if (active) {
          setLoadError(error.code === 'functions/not-found'
            ? 'FAQ-funktionen är inte publicerad i Firebase ännu. Visar de inbyggda frågorna tills den har publicerats.'
            : 'De senaste FAQ-ändringarna kunde inte hämtas. Visar senast inbyggda frågor i stället.')
        }
      })

    return () => { active = false }
  }, [retry])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Vanliga frågor</h1>
        <p className="page-subtitle">Allt ni behöver veta</p>
      </div>
      {loadError && (
        <div className="faq-load-error" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => setRetry(value => value + 1)}>Försök igen</button>
        </div>
      )}
      <div className="faq-list">
        {faqs.map(({ id, q, a }) => (
          <details className="faq-item" key={id}>
            <summary>{q}</summary>
            <p className="faq-answer"><FaqAnswer text={a} /></p>
          </details>
        ))}
      </div>
    </div>
  )
}
