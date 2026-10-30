const { test } = require('node:test')
const assert = require('node:assert/strict')
const { getFirestore } = require('firebase-admin/firestore')
const { buildGuestCsv } = require('./guest-export')
const { getMessaging } = require('firebase-admin/messaging')
const { voteForWish, exportGuests, getFaqs, saveFaqs, deletePhoto, sendPushNotification } = require('./index')
const { normalizeFaqs } = require('./faq-service')
const { GUEST_DELETE_CUTOFF, GUEST_DELETE_CLOSED, deletePhotoRecord } = require('./photo-service')
const defaultFaqs = require('./faq-defaults.json')

test('CSV contains all RSVP people, declining and unanswered registrations', () => {
  const users = [
    { id: 'one', displayName: 'Åsa', email: 'asa@example.test' },
    { id: 'two', displayName: 'Östen', email: 'osten@example.test' },
    { id: 'three', displayName: 'Elsa', email: 'elsa@example.test' },
  ]
  const rsvps = new Map([
    ['one', { attending: true, guests: [
      { name: 'Åsa', dietary: 'Nötallergi, vegetarisk' },
      { name: 'Bo', dietary: '' },
    ] }],
    ['two', { attending: false, guests: [
      { name: 'Östen', dietary: 'Ska inte exporteras' },
      { name: 'Eva', dietary: 'Ska inte exporteras' },
    ] }],
  ])
  assert.equal(buildGuestCsv(users, rsvps), '\uFEFF' + [
    '"Namn";"E-post";"Närvaro";"Allergier / matpreferenser";"Registrerad av"',
    '"Åsa";"asa@example.test";"Kommer";"Nötallergi, vegetarisk";"Åsa"',
    '"Bo";"asa@example.test";"Kommer";"";"Åsa"',
    '"Östen";"osten@example.test";"Kommer ej";"";"Östen"',
    '"Eva";"osten@example.test";"Kommer ej";"";"Östen"',
    '"Elsa";"elsa@example.test";"Ej svarat";"";"Elsa"',
    '',
  ].join('\r\n'))
})

test('CSV preserves legacy declining replies without a guest list', () => {
  const csv = buildGuestCsv(
    [{ id: 'legacy', displayName: 'Kontakt', email: 'kontakt@example.test' }],
    new Map([['legacy', { attending: false, guests: [] }]]),
  )
  assert.ok(csv.includes('"Kontakt";"kontakt@example.test";"Kommer ej";"";"Kontakt"'))
})

test('CSV escapes separators, quotes and newlines and protects against Excel formulas', () => {
  const csv = buildGuestCsv(
    [{ id: 'one', displayName: '=HYPERLINK("bad")', email: '+unsafe' }],
    new Map([['one', { attending: true, guests: [
      { name: 'Anna; "Annie"\nÖberg', dietary: '@SUM(1)' },
      { name: '-1', dietary: '\tformula' },
      { name: '  =1+1', dietary: 'Glutenfri\nLaktosfri' },
    ] }]]),
  )
  assert.ok(csv.includes('"Anna; ""Annie""\nÖberg"'))
  for (const value of ['+unsafe', '@SUM(1)', '-1', '\tformula', '  =1+1']) {
    assert.ok(csv.includes(`"'${value}"`))
  }
  assert.ok(csv.includes('"' + "'=HYPERLINK(" + '""bad"")"'))
  assert.ok(csv.includes('"Glutenfri\nLaktosfri"'))
})

test('CSV includes RSVPs without a user profile and handles empty data', () => {
  const csv = buildGuestCsv([], new Map([
    ['removed-user', { displayName: 'Kontakt', attending: true, guests: [{ name: 'Gäst' }] }],
  ]))
  assert.ok(csv.includes('"Gäst";"";"Kommer";"";"Kontakt"'))
  assert.equal(buildGuestCsv([], new Map()).split('\r\n').length, 2)
})

test('voting requires authentication and a valid document ID', async () => {
  await assert.rejects(voteForWish.run({ data: { wishId: 'song' } }), { code: 'unauthenticated' })
  for (const wishId of [undefined, '', 'wishes/song', 42]) {
    await assert.rejects(voteForWish.run({ auth: { uid: 'guest' }, data: { wishId } }),
      { code: 'invalid-argument' })
  }
  await assert.rejects(voteForWish.run({ auth: { uid: 'guest' }, data: { wishId: 'song', voted: 'false' } }),
    { code: 'invalid-argument' })
})

