import { useAuth } from '../context/useAuth'

const COUPLE_EMAIL = 'britta.toresson@gmail.com,johanna.norell@live.com'
const TOASTMASTER_EMAIL = 'toastmaster@june5th.se' // TODO: uppdatera med rätt adress

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)

const MicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
)

export default function Contact() {
  const { userProfile } = useAuth()

  const guestName = encodeURIComponent(userProfile?.displayName ?? 'Gäst')
  const coupleMailto = `mailto:${COUPLE_EMAIL}?subject=Fr%C3%A5ga%20fr%C3%A5n%20g%C3%A4st`
  const toastmasterMailto = `mailto:${TOASTMASTER_EMAIL}?subject=Anm%C3%A4lan%20%E2%80%93%20${guestName}`

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Kontakt</h1>
        <p className="page-subtitle">Vi hör gärna från er</p>
      </div>

      <p className="contact-intro">
        Har ni frågor inför den stora dagen?
        Tveka inte att höra av er!
      </p>

      <div className="contact-list">
        <a href={coupleMailto} className="contact-card contact-card-link">
          <span className="contact-icon"><MailIcon /></span>
          <div className="contact-card-info">
            <h3>Skriv till brudparet</h3>
            <p>Skicka ett mail till brudparet</p>
          </div>
        </a>

        <a href={toastmasterMailto} className="contact-card contact-card-link">
          <span className="contact-icon"><MicIcon /></span>
          <div className="contact-card-info">
            <h3>Anmäl tal, lek eller aktivitet</h3>
            <p>Skickas till toastmaster</p>
          </div>
        </a>
      </div>

    </div>
  )
}
