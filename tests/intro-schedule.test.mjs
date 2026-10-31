import test from 'node:test'
import assert from 'node:assert/strict'
import { localDateKey, shouldShowIntro } from '../src/introSchedule.js'

test('local date key is zero-padded and follows local time', () => {
  assert.equal(localDateKey(new Date(2027, 5, 5, 14, 0)), '2027-06-05')
  assert.equal(localDateKey(new Date(2026, 10, 1, 0, 0)), '2026-11-01')
})

test('intro shows on the first open of a day and not again that day', () => {
  const morning = new Date(2026, 9, 31, 8, 15)
  const evening = new Date(2026, 9, 31, 22, 45)
  assert.equal(shouldShowIntro({ lastShownOn: null, now: morning }), true)
  assert.equal(shouldShowIntro({ lastShownOn: '2026-10-30', now: morning }), true)
  assert.equal(shouldShowIntro({ lastShownOn: '2026-10-31', now: evening }), false)
})

test('a new local day starts at midnight', () => {
  const beforeMidnight = new Date(2026, 9, 31, 23, 59)
  const afterMidnight = new Date(2026, 10, 1, 0, 1)
  assert.equal(shouldShowIntro({ lastShownOn: '2026-10-31', now: beforeMidnight }), false)
  assert.equal(shouldShowIntro({ lastShownOn: '2026-10-31', now: afterMidnight }), true)
})

test('?intro=1 forces the intro even when it already played today', () => {
  const now = new Date(2026, 9, 31, 12, 0)
  assert.equal(shouldShowIntro({ lastShownOn: '2026-10-31', search: '?intro=1', now }), true)
  assert.equal(shouldShowIntro({ lastShownOn: '2026-10-31', search: '?intro=0', now }), false)
  assert.equal(shouldShowIntro({ lastShownOn: '2026-10-31', search: '?osa=1', now }), false)
})