test('voting and removing a vote are idempotent and preserve other votes', async t => {
  const db = getFirestore()
  let wish = { userId: 'owner', votes: ['first'], voteCount: 99 }
  const updates = []
  const wishRef = {}
  t.mock.method(db, 'collection', name => {
    assert.equal(name, 'wishes')
    return { doc: id => { assert.equal(id, 'song'); return wishRef } }
  })
  t.mock.method(db, 'runTransaction', async callback => callback({
    get: async reference => {
      assert.equal(reference, wishRef)
      return { exists: true, data: () => wish }
    },
    update: (reference, data) => {
      assert.equal(reference, wishRef)
      updates.push(data)
      wish = { ...wish, ...data }
    },
  }))
  const request = { auth: { uid: 'second' }, data: { wishId: 'song' } }
  assert.deepEqual(await voteForWish.run(request), { voteCount: 2, voted: true })
  assert.deepEqual(await voteForWish.run(request), { voteCount: 2, voted: true })
  assert.equal(updates.length, 1)
  assert.deepEqual(wish.votes, ['first', 'second'])
  const remove = { ...request, data: { wishId: 'song', voted: false } }
  assert.deepEqual(await voteForWish.run(remove), { voteCount: 1, voted: false })
  assert.deepEqual(await voteForWish.run(remove), { voteCount: 1, voted: false })
  assert.deepEqual(wish.votes, ['first'])
  assert.equal(updates.length, 2)
  await assert.rejects(voteForWish.run({ ...request, auth: { uid: 'owner' } }),
    { code: 'failed-precondition' })
  assert.equal(updates.length, 2)
})

test('a transaction retry preserves another guest vote', async t => {
  const db = getFirestore()
  const wishRef = {}
  t.mock.method(db, 'collection', () => ({ doc: () => wishRef }))
  let finalUpdate
  t.mock.method(db, 'runTransaction', async callback => {
    await callback({
      get: async () => ({ exists: true, data: () => ({ userId: 'owner', votes: [] }) }),
      update: () => {},
    })
    return callback({
      get: async () => ({ exists: true, data: () => ({ userId: 'owner', votes: ['other'] }) }),
      update: (reference, data) => { finalUpdate = data },
    })
  })
  assert.deepEqual(await voteForWish.run({ auth: { uid: 'guest' }, data: { wishId: 'song' } }),
    { voteCount: 2, voted: true })
  assert.deepEqual(finalUpdate, { votes: ['other', 'guest'], voteCount: 2 })
})

test('a deleted wish returns a visible not-found error', async t => {
  const db = getFirestore()
  t.mock.method(db, 'collection', () => ({ doc: () => ({}) }))
  t.mock.method(db, 'runTransaction', callback => callback({
    get: async () => ({ exists: false }),
  }))
  await assert.rejects(voteForWish.run({ auth: { uid: 'guest' }, data: { wishId: 'deleted' } }),
    { code: 'not-found' })
})

test('export rejects unauthenticated users without reading guest data', async t => {
  const db = getFirestore()
  const collection = t.mock.method(db, 'collection', () => assert.fail('Unexpected data read'))
  await assert.rejects(exportGuests.run({}), { code: 'unauthenticated' })
  assert.equal(collection.mock.callCount(), 0)
})

test('export rejects guests and missing profiles before reading lists', async t => {
  const db = getFirestore()
  let profile
  t.mock.method(db, 'collection', name => {
    assert.equal(name, 'users')
    return { doc: () => ({ get: async () => profile }) }
  })
  for (profile of [
    { exists: false },
    { exists: true, data: () => ({ role: 'guest' }) },
  ]) {
    await assert.rejects(exportGuests.run({ auth: { uid: 'guest' }, data: { role: 'admin' } }),
      { code: 'permission-denied' })
  }
})

test('export reads the admin role on the server and returns a combined CSV', async t => {
  const db = getFirestore()
  t.mock.method(db, 'collection', name => {
    if (name === 'users') return {
      doc: uid => {
        assert.equal(uid, 'admin')
        return { get: async () => ({ exists: true, data: () => ({ role: 'admin' }) }) }
      },
      get: async () => ({ docs: [
        { id: 'guest', data: () => ({ displayName: 'Gäst', email: 'guest@example.test' }) },
      ] }),
    }
    assert.equal(name, 'rsvps')
    return { get: async () => ({ docs: [
      { id: 'guest', data: () => ({ attending: true, guests: [{ name: 'Gäst', dietary: 'Vegan' }] }) },
    ] }) }
  })
  const result = await exportGuests.run({ auth: { uid: 'admin' } })
  assert.deepEqual(Object.keys(result), ['csv'])
  assert.ok(result.csv.includes('"Gäst";"guest@example.test";"Kommer";"Vegan";"Gäst"'))
})

