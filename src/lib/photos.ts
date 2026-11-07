import { addRecord } from '../db/repo'

const MAX_SIDE = 2048
const THUMB_SIDE = 480

export interface ProcessedPhoto {
  blob: Blob
  thumb: Blob
  width: number
  height: number
  takenAt?: string
  lat?: number
  lon?: number
}

async function readExif(file: Blob) {
  try {
    const exifr = await import('exifr')
    const data = await exifr.parse(file, { gps: true, pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude'] })
    if (!data) return {}
    const date: Date | undefined = data.DateTimeOriginal ?? data.CreateDate
    return {
      takenAt: date instanceof Date && !isNaN(date.getTime()) ? date.toISOString() : undefined,
      lat: typeof data.latitude === 'number' ? data.latitude : undefined,
      lon: typeof data.longitude === 'number' ? data.longitude : undefined,
    }
  } catch {
    return {}
  }
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* val terug op <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

async function resize(src: ImageBitmap | HTMLImageElement, maxSide: number, quality: number) {
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width
  const h = 'naturalHeight' in src ? src.naturalHeight : src.height
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const cw = Math.round(w * scale)
  const ch = Math.round(h * scale)
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, cw, ch)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
  if (!blob) throw new Error('Verkleinen mislukt')
  return { blob, width: cw, height: ch }
}

/** Leest EXIF (datum, locatie) en verkleint de foto voor opslag. */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)) {
    throw new Error(`"${file.name}" is geen afbeelding.`)
  }
  const exif = await readExif(file)
  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = await loadBitmap(file)
  } catch {
    throw new Error(`"${file.name}" kan niet geopend worden. Probeer de foto als JPEG te delen.`)
  }
  const full = await resize(bitmap, MAX_SIDE, 0.82)
  const thumb = await resize(bitmap, THUMB_SIDE, 0.75)
  if ('close' in bitmap) bitmap.close()
  return {
    blob: full.blob,
    thumb: thumb.blob,
    width: full.width,
    height: full.height,
    takenAt: exif.takenAt ?? (file.lastModified ? new Date(file.lastModified).toISOString() : undefined),
    lat: exif.lat,
    lon: exif.lon,
  }
}

export async function addPhotos(
  files: File[],
  link: { stageId?: string; diaryId?: string },
  onProgress?: (done: number, total: number) => void,
) {
  const errors: string[] = []
  const ids: string[] = []
  let done = 0
  for (const file of files) {
    try {
      const p = await processPhoto(file)
      ids.push(await addRecord('photo', { ...p, ...link, caption: '' }))
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
    onProgress?.(++done, files.length)
  }
  return { ids, errors }
}
