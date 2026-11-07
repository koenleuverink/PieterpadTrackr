import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, ImagePlus, MapPin, Pencil, Trash2, X } from 'lucide-react'
import type { Photo } from '../db/types'
import { addPhotos } from '../lib/photos'
import { useFeedback } from './Feedback'
import { Button, inputClass } from './ui'
import { updateRecord } from '../db/repo'
import { dateLong } from '../lib/format'
import { ensurePhotoBlob } from '../lib/sync'

/** Object-URL voor een blob, netjes opgeruimd. */
export function useBlobUrl(blob?: Blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url])
  return url
}

export function PhotoThumb({ photo, onClick, className = '' }: { photo: Photo; onClick?: () => void; className?: string }) {
  const url = useBlobUrl(photo.thumb ?? photo.blob)
  useEffect(() => {
    if (!photo.thumb && !photo.blob && photo.remotePath) void ensurePhotoBlob(photo)
  }, [photo])
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative block aspect-square overflow-hidden rounded-xl bg-surface-2 ${className}`}
      aria-label={photo.caption ? `Foto: ${photo.caption}` : `Foto van ${dateLong(photo.takenAt?.slice(0, 10))}`}
    >
      {url ? <img src={url} alt="" loading="lazy" className="size-full object-cover" /> : <span className="text-sm text-muted">Laden…</span>}
    </button>
  )
}

export function PhotoGrid({ photos, emptyText }: { photos: Photo[]; emptyText?: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const sorted = useMemo(() => [...photos].sort((a, b) => (a.takenAt ?? '').localeCompare(b.takenAt ?? '')), [photos])
  if (!sorted.length) return emptyText ? <p className="text-muted">{emptyText}</p> : null
  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {sorted.map((p, i) => (
          <li key={p.id}>
            <PhotoThumb photo={p} onClick={() => setOpen(i)} className="w-full" />
          </li>
        ))}
      </ul>
      {open !== null && <PhotoViewer photos={sorted} start={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function Slide({ photo }: { photo: Photo }) {
  const url = useBlobUrl(photo.blob ?? photo.thumb)
  useEffect(() => {
    if (!photo.blob && photo.remotePath) void ensurePhotoBlob(photo)
  }, [photo])
  return url ? <img src={url} alt={photo.caption || ''} className="max-h-full max-w-full object-contain" /> : <span className="text-white/70">Laden…</span>
}

/** Volledig scherm met swipen (scroll-snap), pijltjestoetsen en bijschrift bewerken. */
export function PhotoViewer({ photos, start, onClose }: { photos: Photo[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start)
  const [editing, setEditing] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const { deleteWithUndo } = useFeedback()
  const photo = photos[index]

  useEffect(() => {
    const s = scroller.current
    if (s) s.scrollTo({ left: start * s.clientWidth, behavior: 'instant' as ScrollBehavior })
  }, [start])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  })

  useEffect(() => {
    if (!photos.length) onClose()
    else if (index >= photos.length) setIndex(photos.length - 1)
  }, [photos.length, index, onClose])

  const go = (d: number) => {
    const s = scroller.current
    if (!s) return
    const next = Math.max(0, Math.min(photos.length - 1, index + d))
    s.scrollTo({ left: next * s.clientWidth, behavior: 'smooth' })
  }

  if (!photo) return null

  return (
    <div role="dialog" aria-modal="true" aria-label="Foto’s bekijken" className="fixed inset-0 z-[2500] flex flex-col bg-black text-white">
      <div className="safe-top flex items-center justify-between gap-2 px-2 py-1">
        <button type="button" onClick={onClose} className="flex size-12 items-center justify-center rounded-full hover:bg-white/10" aria-label="Sluiten">
          <X className="size-7" aria-hidden />
        </button>
        <span className="text-sm font-semibold" aria-live="polite">
          {index + 1} / {photos.length}
        </span>
        <div className="flex">
          <button type="button" onClick={() => setEditing(true)} className="flex size-12 items-center justify-center rounded-full hover:bg-white/10" aria-label="Bijschrift bewerken">
            <Pencil className="size-6" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => deleteWithUndo('photo', photo.id, 'foto')}
            className="flex size-12 items-center justify-center rounded-full hover:bg-white/10"
            aria-label="Foto verwijderen"
          >
            <Trash2 className="size-6" aria-hidden />
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        className="snap-x-mandatory no-scrollbar flex flex-1 overflow-x-auto"
        onScroll={(e) => {
          const s = e.currentTarget
          const i = Math.round(s.scrollLeft / s.clientWidth)
          if (i !== index) {
            setIndex(i)
            setEditing(false)
          }
        }}
      >
        {photos.map((p) => (
          <div key={p.id} className="snap-center flex h-full w-full shrink-0 items-center justify-center p-2">
            <Slide photo={p} />
          </div>
        ))}
      </div>
      <button type="button" onClick={() => go(-1)} className="absolute top-1/2 left-1 hidden size-12 items-center justify-center rounded-full bg-black/40 sm:flex" aria-label="Vorige foto">
        <ChevronLeft className="size-8" aria-hidden />
      </button>
      <button type="button" onClick={() => go(1)} className="absolute top-1/2 right-1 hidden size-12 items-center justify-center rounded-full bg-black/40 sm:flex" aria-label="Volgende foto">
        <ChevronRight className="size-8" aria-hidden />
      </button>
      <div className="safe-bottom px-4 pt-2 pb-4">
        {editing ? (
          <CaptionEditor photo={photo} onDone={() => setEditing(false)} />
        ) : (
          <>
            {photo.caption && <p className="font-serif text-lg">{photo.caption}</p>}
            <p className="flex items-center gap-2 text-sm text-white/75">
              {photo.takenAt && <span>{dateLong(photo.takenAt.slice(0, 10))}</span>}
              {photo.lat != null && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden /> locatie bekend
                </span>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function CaptionEditor({ photo, onDone }: { photo: Photo; onDone: () => void }) {
  const [text, setText] = useState(photo.caption ?? '')
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        await updateRecord('photo', photo.id, { caption: text.trim() })
        onDone()
      }}
    >
      <label className="sr-only" htmlFor="caption">
        Bijschrift
      </label>
      <input id="caption" autoFocus value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} text-ink`} placeholder="Bijschrift" />
      <Button type="submit">Bewaar</Button>
    </form>
  )
}

