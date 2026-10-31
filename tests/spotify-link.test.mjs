import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spotifySearchQuery, spotifySearchUrl } from '../src/lib/spotify.js'

test('the link uses the open.spotify.com/search form that the web player and app open', () => {
  assert.equal(spotifySearchUrl('Unwritten', 'Natasha Bedingfield'),
    'https://open.spotify.com/search/Unwritten%20Natasha%20Bedingfield')
})

test('a missing artist and stray whitespace do not leak into the search', () => {
  assert.equal(spotifySearchQuery('  Unwritten ', undefined), 'Unwritten')
  assert.equal(spotifySearchQuery('Unwritten', '  '), 'Unwritten')
  assert.equal(spotifySearchQuery('Dancing   Queen', 'ABBA'), 'Dancing Queen ABBA')
  assert.equal(spotifySearchUrl('Unwritten', ''), 'https://open.spotify.com/search/Unwritten')
})

test('slashes, question marks and ampersands stay inside the search text', () => {
  assert.equal(spotifySearchUrl('Back in Black', 'AC/DC'),
    'https://open.spotify.com/search/Back%20in%20Black%20AC%2FDC')
  assert.equal(spotifySearchUrl('What Is Love?', 'Haddaway'),
    'https://open.spotify.com/search/What%20Is%20Love%3F%20Haddaway')
  assert.equal(spotifySearchUrl('Shallow', 'Lady Gaga & Bradley Cooper'),
    'https://open.spotify.com/search/Shallow%20Lady%20Gaga%20%26%20Bradley%20Cooper')
})

test('an empty wish gives no search text, so no link is rendered', () => {
  assert.equal(spotifySearchQuery('', ''), '')
  assert.equal(spotifySearchQuery(undefined, null), '')
})