test('export propagates database errors rather than returning a partial file', async t => {
  const db = getFirestore()
  t.mock.method(db, 'collection', () => ({
    doc: () => ({ get: async () => ({ exists: true, data: () => ({ role: 'admin' }) }) }),
    get: async () => { throw new Error('Database unavailable') },
  }))
  await assert.rejects(exportGuests.run({ auth: { uid: 'admin' } }), /Database unavailable/)
})

test('FAQ normalization trims text and rejects invalid or duplicate entries', () => {
  assert.deepEqual(normalizeFaqs([{ id: 'first', q: '  Fråga? ', a: ' Svar.  ' }]),
    [{ id: 'first', q: 'Fråga?', a: 'Svar.' }])
  for (const items of [
    null,
    [{ id: 'bad/id', q: 'Fråga?', a: 'Svar.' }],
    [{ id: 'same', q: 'Fråga?', a: 'Svar.' }, { id: 'same', q: 'Fråga 2?', a: 'Svar 2.' }],
    [{ id: 'empty', q: ' ', a: 'Svar.' }],
    [{ id: 'long', q: 'Fråga?', a: 'x'.repeat(4001) }],
  ]) {
    assert.throws(() => normalizeFaqs(items), TypeError)
  }
})

test('FAQ reads require a signed-in profile and return defaults before first save', async t => {
  await assert.rejects(getFaqs.run({}), { code: 'unauthenticated' })
  const db = getFirestore()
  t.mock.method(db, 'collection', name => {
    if (name === 'users') return { doc: () => ({ get: async () => ({ exists: true }) }) }
    assert.equal(name, 'siteContent')
    return { doc: () => ({ get: async () => ({ exists: false }) }) }
  })
  assert.deepEqual(await getFaqs.run({ auth: { uid: 'guest' } }), { items: defaultFaqs, version: 0 })
})

test('FAQ returns the saved content and version to authenticated guests', async t => {
  const db = getFirestore()
  const items = [{ id: 'saved', q: 'Ny fråga?', a: 'Nytt svar.' }]
  t.mock.method(db, 'collection', name => {
    if (name === 'users') return { doc: () => ({ get: async () => ({ exists: true }) }) }
    assert.equal(name, 'siteContent')
    return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ items, version: 4 }) }) }) }
  })
  assert.deepEqual(await getFaqs.run({ auth: { uid: 'guest' } }), { items, version: 4 })
})

test('FAQ rejects admin writes from unauthenticated users and guests', async t => {
  const db = getFirestore()
  let role = 'guest'
  const transaction = t.mock.method(db, 'runTransaction', () => assert.fail('Guest must not write FAQ'))
  t.mock.method(db, 'collection', name => {
    assert.equal(name, 'users')
    return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ role }) }) }) }
  })
  await assert.rejects(saveFaqs.run({ data: { items: [], version: 0 } }), { code: 'unauthenticated' })
  await assert.rejects(saveFaqs.run({ auth: { uid: 'guest' }, data: { items: [], version: 0 } }),
    { code: 'permission-denied' })
  role = undefined
  assert.equal(transaction.mock.callCount(), 0)
})

test('FAQ saves a validated full list atomically and rejects stale admin versions', async t => {
  const db = getFirestore()
  const faqRef = {}
  const items = [{ id: 'new', q: 'Ny fråga?', a: 'Nytt svar.' }]
  let currentVersion = 0
  let saved
  t.mock.method(db, 'collection', name => {
    if (name === 'users') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ role: 'admin' }) }) }) }
    assert.equal(name, 'siteContent')
    return { doc: id => { assert.equal(id, 'faq'); return faqRef } }
  })
  t.mock.method(db, 'runTransaction', callback => callback({
    get: async reference => {
      assert.equal(reference, faqRef)
      return { exists: currentVersion > 0, data: () => ({ version: currentVersion }) }
    },
    set: (reference, value) => {
      assert.equal(reference, faqRef)
      saved = value
      currentVersion = value.version
    },
  }))
  const result = await saveFaqs.run({ auth: { uid: 'admin' }, data: { items, version: 0 } })
  assert.deepEqual(result, { items, version: 1 })
  assert.deepEqual(saved.items, items)
  assert.equal(saved.version, 1)
  await assert.rejects(saveFaqs.run({ auth: { uid: 'admin' }, data: { items, version: 0 } }),
    { code: 'aborted' })
})

