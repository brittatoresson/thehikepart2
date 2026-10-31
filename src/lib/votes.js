// Hjälpfunktioner för röstning på musikönskningar. Fria från React så att de
// kan testas med node --test (se tests/votes.test.mjs).

export function sortByVotes(wishes) {
  return [...wishes].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
}

// Uppdaterar listan optimistiskt efter ett lyckat anrop till voteForWish: det
// begärda läget visas direkt och `voteCount` tas från svaret när det finns.
// Flaggan `voted` i svaret används inte. En äldre publicerad funktion kan
// svara utan den eller med ett annat läge än det sparade, och då skrev den
// över det Firestore-lyssnaren redan visat. Facit är dokumentet på servern,
// som läses om efter varje röstförsök (se replaceWish).
export function applyVoteResult(wishes, wishId, uid, voted, data) {
  return sortByVotes(wishes.map(wish => {
    if (wish.id !== wishId) return wish
    const others = (wish.votes ?? []).filter(voter => voter !== uid)
    const votes = voted ? [...others, uid] : others
    const voteCount = typeof data?.voteCount === 'number' ? data.voteCount : votes.length
    return { ...wish, votes, voteCount }
  }))
}

// Ersätter en önskning med dokumentet som lästs från servern, eller tar bort
// den ur listan när dokumentet inte längre finns.
export function replaceWish(wishes, wishId, latest) {
  if (!latest) return wishes.filter(wish => wish.id !== wishId)
  const updated = { ...latest, id: wishId }
  return sortByVotes(wishes.some(wish => wish.id === wishId)
    ? wishes.map(wish => (wish.id === wishId ? updated : wish))
    : [...wishes, updated])
}

export function voteErrorMessage(error) {
  switch (error?.code) {
    case 'functions/failed-precondition':
      return 'Du kan inte rösta på din egen önskning.'
    case 'functions/unauthenticated':
      return 'Logga in igen för att rösta.'
    case 'functions/not-found':
      // Serverfunktionens egna fel är svenska meningar. Ett blankt "not-found"
      // kommer från SDK:t när funktionen inte finns publicerad i regionen.
      return /\s/.test(error.message ?? '')
        ? error.message
        : 'Röstfunktionen kunde inte nås. Försök igen om en stund.'
    default:
      return 'Kunde inte registrera din röst. Kontrollera anslutningen och försök igen.'
  }
}