/** Twee knoppen: camera en fotobibliotheek. Verkleint automatisch. */
export function AddPhotoButtons({ stageId, diaryId, onAdded }: { stageId?: string; diaryId?: string; onAdded?: (ids: string[]) => void }) {
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const { toast } = useFeedback()

  const handle = async (list: FileList | null) => {
    if (!list?.length) return
    const files = Array.from(list)
    setProgress(`0 / ${files.length}`)
    const { ids, errors } = await addPhotos(files, { stageId, diaryId }, (d, t) => setProgress(`${d} / ${t}`))
    setProgress(null)
    if (ids.length) toast(ids.length === 1 ? 'Foto toegevoegd' : `${ids.length} foto’s toegevoegd`, { tone: 'success' })
    if (errors.length) toast(errors.join(' '), { tone: 'error' })
    onAdded?.(ids)
    if (camera.current) camera.current.value = ''
    if (library.current) library.current.value = ''
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => handle(e.target.files)} />
      <input ref={library} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => handle(e.target.files)} />
      <Button variant="secondary" onClick={() => camera.current?.click()} busy={!!progress}>
        <Camera className="size-5" aria-hidden /> Camera
      </Button>
      <Button variant="secondary" onClick={() => library.current?.click()} busy={!!progress}>
        <ImagePlus className="size-5" aria-hidden /> {progress ? `Bezig ${progress}` : 'Bibliotheek'}
      </Button>
    </div>
  )
}
