import { useState, useEffect, useMemo, useRef } from 'react'
import {
  collection, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { db, storage, functions } from '../firebase'
import { useAuth } from '../context/useAuth'
import UploaderFilter from '../components/UploaderFilter'
import { useLiveCollection } from '../hooks/useLiveCollection'

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

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export default function PhotoGallery() {
  const { currentUser, userProfile } = useAuth()
  const { items: photos, loading, error: loadError } = useLiveCollection('photos', 'createdAt', 'desc')
  const [selectedUploaders, setSelectedUploaders] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [fullscreen, setFullscreen] = useState(null)
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

  useEffect(() => {
    document.body.style.overflow = fullscreen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [fullscreen])

  async function handleFile(e) {
    const input = e.target
    const file = input.files?.[0]
    if (!file || uploadInFlight.current) return
    if (!file.type.startsWith('image/') || file.size >= 10 * 1024 * 1024) {
      setUploadError('Välj en bild som är mindre än 10 MiB.')
      input.value = ''
      return
    }

    uploadInFlight.current = true
    setUploading(true)
    setProgress(0)
    setUploadError(null)
    setUploadSuccess(false)

    let stage = 'upload'
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `photos/${currentUser.uid}_${Date.now()}.${ext}`
      const storageRef = ref(storage, path)
      const task = uploadBytesResumable(storageRef, file)
      task.on('state_changed', snap => {
        setProgress(snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0)
      })
      const snapshot = await task
      stage = 'save'
      const url = await getDownloadURL(snapshot.ref)
      await addDoc(collection(db, 'photos'), {
        url,
        storagePath: path,
        userId: currentUser.uid,
        displayName: userProfile?.displayName ?? 'Gäst',
        createdAt: serverTimestamp(),
      })
      setUploadSuccess(true)
    } catch (err) {
      console.error('Bilduppladdning misslyckades', { stage, code: err.code }, err)
      if (stage === 'save') {
        setUploadError('Bildfilen laddades upp men kunde inte läggas till i galleriet. Kontakta brudparet om bilden inte visas.')
      } else if (err.code === 'storage/unauthorized') {
        setUploadError('Du saknar behörighet att ladda upp bilden. Kontakta brudparet.')
      } else if (err.code === 'storage/retry-limit-exceeded') {
        setUploadError('Uppladdningen tog för lång tid. Kontrollera din anslutning och försök igen.')
      } else {
        setUploadError('Uppladdningen misslyckades. Kontrollera din anslutning och försök igen.')
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

      {uploadError && (
        <div className="upload-error-wrap" role="alert">
          <p className="upload-error-msg">{uploadError}</p>
        </div>
      )}

      {uploadSuccess && <p role="status">Bilden har lagts till i galleriet.</p>}
      {deleteError && <div className="upload-error-wrap" role="alert"><p className="upload-error-msg">{deleteError}</p></div>}
      {deleteSuccess && <p className="gallery-success" role="status">Bilden har tagits bort.</p>}

      {uploading ? (
        <div className="upload-progress-wrap">
          <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
          <p className="upload-progress-label" role="status">{progress === 100 ? 'Sparar i galleriet…' : `Laddar upp… ${progress}%`}</p>
        </div>
      ) : (
        <div className="gallery-actions">
          <button className="gallery-btn" onClick={() => cameraRef.current.click()}>
            <CameraIcon /> Ta foto
          </button>
          <button className="gallery-btn" onClick={() => fileRef.current.click()}>
            <ImageIcon /> Välj bild
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
                onClick={() => setFullscreen(photo)}
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

      {fullscreen && (
        <div className="gallery-fullscreen" onClick={() => setFullscreen(null)}>
          <button
            className="gallery-fullscreen-close"
            onClick={() => setFullscreen(null)}
            aria-label="Stäng"
          >
            <CloseIcon />
          </button>
          <img
            src={fullscreen.url}
            alt={`Foto av ${fullscreen.displayName}`}
            onClick={e => e.stopPropagation()}
          />
          <p className="gallery-fullscreen-caption">
            Foto av {fullscreen.displayName}
          </p>
        </div>
      )}
    </div>
  )
}
