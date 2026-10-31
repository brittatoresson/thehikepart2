// Söklänk till Spotify för en låtönskning. Webbspelaren och mobilappen öppnar
// formen open.spotify.com/search/<sökord> (motsvarar spotify:search:<sökord>).
// Den äldre formen /search/results/<sökord> öppnade inte sökningen korrekt.

export function spotifySearchQuery(song, artist) {
  return [song, artist]
    .map(part => (typeof part === 'string' ? part : '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
}

export function spotifySearchUrl(song, artist) {
  return `https://open.spotify.com/search/${encodeURIComponent(spotifySearchQuery(song, artist))}`
}
