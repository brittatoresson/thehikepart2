// Hjälpfunktioner för bilduppladdning till galleriet. Bilder skalas ner i
// webbläsaren innan uppladdning: en mobilbild på 3–8 MB blir under 1 MB,
// vilket gör både uppladdningen och galleriet snabbare.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // Samma gräns som storage.rules.
export const MAX_EDGE = 2560
export const JPEG_QUALITY = 0.85
export const UPLOAD_CONCURRENCY = 3

// Ny storlek med längsta sidan högst maxEdge; mindre bilder förstoras aldrig.
export function scaledSize(width, height, maxEdge = MAX_EDGE) {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

// Filnamnet måste matcha <uid>_<siffror>.<ändelse> i storage- och firestore-reglerna.
// Index läggs till tidsstämpeln så att parallella uppladdningar inte krockar.
export function photoStoragePath(uid, timestamp, index, ext) {
  return `photos/${uid}_${timestamp}${String(index).padStart(3, '0')}.${ext}`
}

export function fileExtension(name) {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
  return /^[a-z0-9]+$/.test(ext) ? ext : 'jpg'
}

// Kör worker för varje element med högst limit samtidigt. Returnerar resultat
// i samma ordning som items, i formatet från Promise.allSettled.
export async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  async function lane() {
    while (next < items.length) {
      const index = next++
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
  return results
}

// Skalar ner och komprimerar en bild till JPEG. Faller tillbaka på originalfilen
// om webbläsaren inte kan avkoda formatet (t.ex. HEIC) eller om resultatet inte
// blir mindre. GIF lämnas orörda så att animationer behålls.
export async function compressImage(file) {
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  try {
    const { width, height } = scaledSize(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]*$/, '') + '.jpg', { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}
