import { useEffect, useRef, useState } from 'react'
import seal from '../assets/seal.png'
import './IntroOverlay.css'

// Kuvertet ritas i två lager runt själva sidan: bakgrund, kuvertets baksida och
// flik ligger under sidan, fickan och sigillet ovanpå. Sidans egen animation
// (den stiger upp ur kuvertet och växer) styrs av klasserna app--intro och
// app--intro-leaving i AppShell. Tidpunkterna finns i IntroOverlay.css.
const FULL_DURATION = 4700
const LEAVE_DURATION = 550

export default function IntroOverlay({ onLeave, onDone }) {
  const [leaving, setLeaving] = useState(false)
  const frontRef = useRef(null)

  useEffect(() => {
    frontRef.current?.focus({ preventScroll: true })
    // Hjulrullning på dator får inte flytta sidan medan den animeras.
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    if (leaving) onLeave()
  }, [leaving, onLeave])

  useEffect(() => {
    const id = setTimeout(
      () => (leaving ? onDone() : setLeaving(true)),
      leaving ? LEAVE_DURATION : FULL_DURATION,
    )
    return () => clearTimeout(id)
  }, [leaving, onDone])

  function skip() {
    setLeaving(true)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
      event.preventDefault()
      skip()
    }
  }

  const leavingClass = leaving ? ' intro--leaving' : ''

  return (
    <>
      <div className={`intro-backdrop${leavingClass}`} aria-hidden="true">
        <div className="intro-stage">
          <div className="intro-env-part intro-env-back" />
          <div className="intro-env-part intro-flap-wrap">
            <div className="intro-flap">
              <div className="intro-flap-shape" />
            </div>
          </div>
          <div className="intro-shadow-clip">
            <div className="intro-card-shadow" />
          </div>
        </div>
      </div>

      <div
        ref={frontRef}
        className={`intro-front${leavingClass}`}
        role="button"
        tabIndex={0}
        aria-label="Välkomstanimation. Tryck för att hoppa över."
        onClick={skip}
        onKeyDown={handleKeyDown}
      >
        <div className="intro-stage" aria-hidden="true">
          <div className="intro-env-part intro-pocket-wrap">
            <div className="intro-pocket-shape" />
          </div>
          <img className="intro-seal" src={seal} alt="" />
        </div>
      </div>
    </>
  )
}
