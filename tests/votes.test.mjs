import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyVoteResult, replaceWish, sortByVotes, voteErrorMessage } from '../src/lib/votes.js'

const wishes = [
  { id: 'a', votes: ['other'], voteCount: 1 },
  { id: 'b', votes: [], voteCount: 0 },
]

test('a confirmed vote is added once and the list is re-sorted by votes', () => {
  const result = applyVoteResult(wishes, 'b', 'me', true, { voteCount: 2, voted: true })
  assert.deepEqual(result[0], { id: 'b', votes: ['me'], voteCount: 2 })
  const again = applyVoteResult(result, 'b', 'me', true, { voteCount: 2, voted: true })
  assert.deepEqual(again[0].votes, ['me'])
})

test('a reply without voted, from an older published function, counts as a saved vote', () => {
  const result = applyVoteResult(wishes, 'b', 'me', true, { voteCount: 1 })
  assert.deepEqual(result.find(wish => wish.id === 'b'), { id: 'b', votes: ['me'], voteCount: 1 })
})

test('a voted flag in the reply never overrides the requested state', () => {
  // En äldre publicerad funktion svarade med fel läge och dolde "Röstat"
  // tills sidan laddades om. Dokumentet läses om från servern i stället.
  const result = applyVoteResult(wishes, 'b', 'me', true, { voteCount: 1, voted: false })
  assert.deepEqual(result.find(wish => wish.id === 'b'), { id: 'b', votes: ['me'], voteCount: 1 })
})

test('the document read back from the server replaces the list entry and re-sorts', () => {
  const result = replaceWish(wishes, 'b', { votes: ['me', 'other'], voteCount: 2, song: 'Unwritten' })
  assert.deepEqual(result[0], { id: 'b', votes: ['me', 'other'], voteCount: 2, song: 'Unwritten' })
  assert.equal(result.length, 2)
})

test('a wish deleted on the server disappears from the list', () => {
  assert.deepEqual(replaceWish(wishes, 'b', null).map(wish => wish.id), ['a'])
})

test('a wish missing from the list is added when the server has it', () => {
  const result = replaceWish(wishes, 'c', { votes: [], voteCount: 0 })
  assert.deepEqual(result.map(wish => wish.id), ['a', 'b', 'c'])
})

test('removing a vote keeps other guests and counts the list when no count is returned', () => {
  const result = applyVoteResult([{ id: 'a', votes: ['other', 'me'], voteCount: 2 }], 'a', 'me', false, {})
  assert.deepEqual(result[0], { id: 'a', votes: ['other'], voteCount: 1 })
})

test('wishes created before votes existed can be voted on', () => {
  const result = applyVoteResult([{ id: 'old' }], 'old', 'me', true, undefined)
  assert.deepEqual(result[0], { id: 'old', votes: ['me'], voteCount: 1 })
})

test('sortByVotes returns a new array and treats a missing count as zero', () => {
  const input = [{ id: 'none' }, { id: 'two', voteCount: 2 }, { id: 'zero', voteCount: 0 }]
  const sorted = sortByVotes(input)
  assert.notEqual(sorted, input)
  assert.deepEqual(sorted.map(wish => wish.id), ['two', 'none', 'zero'])
})

test('vote errors are explained by cause', () => {
  assert.equal(voteErrorMessage({ code: 'functions/failed-precondition' }),
    'Du kan inte rösta på din egen önskning.')
  assert.equal(voteErrorMessage({ code: 'functions/unauthenticated' }), 'Logga in igen för att rösta.')
  assert.equal(voteErrorMessage({ code: 'functions/not-found', message: 'Musikönskningen finns inte kvar.' }),
    'Musikönskningen finns inte kvar.')
  assert.match(voteErrorMessage({ code: 'functions/not-found', message: 'not-found' }), /kunde inte nås/)
  assert.match(voteErrorMessage({ code: 'functions/internal', message: 'internal' }), /Kontrollera anslutningen/)
  assert.match(voteErrorMessage(new TypeError('Failed to fetch')), /Kontrollera anslutningen/)
  assert.match(voteErrorMessage(undefined), /Kontrollera anslutningen/)
})