test('FAQ save rejects malformed data before writing', async t => {
  const db = getFirestore()
  const transaction = t.mock.method(db, 'runTransaction', () => assert.fail('Invalid FAQ must not write'))
  t.mock.method(db, 'collection', name => {
    assert.equal(name, 'users')
    return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ role: 'admin' }) }) }) }
  })
  await assert.rejects(saveFaqs.run({
    auth: { uid: 'admin' },
    data: { items: [{ id: 'x', q: '', a: 'Svar' }], version: 0 },
  }), { code: 'invalid-argument' })
  await assert.rejects(saveFaqs.run({
    auth: { uid: 'admin' },
    data: { items: [], version: -1 },
  }), { code: 'invalid-argument' })
  assert.equal(transaction.mock.callCount(), 0)
})

function createPhotoDeleteFixture({ role = 'guest', photo = {}, storageError, documentError } = {}) {
  const operations = []
  const profileRef = { get: async () => ({ exists: true, data: () => ({ role }) }) }
  const photoRef = {
    get: async () => ({ exists: true, data: () => photo }),
    delete: async () => {
      operations.push('document')
      if (documentError) throw documentError
    },
  }
  const db = {
    collection: name => ({
      doc: id => {
        operations.push(`read:${name}:${id}`)
        return name === 'users' ? profileRef : photoRef
      },
    }),
  }
  const bucket = {
    file: path => ({
      delete: async options => {
        operations.push(`storage:${path}:${options.ignoreNotFound}`)
        if (storageError) throw storageError
      },
    }),
  }
  return { db, bucket, operations }
}

test('guest deletes own photo file and metadata before the deadline', async () => {
  const fixture = createPhotoDeleteFixture({
    photo: { userId: 'guest', storagePath: 'photos/guest_123.jpg' },
  })
  assert.deepEqual(await deletePhotoRecord({
    ...fixture,
    uid: 'guest',
    photoId: 'photo',
    now: GUEST_DELETE_CUTOFF - 1,
  }), { success: true })
  assert.ok(fixture.operations.includes('storage:photos/guest_123.jpg:true'))
  assert.equal(fixture.operations.at(-1), 'document')
})

test('guest cannot delete another guest photo', async () => {
  const fixture = createPhotoDeleteFixture({
    photo: { userId: 'owner', storagePath: 'photos/owner_123.jpg' },
  })
  await assert.rejects(deletePhotoRecord({
    ...fixture,
    uid: 'guest',
    photoId: 'photo',
    now: GUEST_DELETE_CUTOFF - 1,
  }), { code: 'permission-denied' })
  assert.equal(fixture.operations.some(operation => operation.startsWith('storage:')), false)
  assert.equal(fixture.operations.includes('document'), false)
})

test('guest deletion is denied at the Monday Stockholm cutoff', async () => {
  const fixture = createPhotoDeleteFixture({
    photo: { userId: 'guest', storagePath: 'photos/guest_123.jpg' },
  })
  await assert.rejects(deletePhotoRecord({
    ...fixture,
    uid: 'guest',
    photoId: 'photo',
    now: GUEST_DELETE_CUTOFF,
  }), { code: 'failed-precondition', details: { reason: GUEST_DELETE_CLOSED } })
  assert.equal(fixture.operations.some(operation => operation.startsWith('storage:')), false)
})

test('admin can delete a photo after the guest cutoff', async () => {
  const fixture = createPhotoDeleteFixture({
    role: 'admin',
    photo: { userId: 'guest', storagePath: 'photos/guest_123.jpg' },
  })
  assert.deepEqual(await deletePhotoRecord({
    ...fixture,
    uid: 'admin',
    photoId: 'photo',
    now: GUEST_DELETE_CUTOFF + 1,
  }), { success: true })
  assert.equal(fixture.operations.at(-1), 'document')
})

