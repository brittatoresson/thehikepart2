import { useEffect, useId, useRef, useState } from 'react'

export default function UploaderFilter({ uploaders, selectedIds, onChange }) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const searchRef = useRef(null)
  const searchId = useId()
  const menuId = useId()
  const matchingUploaders = uploaders.filter(uploader =>
    uploader.name.toLocaleLowerCase('sv').includes(search.trim().toLocaleLowerCase('sv')),
  )
  const selectionLabel = selectedIds.length === 0
    ? 'Alla uppladdare'
    : uploaders.filter(uploader => selectedIds.includes(uploader.id)).map(uploader => uploader.name).join(', ') || 'Valda uppladdare'

  useEffect(() => {
    if (isOpen) searchRef.current?.focus()
  }, [isOpen])

  function close() {
    setIsOpen(false)
    setSearch('')
  }

  useEffect(() => {
    function closeOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  return (
    <div className="gallery-filter">
      <span className="gallery-filter-label">Visa bilder från</span>
      <div
        className="gallery-uploader-select"
        ref={containerRef}
        onKeyDown={event => {
          if (event.key === 'Escape' && isOpen) {
            event.preventDefault()
            event.stopPropagation()
            close()
            triggerRef.current?.focus()
          }
        }}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) close()
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          className="gallery-uploader-trigger"
          aria-expanded={isOpen}
          aria-controls={menuId}
          aria-label={`Visa bilder från: ${selectionLabel}`}
          onClick={() => {
            if (isOpen) close()
            else setIsOpen(true)
          }}
        >
          <span>{selectionLabel}</span>
          <span aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
        </button>
        {isOpen && <div className="gallery-uploader-menu" id={menuId}>
          <label className="gallery-uploader-search" htmlFor={searchId}>
            Sök uppladdare
            <input
              ref={searchRef}
              id={searchId}
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Skriv ett namn"
              autoComplete="off"
            />
          </label>
          <button type="button" className="gallery-filter-clear" onClick={() => onChange([])} disabled={selectedIds.length === 0}>
            Rensa val – visa alla
          </button>
          <fieldset className="gallery-uploader-options">
            <legend>Välj uppladdare</legend>
            {matchingUploaders.map(uploader => (
              <label className="gallery-uploader-option" key={uploader.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(uploader.id)}
                  onChange={event => onChange(event.target.checked
                    ? [...selectedIds, uploader.id]
                    : selectedIds.filter(id => id !== uploader.id))}
                />
                <span>{uploader.name}</span>
              </label>
            ))}
            {matchingUploaders.length === 0 && (
              <p className="gallery-filter-empty" role="status">Ingen uppladdare matchar sökningen.</p>
            )}
          </fieldset>
        </div>}
      </div>
    </div>
  )
}
