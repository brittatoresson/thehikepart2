export default function SpotifySearchLink({ song, artist }) {
  const search = [song, artist].filter(Boolean).join(' ')

  return (
    <a
      className="spotify-search-link"
      href={`https://open.spotify.com/search/results/${encodeURIComponent(search)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Lyssna på Spotify: sök efter ${search} (öppnas i ny flik)`}
    >
      Lyssna på Spotify
    </a>
  )
}
