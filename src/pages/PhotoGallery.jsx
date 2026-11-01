import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  collection, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { db, storage, functions } from '../firebase'
import { useAuth } from '../context/useAuth'
import UploaderFilter from '../components/UploaderFilter'
import PhotoViewer from '../components/PhotoViewer'
import { useLiveCollection } from '../hooks/useLiveCollection'
import {
  MAX_UPLOAD_BYTES, UPLOAD_CONCURRENCY, compressImage, fileExtension, photoStoragePath, runWithConcurrency,
} from '../lib/photoUpload'
import galleriIllustration from '../assets/galleri-illustration.jpg'

function uploadErrorMessage(err) {
  if (err.stage === 'too-large') return 'Bilden är för stor, välj en bild som är mindre än 10 MiB.'
  if (err.stage === 'save') return 'Bildfilen laddades upp men kunde inte läggas till i galleriet. Kontakta brudparet om bilden inte visas.'
  if (err.code === 'storage/unauthorized') return 'Du saknar behörighet att ladda upp bilden. Kontakta brudparet.'
  if (err.code === 'storage/retry-limit-exceeded') return 'Uppladdningen tog för lång tid. Kontrollera din anslutning och försök igen.'
  return 'Uppladdningen misslyckades. Kontrollera din anslutning och försök igen.'
}

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

const ImageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)

// Öppen bild ligger i adressen (?bild=<id>) så att telefonens bakåtknapp stänger den.
const PHOTO_PARAM = 'bild'

