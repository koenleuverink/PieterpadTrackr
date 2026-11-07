/**
 * Datamodel. Alle synchroniseerbare records delen dezelfde basisvelden:
 * - updatedAt: tijdstip (ms) van de laatste lokale wijziging, gebruikt voor "laatste wijziging wint".
 * - deleted: 1 = verwijderd (tombstone). Records worden nooit direct gewist, zodat undo en sync werken.
 * - dirty: 1 = nog niet naar Supabase gestuurd.
 */
export interface SyncFields {
  id: string
  updatedAt: number
  deleted: 0 | 1
  dirty: 0 | 1
}

export type StageStatus = 'gepland' | 'gelopen'

export interface Stage extends SyncFields {
  number: number
  name: string
  from: string
  to: string
  distanceKm: number
  status: StageStatus
  /** ISO-datum (yyyy-mm-dd) */
  walkedDate?: string
  durationMin?: number
  notes?: string
}

export type RouteSource = 'gpx' | 'tcx' | 'fit' | 'handmatig'

/** [lat, lon, hoogte?, tijd(ms)?] */
export type TrackPoint = [number, number, number?, number?]

export interface Route extends SyncFields {
  name: string
  stageId?: string
  source: RouteSource
  fileName?: string
  /** ISO-datum (yyyy-mm-dd) */
  date?: string
  distanceKm: number
  durationMin?: number
  movingMin?: number
  ascentM?: number
  descentM?: number
  points: TrackPoint[]
  notes?: string
  createdAt: number
}

export type Mood = 'geweldig' | 'goed' | 'oké' | 'zwaar' | 'afzien'
export type Weather = 'zon' | 'half bewolkt' | 'bewolkt' | 'regen' | 'wind' | 'sneeuw' | 'warm' | 'koud'

export interface DiaryEntry extends SyncFields {
  date: string
  stageId?: string
  title?: string
  text: string
  mood?: Mood
  weather?: Weather
  createdAt: number
}

export interface Photo extends SyncFields {
  /** Verkleinde afbeelding (JPEG) */
  blob?: Blob
  thumb?: Blob
  /** Pad in Supabase Storage nadat de foto is geüpload */
  remotePath?: string
  /** 1 = blob staat (nog) niet lokaal, alleen in de cloud */
  missingBlob?: 0 | 1
  caption?: string
  /** ISO-datumtijd */
  takenAt?: string
  lat?: number
  lon?: number
  width?: number
  height?: number
  stageId?: string
  diaryId?: string
  createdAt: number
}

export type PlaceType = 'restaurant' | 'cafe' | 'overnachting'

export interface Place extends SyncFields {
  type: PlaceType
  name: string
  address?: string
  lat?: number
  lon?: number
  website?: string
  rating?: number
  note?: string
  price?: string
  stageId?: string
  createdAt: number
}

export type RecordKind = 'stage' | 'route' | 'diary' | 'photo' | 'place'

export interface OutboxItem {
  id?: number
  kind: 'homey'
  payload: unknown
  createdAt: number
  attempts: number
  lastError?: string
}

export interface Setting {
  key: string
  value: unknown
}
