import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scaledSize, photoStoragePath, fileExtension, runWithConcurrency } from '../src/lib/photoUpload.js'

test('large photos are scaled so the longest edge is 2560 px, keeping the aspect ratio', () => {
  assert.deepEqual(scaledSize(4032, 3024), { width: 2560, height: 1920 })
  assert.deepEqual(scaledSize(3024, 4032), { width: 1920, height: 2560 })
})

test('photos already within the limit are never enlarged', () => {
  assert.deepEqual(scaledSize(1200, 800), { width: 1200, height: 800 })
  assert.deepEqual(scaledSize(2560, 2560), { width: 2560, height: 2560 })
})

test('storage paths match the rules pattern and stay unique within one batch', () => {
  const pattern = /^photos\/uid123_[0-9]+[.][^/]+$/
  const paths = [0, 1, 2].map(i => photoStoragePath('uid123', 1730000000000, i, 'jpg'))
  paths.forEach(path => assert.match(path, pattern))
  assert.equal(new Set(paths).size, 3)
})

test('file extensions are lowercased and fall back to jpg when missing or odd', () => {
  assert.equal(fileExtension('IMG_0001.JPG'), 'jpg')
  assert.equal(fileExtension('bild.heic'), 'heic')
  assert.equal(fileExtension('bild'), 'jpg')
  assert.equal(fileExtension('bild.j/pg'), 'jpg')
})

test('uploads run with limited concurrency and keep results in input order', async () => {
  let running = 0
  let maxRunning = 0
  const results = await runWithConcurrency([30, 10, 20, 5, 15], 3, async ms => {
    running++
    maxRunning = Math.max(maxRunning, running)
    await new Promise(resolve => setTimeout(resolve, ms))
    running--
    return ms
  })
  assert.equal(maxRunning, 3)
  assert.deepEqual(results.map(r => r.value), [30, 10, 20, 5, 15])
})

test('one failed upload does not stop the others', async () => {
  const results = await runWithConcurrency(['a', 'fail', 'c'], 2, async item => {
    if (item === 'fail') throw new Error('nätverksfel')
    return item
  })
  assert.deepEqual(results.map(r => r.status), ['fulfilled', 'rejected', 'fulfilled'])
})
