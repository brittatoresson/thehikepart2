export const INTRO_STORAGE_KEY = 'june5th:introShownOn'

// Lokal kalenderdag, så att "första öppningen varje dag" följer gästens klocka.
export function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Intron visas första gången appen öppnas varje dag, eller alltid med ?intro=1
// (för att kunna förhandsgranska den igen).
export function shouldShowIntro({ lastShownOn, search = '', now = new Date() }) {
  if (new URLSearchParams(search).get('intro') === '1') return true
  return lastShownOn !== localDateKey(now)
}

// Gäster som bett systemet om mindre rörelse får ingen intro alls.
export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