export default function PhotoGallery() {
  const { currentUser, userProfile } = useAuth()
  const { items: photos, loading, error: loadError } = useLiveCollection('photos', 'createdAt', 'desc')
  const [selectedUploaders, setSelectedUploaders] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadCount, setUploadCount] = useState({ done: 0, total: 0 })
  const [uploadError, setUploadError] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteSuccess, setDeleteSuccess] = useState(false)
  const cameraRef = useRef()
  const fileRef = useRef()
  const uploadInFlight = useRef(false)
  const uploaders = useMemo(() => {
    const byId = new Map()
    photos.forEach(photo => {
      if (photo.userId && !byId.has(photo.userId)) {
        byId.set(photo.userId, photo.displayName || 'Gäst')
      }
    })
    return [...byId].map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, [photos])
  const visiblePhotos = useMemo(
    () => selectedUploaders.length === 0 ? photos : photos.filter(photo => selectedUploaders.includes(photo.userId)),
    [photos, selectedUploaders],
  )

  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const openId = searchParams.get(PHOTO_PARAM)
  const openIndex = openId ? visiblePhotos.findIndex(photo => photo.id === openId) : -1

  function paramsWithPhoto(id) {
    const next = new URLSearchParams(searchParams)
    if (id) next.set(PHOTO_PARAM, id)
    else next.delete(PHOTO_PARAM)
    return next
  }

  function openPhoto(photo) {
    setSearchParams(paramsWithPhoto(photo.id), { state: { photoViewer: true } })
  }

  // Öppnades bilden här går vi tillbaka i historiken, så att bakåtknappen och
  // krysset gör samma sak. En direktlänk till en bild har inget steg att gå tillbaka till.
  function closePhoto() {
    if (location.state?.photoViewer) navigate(-1)
    else setSearchParams(paramsWithPhoto(null), { replace: true })
  }

  // Svep byter bild utan nytt historiksteg, så bakåt stänger alltid visningen direkt.
  function showPhoto(index) {
    setSearchParams(paramsWithPhoto(visiblePhotos[index].id), { replace: true, state: location.state })
  }

  // Bilden finns inte (borttagen eller okänd länk): ta bort den ur adressen.
  useEffect(() => {
    if (openId && !loading && openIndex === -1) {
      const next = new URLSearchParams(searchParams)
      next.delete(PHOTO_PARAM)
      setSearchParams(next, { replace: true })
    }
  }, [openId, loading, openIndex, searchParams, setSearchParams])

  async function uploadOne(file, index, batchTime, bytes) {
    const compressed = await compressImage(file)
    if (compressed.size >= MAX_UPLOAD_BYTES) {
      throw Object.assign(new Error('Bilden är för stor'), { stage: 'too-large' })
    }
    const path = photoStoragePath(currentUser.uid, batchTime, index, fileExtension(compressed.name))
    const task = uploadBytesResumable(ref(storage, path), compressed, { contentType: compressed.type })
    task.on('state_changed', snap => {
      bytes[index] = { sent: snap.bytesTransferred, total: snap.totalBytes }
      const sent = bytes.reduce((sum, b) => sum + b.sent, 0)
      const total = bytes.reduce((sum, b) => sum + b.total, 0)
      setProgress(total > 0 ? Math.round((sent / total) * 100) : 0)
    })
    let snapshot
    try {
      snapshot = await task
    } catch (err) {
      err.stage = 'upload'
      throw err
    }
    try {
      const url = await getDownloadURL(snapshot.ref)
      await addDoc(collection(db, 'photos'), {
        url,
        storagePath: path,
        userId: currentUser.uid,
        displayName: userProfile?.displayName ?? 'Gäst',
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      err.stage = 'save'
      throw err
    }
  }

  async function handleFile(e) {
    const input = e.target
    const files = [...(input.files ?? [])].filter(file => file.type.startsWith('image/'))
    if (uploadInFlight.current) return
    if (files.length === 0) {
      if (input.files?.length) setUploadError('Välj bilder i ett bildformat.')
      input.value = ''
      return
    }

    uploadInFlight.current = true
    setUploading(true)
    setProgress(0)
    setUploadCount({ done: 0, total: files.length })
    setUploadError(null)
    setUploadSuccess(0)

    try {
      const batchTime = Date.now()
      const bytes = files.map(() => ({ sent: 0, total: 0 }))
      const results = await runWithConcurrency(files, UPLOAD_CONCURRENCY, async (file, index) => {
        await uploadOne(file, index, batchTime, bytes)
        setUploadCount(count => ({ ...count, done: count.done + 1 }))
      })
      const failures = results.filter(result => result.status === 'rejected').map(result => result.reason)
      failures.forEach(err => console.error('Bilduppladdning misslyckades', { stage: err.stage, code: err.code }, err))
      setUploadSuccess(files.length - failures.length)
      if (failures.length > 0) {
        const prefix = files.length > 1 ? `${failures.length} av ${files.length} bilder kunde inte laddas upp. ` : ''
        setUploadError(prefix + uploadErrorMessage(failures[0]))
      }
    } finally {
      input.value = ''
      uploadInFlight.current = false
      setUploading(false)
      setProgress(0)
    }
  }

  async function deleteOwnPhoto() {
    if (!confirmDelete || deleting) return
    setDeleting(true)
    setDeleteError('')
    setDeleteSuccess(false)
    try {
      await httpsCallable(functions, 'deletePhoto')({ photoId: confirmDelete.id })
      setConfirmDelete(null)
      setDeleteSuccess(true)
    } catch (error) {
      console.error('Kunde inte ta bort egen bild', { code: error.code }, error)
      setDeleteError(error.code === 'functions/failed-precondition' && error.details?.reason === 'guest-delete-closed'
        ? 'Gästers möjlighet att ta bort bilder har stängts.'
        : error.code === 'functions/failed-precondition'
          ? 'Bilden kunde inte tas bort på grund av ett fel i galleriet. Kontakta brudparet.'
          : error.code === 'functions/permission-denied'
            ? 'Du kan bara ta bort bilder du själv har laddat upp.'
            : error.code === 'functions/not-found'
              ? 'Bilden finns inte kvar i galleriet.'
              : 'Bilden kunde inte tas bort. Kontrollera anslutningen och försök igen.')
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Bildgalleri</h1>
        <p className="page-subtitle">Dela era minnen</p>
      </div>
      <img
        className="page-illustration"
        src={galleriIllustration}
        alt="Britta och Johanna, tecknade, en fotograferar och en poserar"
        decoding="async"
      />

      {uploadError && (
        <div className="upload-error-wrap" role="alert">
          <p className="upload-error-msg">{uploadError}</p>
        </div>
      )}

      {uploadSuccess > 0 && (
        <p role="status">
          {uploadSuccess === 1 ? 'Bilden har lagts till i galleriet.' : `${uploadSuccess} bilder har lagts till i galleriet.`}
        </p>
      )}
      {deleteError && <div className="upload-error-wrap" role="alert"><p className="upload-error-msg">{deleteError}</p></div>}
      {deleteSuccess && <p className="gallery-success" role="status">Bilden har tagits bort.</p>}

      {uploading ? (
        <div className="upload-progress-wrap">
          <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
          <p className="upload-progress-label" role="status">
            {progress === 100
              ? 'Sparar i galleriet…'
              : uploadCount.total > 1
                ? `Laddar upp ${uploadCount.done} av ${uploadCount.total} bilder… ${progress}%`
                : `Laddar upp… ${progress}%`}
          </p>
        </div>
      ) : (
        <div className="gallery-actions">
          <button className="gallery-btn" onClick={() => cameraRef.current.click()}>
            <CameraIcon /> Ta foto
          </button>
          <button className="gallery-btn" onClick={() => fileRef.current.click()}>
            <ImageIcon /> Välj bilder
          </button>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        hidden
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFile}
        hidden
      />

      {photos.length > 0 && (
        <UploaderFilter
          uploaders={uploaders}
          selectedIds={selectedUploaders}
          onChange={ids => {
            setSelectedUploaders(ids)
            setDeleteSuccess(false)
          }}
        />
      )}

      {loading && <p role="status">Hämtar bilder…</p>}
      {loadError && <p className="auth-error" role="alert">{loadError}</p>}
      {!loading && !loadError && photos.length === 0 && !uploading ? (
        <p className="gallery-empty">
          Inga bilder ännu — ladda upp det första minnet!
        </p>
      ) : !loading && !loadError && visiblePhotos.length === 0 && !uploading ? (
        <p className="gallery-empty">Inga bilder från valda uppladdare ännu.</p>
      ) : (
        <div className="gallery-grid">
          {visiblePhotos.map(photo => (
            <div className="gallery-photo" key={photo.id}>
              <button
                className="gallery-item"
                onClick={() => openPhoto(photo)}
                aria-label={`Foto av ${photo.displayName}`}
              >
                <img src={photo.url} alt="" loading="lazy" />
                <span className="gallery-item-name">{photo.displayName}</span>
              </button>
              {photo.userId === currentUser.uid && (
                <button
                  type="button"
                  className="gallery-photo-delete"
                  onClick={() => {
                    setConfirmDelete(photo)
                    setDeleteError('')
                    setDeleteSuccess(false)
                  }}
                  aria-label={`Ta bort egen bild uppladdad av ${photo.displayName}`}
                >
                  Ta bort
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="confirm-overlay" role="presentation" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="confirm-box" role="dialog" aria-modal="true" aria-labelledby="gallery-delete-title" onClick={event => event.stopPropagation()}>
            <p className="confirm-msg" id="gallery-delete-title">Ta bort den här bilden permanent? Det går inte att ångra.</p>
            <div className="confirm-actions">
              <button type="button" className="confirm-cancel" onClick={() => setConfirmDelete(null)} disabled={deleting}>Avbryt</button>
              <button type="button" className="confirm-delete" onClick={deleteOwnPhoto} disabled={deleting}>
                {deleting ? 'Tar bort…' : 'Ta bort bild'}
              </button>
            </div>
          </div>
        </div>
      )}

      {openIndex !== -1 && (
        <PhotoViewer
          photos={visiblePhotos}
          index={openIndex}
          onIndexChange={showPhoto}
          onClose={closePhoto}
        />
      )}
    </div>
  )
}