test('photo deletion rejects unsafe storage paths and preserves metadata on storage errors', async () => {
  const unsafe = createPhotoDeleteFixture({ photo: { userId: 'guest', storagePath: 'other/file.jpg' } })
  await assert.rejects(deletePhotoRecord({
    ...unsafe,
    uid: 'guest',
    photoId: 'photo',
    now: GUEST_DELETE_CUTOFF - 1,
  }), error => {
    // Får inte förväxlas med att tiden för borttagning har gått ut.
    assert.equal(error.code, 'failed-precondition')
    assert.notEqual(error.details?.reason, GUEST_DELETE_CLOSED)
    return true
  })
  assert.equal(unsafe.operations.includes('document'), false)

  const storageFailure = createPhotoDeleteFixture({
    photo: { userId: 'guest', storagePath: 'photos/guest_123.jpg' },
    storageError: new Error('Storage unavailable'),
  })
  await assert.rejects(deletePhotoRecord({
    ...storageFailure,
    uid: 'guest',
    photoId: 'photo',
    now: GUEST_DELETE_CUTOFF - 1,
  }), /Storage unavailable/)
  assert.equal(storageFailure.operations.includes('document'), false)
})

test('photo delete callable requires authentication', async () => {
  await assert.rejects(deletePhoto.run({ data: { photoId: 'photo' } }), { code: 'unauthenticated' })
})

function createPushFixture(t, users) {
  const db = getFirestore()
  const logged = []
  t.mock.method(db, 'collection', name => {
    if (name === 'users') return { get: async () => ({ size: users.length, docs: users.map(data => ({ data: () => data })) }) }
    assert.equal(name, 'notifications')
    return { add: async data => { logged.push(data) } }
  })
  const send = t.mock.method(getMessaging(), 'sendEachForMulticast', async ({ tokens }) => ({
    successCount: tokens.length,
    failureCount: 0,
  }))
  let deleted = false
  const event = {
    data: {
      data: () => ({ title: 'Välkomna', body: 'Middagen serveras', sentBy: 'Britta' }),
      ref: { delete: async () => { deleted = true } },
    },
  }
  return { event, logged, send, wasDeleted: () => deleted }
}

test('push is logged in history even when no guest has enabled notifications', async t => {
  const fixture = createPushFixture(t, [{ displayName: 'Gäst' }])
  await sendPushNotification.run(fixture.event)
  assert.equal(fixture.send.mock.callCount(), 0)
  assert.equal(fixture.logged.length, 1)
  assert.equal(fixture.logged[0].successCount, 0)
  assert.equal(fixture.logged[0].failureCount, 0)
  assert.equal(fixture.wasDeleted(), true)
})

test('push is sent to stored tokens and the result is logged', async t => {
  const fixture = createPushFixture(t, [{ fcmToken: 'a' }, { fcmToken: 'b' }, {}])
  await sendPushNotification.run(fixture.event)
  assert.deepEqual(fixture.send.mock.calls[0].arguments[0].tokens, ['a', 'b'])
  assert.equal(fixture.logged[0].successCount, 2)
  assert.equal(fixture.logged[0].sentBy, 'Britta')
  assert.equal(fixture.wasDeleted(), true)
})

test('push deduplicates tokens and splits more than 500 recipients into batches', async t => {
  const users = Array.from({ length: 501 }, (_, index) => ({ fcmToken: `token-${index}` }))
  const fixture = createPushFixture(t, [...users, users[0], {}])
  await sendPushNotification.run(fixture.event)
  assert.equal(fixture.send.mock.callCount(), 2)
  assert.equal(fixture.send.mock.calls[0].arguments[0].tokens.length, 500)
  assert.deepEqual(fixture.send.mock.calls[1].arguments[0].tokens, ['token-500'])
  assert.equal(fixture.logged[0].successCount, 501)
  assert.equal(fixture.logged[0].failureCount, 0)
  assert.equal(fixture.wasDeleted(), true)
})

test('push aggregates delivery failures across batches', async t => {
  const fixture = createPushFixture(t, Array.from({ length: 501 }, (_, index) => ({ fcmToken: `token-${index}` })))
  fixture.send.mock.mockImplementation(async ({ tokens }) => ({
    successCount: tokens.length - 1,
    failureCount: 1,
  }))
  await sendPushNotification.run(fixture.event)
  assert.equal(fixture.logged[0].successCount, 499)
  assert.equal(fixture.logged[0].failureCount, 2)
})

test('FAQ defaults include confirmed dress code, indoor ceremony and evening bus', () => {
  const byId = Object.fromEntries(defaultFaqs.map(item => [item.id, item]))
  assert.equal(byId['dress-code'].a, 'Mörk kostym')
  assert.match(byId.ceremony.a, /Vigseln hålls inomhus/)
  assert.match(byId['evening-bus'].a, /festlokalen till Linköpings centrum/)
  assert.equal(byId.transport.q, 'Hur funkar transport under dagen?')
  assert.deepEqual(normalizeFaqs(defaultFaqs), defaultFaqs)
})
