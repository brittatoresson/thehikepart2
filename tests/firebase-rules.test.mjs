import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, test } from 'node:test'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage'

let env
const bytes = new Uint8Array([1, 2, 3])
const metadata = { contentType: 'image/jpeg' }
const photoPath = 'photos/guest_123.jpg'

before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    throw new Error('Run npm run test:rules; both emulators are required. Production must not be used.')
  }
  env = await initializeTestEnvironment({
    projectId: 'demo-june5th',
    firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') },
    storage: { rules: await readFile(new URL('../storage.rules', import.meta.url), 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.clearStorage()
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    await Promise.all([
      setDoc(doc(db, 'users/guest'), { role: 'guest', displayName: 'Guest' }),
      setDoc(doc(db, 'users/other'), { role: 'guest' }),
      setDoc(doc(db, 'users/admin'), { role: 'admin' }),
      setDoc(doc(db, 'photos/photo'), { userId: 'guest', storagePath: photoPath }),
      setDoc(doc(db, 'wishes/wish'), { userId: 'other', votes: [], voteCount: 0 }),
      setDoc(doc(db, 'rsvps/guest'), { attending: true }),
      uploadBytes(ref(context.storage(), photoPath), bytes, metadata),
    ])
  })
})

after(async () => { await env?.cleanup() })

test('registration allows only own guest profile', async () => {
  const db = env.authenticatedContext('new').firestore()
  await assertFails(setDoc(doc(db, 'users/new'), { role: 'admin' }))
  await assertFails(setDoc(doc(db, 'users/another'), { role: 'guest' }))
  await assertSucceeds(setDoc(doc(db, 'users/new'), { role: 'guest', displayName: 'New' }))
})

test('profile edits cannot change, remove or recreate role', async () => {
  for (const uid of ['guest', 'admin']) {
    const db = env.authenticatedContext(uid).firestore()
    await assertSucceeds(updateDoc(doc(db, `users/${uid}`), { displayName: 'Updated' }))
    await assertFails(updateDoc(doc(db, `users/${uid}`), { role: uid === 'guest' ? 'admin' : 'guest' }))
    await assertFails(setDoc(doc(db, `users/${uid}`), { displayName: 'No role' }))
    await assertFails(deleteDoc(doc(db, `users/${uid}`)))
  }
})

test('profiles are private to owner and admin; admin can list guests', async () => {
  const guest = env.authenticatedContext('guest').firestore()
  await assertSucceeds(getDoc(doc(guest, 'users/guest')))
  await assertFails(getDoc(doc(guest, 'users/other')))
  await assertFails(getDocs(collection(guest, 'users')))
  await assertSucceeds(getDocs(collection(env.authenticatedContext('admin').firestore(), 'users')))
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/guest')))
})

test('photos require own uploader ID and own storage path', async () => {
  const db = env.authenticatedContext('guest').firestore()
  await assertSucceeds(setDoc(doc(db, 'photos/new'), { userId: 'guest', storagePath: 'photos/guest_456.jpg' }))
  await assertFails(setDoc(doc(db, 'photos/forged-owner'), { userId: 'other', storagePath: photoPath }))
  await assertFails(setDoc(doc(db, 'photos/forged-file'), { userId: 'guest', storagePath: 'photos/other_123.jpg' }))
  await assertFails(setDoc(doc(db, 'photos/missing-path'), { userId: 'guest' }))
})

test('direct photo deletion and metadata changes denied even for admin; reads allowed', async () => {
  for (const uid of ['guest', 'other', 'admin']) {
    const photo = doc(env.authenticatedContext(uid).firestore(), 'photos/photo')
    await assertSucceeds(getDoc(photo))
    await assertFails(deleteDoc(photo))
    await assertFails(updateDoc(photo, { storagePath: 'photos/other_123.jpg' }))
  }
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'photos/photo')))
})

test('image upload and read work, but overwriting and direct deletion are blocked', async () => {
  const storage = env.authenticatedContext('guest').storage()
  await assertSucceeds(uploadBytes(ref(storage, 'photos/guest_456.jpg'), bytes, metadata))
  await assertSucceeds(getBytes(ref(storage, photoPath)))
  await assertFails(uploadBytes(ref(storage, photoPath), bytes, metadata))
  await assertFails(uploadBytes(ref(storage, 'photos/other_456.jpg'), bytes, metadata))
  for (const uid of ['guest', 'other', 'admin']) {
    await assertFails(deleteObject(ref(env.authenticatedContext(uid).storage(), photoPath)))
  }
})

test('upload rejects anonymous users, non-images, nested paths and files at 10 MiB', async () => {
  const storage = env.authenticatedContext('guest').storage()
  await assertFails(uploadBytes(ref(env.unauthenticatedContext().storage(), 'photos/guest_789.jpg'), bytes, metadata))
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), photoPath)))
  await assertFails(uploadBytes(ref(storage, 'photos/guest_789.txt'), bytes, { contentType: 'text/plain' }))
  await assertFails(uploadBytes(ref(storage, 'photos/nested/guest_789.jpg'), bytes, metadata))
  await assertSucceeds(uploadBytes(ref(storage, 'photos/guest_888.jpg'), new Uint8Array(10 * 1024 * 1024 - 1), metadata))
  await assertFails(uploadBytes(ref(storage, 'photos/guest_999.jpg'), new Uint8Array(10 * 1024 * 1024), metadata))
})

test('music creation and admin moderation work; client voting and forged ownership denied', async () => {
  const db = env.authenticatedContext('guest').firestore()
  const wish = { userId: 'guest', song: 'Song', votes: [], voteCount: 0 }
  await assertSucceeds(setDoc(doc(db, 'wishes/new'), wish))
  await assertFails(setDoc(doc(db, 'wishes/forged'), { ...wish, userId: 'other' }))
  await assertFails(setDoc(doc(db, 'wishes/pre-voted'), { ...wish, votes: ['guest'], voteCount: 1 }))
  await assertFails(updateDoc(doc(db, 'wishes/wish'), { votes: ['guest'], voteCount: 1 }))
  await assertFails(updateDoc(doc(db, 'wishes/wish'), { status: 'approved' }))
  const adminWish = doc(env.authenticatedContext('admin').firestore(), 'wishes/wish')
  await assertSucceeds(updateDoc(adminWish, { status: 'approved' }))
  await assertFails(updateDoc(adminWish, { voteCount: 50 }))
  await assertSucceeds(deleteDoc(adminWish))
})

test('OSA remains writable by owner and readable by admin only', async () => {
  const db = env.authenticatedContext('guest').firestore()
  await assertSucceeds(setDoc(doc(db, 'rsvps/guest'), { attending: false }))
  await assertFails(getDoc(doc(env.authenticatedContext('other').firestore(), 'rsvps/guest')))
  await assertSucceeds(getDocs(collection(env.authenticatedContext('admin').firestore(), 'rsvps')))
})

test('notification queue remains admin-only and FAQ writes stay server-only', async () => {
  await assertFails(setDoc(doc(env.authenticatedContext('guest').firestore(), 'notification_queue/new'), { title: 'No' }))
  const db = env.authenticatedContext('admin').firestore()
  await assertSucceeds(setDoc(doc(db, 'notification_queue/new'), { title: 'Yes' }))
  await assertFails(setDoc(doc(db, 'siteContent/faq'), { items: [] }))
})

test('Admin SDK equivalent bypass can still delete photo data and files', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await assertSucceeds(deleteObject(ref(context.storage(), photoPath)))
    await assertSucceeds(deleteDoc(doc(context.firestore(), 'photos/photo')))
  })
})
