const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')
const { getStorage } = require('firebase-admin/storage')
const { buildGuestCsv } = require('./guest-export')
const { normalizeFaqs } = require('./faq-service')
const { deletePhotoRecord } = require('./photo-service')
const defaultFaqs = require('./faq-defaults.json')

initializeApp()

exports.voteForWish = onCall({ region: 'europe-west1' }, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Logga in för att rösta.')
  }
  const wishId = request.data?.wishId
  if (typeof wishId !== 'string' || !wishId || wishId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Ogiltig musikönskning.')
  }
  const voted = request.data?.voted ?? true
  if (typeof voted !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Ogiltigt röstval.')
  }

  const db = getFirestore()
  const wishRef = db.collection('wishes').doc(wishId)
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(wishRef)
    if (!snapshot.exists) {
      throw new HttpsError('not-found', 'Musikönskningen finns inte kvar.')
    }
    const wish = snapshot.data()
    const uid = request.auth.uid
    if (wish.userId === uid && voted) {
      throw new HttpsError('failed-precondition', 'Du kan inte rösta på din egen önskning.')
    }
    const votes = wish.votes ?? []
    if (votes.includes(uid) === voted) {
      return { voteCount: votes.length, voted }
    }
    const updatedVotes = voted ? [...votes, uid] : votes.filter(voter => voter !== uid)
    transaction.update(wishRef, { votes: updatedVotes, voteCount: updatedVotes.length })
    return { voteCount: updatedVotes.length, voted }
  })
})

exports.exportGuests = onCall({ region: 'europe-west1' }, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Logga in för att exportera gästlistan.')
  }
  const db = getFirestore()
  const profile = await db.collection('users').doc(request.auth.uid).get()
  if (!profile.exists || profile.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Endast admin kan exportera gästlistan.')
  }
  const [usersSnapshot, rsvpsSnapshot] = await Promise.all([
    db.collection('users').get(),
    db.collection('rsvps').get(),
  ])
  const users = usersSnapshot.docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id }))
  const rsvps = new Map(rsvpsSnapshot.docs.map(snapshot => [snapshot.id, snapshot.data()]))
  return { csv: buildGuestCsv(users, rsvps) }
})

exports.getFaqs = onCall({ region: 'europe-west1' }, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Logga in för att läsa vanliga frågor.')
  }
  const db = getFirestore()
  const snapshot = await db.collection('users').doc(request.auth.uid).get()
  if (!snapshot.exists) {
    throw new HttpsError('permission-denied', 'Användarprofilen saknas.')
  }
  const faqSnapshot = await db.collection('siteContent').doc('faq').get()
  if (!faqSnapshot.exists) {
    return { items: defaultFaqs, version: 0 }
  }
  const data = faqSnapshot.data()
  try {
    return {
      items: normalizeFaqs(data.items),
      version: Number.isSafeInteger(data.version) && data.version >= 0 ? data.version : 0,
    }
  } catch (error) {
    console.error('FAQ-data i Firestore är ogiltig', error)
    throw new HttpsError('internal', 'FAQ-innehållet kunde inte läsas.')
  }
})

exports.saveFaqs = onCall({ region: 'europe-west1' }, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Logga in som admin för att ändra FAQ.')
  }
  const db = getFirestore()
  const profile = await db.collection('users').doc(request.auth.uid).get()
  if (!profile.exists || profile.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Endast admin kan ändra FAQ.')
  }

  let items
  try {
    items = normalizeFaqs(request.data?.items)
  } catch (error) {
    throw new HttpsError('invalid-argument', error.message)
  }
  const expectedVersion = request.data?.version
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    throw new HttpsError('invalid-argument', 'FAQ-versionen saknas eller är ogiltig.')
  }

  const faqRef = db.collection('siteContent').doc('faq')
  return db.runTransaction(async transaction => {
    const current = await transaction.get(faqRef)
    const currentVersion = current.exists ? current.data().version ?? 0 : 0
    if (currentVersion !== expectedVersion) {
      throw new HttpsError('aborted', 'FAQ har ändrats av någon annan. Hämta den senaste versionen och försök igen.')
    }
    const version = currentVersion + 1
    transaction.set(faqRef, { items, version, updatedAt: new Date() })
    return { items, version }
  })
})

exports.deletePhoto = onCall({ region: 'europe-west1' }, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Logga in för att ta bort en bild.')
  }
  return deletePhotoRecord({
    db: getFirestore(),
    bucket: getStorage().bucket(),
    uid: request.auth.uid,
    photoId: request.data?.photoId,
  })
})

exports.sendPushNotification = onDocumentCreated(
  { document: 'notification_queue/{docId}', region: 'europe-west1' },
  async event => {
    const { title, body, sentBy } = event.data.data()
    const db = getFirestore()

    const usersSnap = await db.collection('users').get()
    const tokens = [...new Set(usersSnap.docs.map(d => d.data().fcmToken).filter(Boolean))]
    console.log(`Users: ${usersSnap.size}, tokens found: ${tokens.length}`)

    let successCount = 0
    let failureCount = 0
    if (tokens.length > 0) {
      for (let offset = 0; offset < tokens.length; offset += 500) {
        const response = await getMessaging().sendEachForMulticast({
          tokens: tokens.slice(offset, offset + 500),
          notification: { title, body },
          webpush: { notification: { icon: '/favicon.svg' } },
        })
        successCount += response.successCount
        failureCount += response.failureCount
      }
      console.log(`FCM sent: success=${successCount} fail=${failureCount}`)
    }

    // Loggas även utan mottagare, så att admin ser att notisen inte nådde någon.
    await db.collection('notifications').add({
      title,
      body,
      sentBy: sentBy ?? 'Admin',
      sentAt: new Date(),
      successCount,
      failureCount,
    })

    await event.data.ref.delete()
  }
)
