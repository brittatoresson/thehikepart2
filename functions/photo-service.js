const { HttpsError } = require('firebase-functions/v2/https')

const GUEST_DELETE_CUTOFF = Date.parse('2027-06-06T22:00:00.000Z') // 7 juni 2027 kl. 00.00 i Sverige (CEST)
// Skiljer stängd borttagning från andra failed-precondition-fel i klienten.
const GUEST_DELETE_CLOSED = 'guest-delete-closed'

async function deletePhotoRecord({ db, bucket, uid, photoId, now = Date.now() }) {
  if (typeof photoId !== 'string' || !photoId || photoId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Ogiltig bild.')
  }

  const [profile, photoSnapshot] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('photos').doc(photoId).get(),
  ])
  if (!profile.exists) {
    throw new HttpsError('permission-denied', 'Användarprofilen saknas.')
  }
  const isAdmin = profile.data().role === 'admin'
  if (!photoSnapshot.exists) {
    throw new HttpsError('not-found', 'Bilden finns inte kvar.')
  }

  const photo = photoSnapshot.data()
  if (!isAdmin && photo.userId !== uid) {
    throw new HttpsError('permission-denied', 'Du kan bara ta bort bilder du själv har laddat upp.')
  }
  if (!isAdmin && now >= GUEST_DELETE_CUTOFF) {
    throw new HttpsError('failed-precondition', 'Gästers möjlighet att ta bort bilder har stängts.', {
      reason: GUEST_DELETE_CLOSED,
    })
  }

  const photoRef = db.collection('photos').doc(photoId)
  if (photo.storagePath) {
    const pathParts = photo.storagePath.split('/')
    if (
      !photo.storagePath.startsWith('photos/')
      || pathParts.length !== 2
      || pathParts.some(part => !part || part === '.' || part === '..')
    ) {
      throw new HttpsError('failed-precondition', 'Bildens lagringsplats är ogiltig.')
    }
    await bucket.file(photo.storagePath).delete({ ignoreNotFound: true })
  }

  try {
    await photoRef.delete()
  } catch (error) {
    console.error('Bildfilen togs bort men galleriposten kunde inte tas bort', {
      photoId,
      uid,
      code: error.code,
    }, error)
    throw new HttpsError('internal', 'Bildfilen togs bort men galleriposten kunde inte uppdateras. Kontakta admin.')
  }

  return { success: true }
}

module.exports = { GUEST_DELETE_CUTOFF, GUEST_DELETE_CLOSED, deletePhotoRecord }
