import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')

function worker({ response = new Response('fresh'), cached, storageError, offline = false } = {}) {
  const listeners = {}
  const removed = []
  const warnings = []
  const cache = {
    put: async () => { if (storageError) throw storageError },
    match: async () => cached,
  }
  runInNewContext(source, {
    self: {
      location: { hostname: 'wedding.example', origin: 'https://wedding.example' },
      addEventListener: (name, callback) => { listeners[name] = callback },
      clients: { claim: async () => {} },
    },
    importScripts: () => {},
    console: { warn: (...args) => warnings.push(args) },
    Request,
    URL,
    caches: {
      keys: async () => ['june5th-v1', 'june5th-v2', 'june5th-v3', 'another-app'],
      delete: async name => { removed.push(name) },
      open: async () => cache,
      match: async () => cached,
    },
    fetch: async () => {
      if (offline) throw new Error('Offline')
      return response
    },
  })
  return {
    removed,
    warnings,
    activate: () => {
      let completed
      listeners.activate({ waitUntil: value => { completed = value } })
      return completed
    },
    request: (pathname, mode = 'navigate') => {
      let result
      listeners.fetch({
        request: { url: `https://wedding.example${pathname}`, method: 'GET', mode },
        respondWith: value => { result = value },
      })
      return result
    },
  }
}

test('activation removes only obsolete June 5th caches', async () => {
  const fixture = worker()
  await fixture.activate()
  assert.deepEqual(fixture.removed.sort(), ['june5th-v1', 'june5th-v2'])
})

test('a full cache does not replace a successful navigation with stale HTML', async () => {
  const fixture = worker({ storageError: new Error('Quota exceeded'), cached: new Response('stale') })
  const response = await fixture.request('/faq')
  assert.equal(await response.text(), 'fresh')
  assert.equal(fixture.warnings.length, 1)
})

test('a full cache does not break a successfully downloaded hashed asset', async () => {
  const fixture = worker({ storageError: new Error('Quota exceeded') })
  const response = await fixture.request('/assets/app-hash.js', 'cors')
  assert.equal(await response.text(), 'fresh')
  assert.equal(fixture.warnings.length, 1)
})

test('offline navigation returns the cached application shell', async () => {
  const fixture = worker({ offline: true, cached: new Response('offline shell') })
  const response = await fixture.request('/gallery')
  assert.equal(await response.text(), 'offline shell')
})
