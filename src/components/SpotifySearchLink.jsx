import { spotifySearchQuery, spotifySearchUrl } from '../lib/spotify'

export default function SpotifySearchLink({ song, artist }) {
  const search = spotifySearchQuery(song, artist)
  if (!search) return null

  return (
    <a
      className="spotify-search-link"
      href={spotifySearchUrl(song, artist)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Lyssna på Spotify: sök efter ${search} (öppnas i ny flik)`}
    >
      Lyssna på Spotify
    </a>
  )
}
