import { useSyncExternalStore } from 'react'
import { db, getSetting, setSetting, tableFor } from '../db/db'
import { onLocalChange } from '../db/repo'
import type { Photo, RecordKind } from '../db/types'
import { getSupabase, PHOTO_BUCKET, RECORDS_TABLE } from './supabase'
import { flushOutbox } from './homey'

export type SyncState = 'uit' | 'offline' | 'bezig' | 'klaar' | 'fout' | 'niet-ingelogd'

interface Status {
  state: SyncState
  lastSync?: number
  error?: string
  email?: string
}

let status: Status = { state: 'uit' }
const subs = new Set<() => void>()
function set(patch: Partial<Status>) {
  status = { ...status, ...patch }
  subs.forEach((f) => f())
}

export function useSyncStatus() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => status,
  )
}

const KINDS: RecordKind[] = ['stage', 'route', 'diary', 'place', 'photo']

interface RemoteRow {
  kind: RecordKind
  id: string
  data: Record<string, unknown>
  updated_at: number
  deleted: boolean
  server_updated_at: string
}

/** Velden die niet in de database-JSON thuishoren. */
function toRemote(kind: RecordKind, rec: Record<string, unknown>) {
  const { dirty: _d, blob: _b, thumb: _t, missingBlob: _m, ...rest } = rec
  void _d; void _b; void _t; void _m; void kind
  return rest
}

let running: Promise<void> | null = null
let again = false

/** Synchroniseert nu (of plant een extra ronde als er al een bezig is). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      do {
        again = false
        await syncOnce()
      } while (again)
    } finally {
      running = null
    }
  })()
  return running
}

async function syncOnce() {
  void flushOutbox()
  const sb = getSupabase()
  if (!sb) return set({ state: 'uit', error: undefined })
  if (!navigator.onLine) return set({ state: 'offline' })
  const { data: sess } = await sb.auth.getSession()
  const user = sess.session?.user
  if (!user) return set({ state: 'niet-ingelogd', email: undefined })
  set({ state: 'bezig', email: user.email ?? undefined, error: undefined })

  try {
    // 1. Ophalen wat sinds de vorige keer veranderd is.
    const cursorKey = `sync-cursor-${user.id}`
    const cursor = await getSetting<string | null>(cursorKey, null)
    let newCursor = cursor
    let from = 0
    const PAGE = 500
    for (;;) {
      let q = sb.from(RECORDS_TABLE).select('kind,id,data,updated_at,deleted,server_updated_at').order('server_updated_at', { ascending: true }).range(from, from + PAGE - 1)
      // 10 s overlap, voor het geval transacties op de server elkaar kruisen; dubbel binnenkomen is onschadelijk.
      if (cursor) q = q.gt('server_updated_at', new Date(Date.parse(cursor) - 10000).toISOString())
      const { data, error } = await q
      if (error) throw error
      const rows = (data ?? []) as RemoteRow[]
      for (const row of rows) await mergeRemote(row)
      if (rows.length) newCursor = rows[rows.length - 1].server_updated_at
      if (rows.length < PAGE) break
      from += PAGE
    }

    // 2. Lokale wijzigingen versturen.
    for (const kind of KINDS) {
      const table = tableFor(kind)
      const dirty = await table.where('dirty').equals(1).toArray()
      for (const rec of dirty) {
        if (kind === 'photo') await uploadPhotoBlob(user.id, rec as unknown as Photo)
        const fresh = (await table.get(rec.id)) as Record<string, unknown> | undefined
        if (!fresh) continue
        const { error } = await sb.from(RECORDS_TABLE).upsert(
          { user_id: user.id, kind, id: rec.id, data: toRemote(kind, fresh), updated_at: fresh.updatedAt as number, deleted: !!fresh.deleted },
          { onConflict: 'user_id,kind,id' },
        )
        if (error) throw error
        // Alleen "schoon" markeren als er intussen niets is gewijzigd.
        await table.where('id').equals(rec.id).and((r) => r.updatedAt === fresh.updatedAt).modify({ dirty: 0 })
      }
    }
    if (newCursor) await setSetting(cursorKey, newCursor)
    const now = Date.now()
    await setSetting('last-sync', now)
    set({ state: 'klaar', lastSync: now, error: undefined })
  } catch (e) {
    set({ state: 'fout', error: friendlyError(e) })
  }
}

async function mergeRemote(row: RemoteRow) {
  if (!KINDS.includes(row.kind)) return
  const table = tableFor(row.kind)
  const local = (await table.get(row.id)) as Record<string, unknown> | undefined
  if (local && (local.updatedAt as number) >= row.updated_at) return
  const merged: Record<string, unknown> = { ...row.data, id: row.id, updatedAt: row.updated_at, deleted: row.deleted ? 1 : 0, dirty: 0 }
  if (row.kind === 'photo') {
    const keepBlob = local && local.blob && local.remotePath === merged.remotePath
    if (keepBlob) {
      merged.blob = local.blob
      merged.thumb = local.thumb
    } else {
      merged.missingBlob = 1
    }
  }
  await table.put(merged as never)
}

async function uploadPhotoBlob(userId: string, photo: Photo) {
  const sb = getSupabase()
  if (!sb || !photo.blob || photo.remotePath || photo.deleted) return
  const path = `${userId}/${photo.id}.jpg`
  const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, photo.blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  // remotePath zetten zonder updatedAt te veranderen; het record gaat direct hierna mee in de upsert.
  await db.photos.update(photo.id, { remotePath: path })
}

const downloads = new Map<string, Promise<void>>()

/** Haalt een foto die alleen in de cloud staat op en bewaart hem lokaal. */
export function ensurePhotoBlob(photo: Photo): Promise<void> {
  if (photo.blob || !photo.remotePath) return Promise.resolve()
  const existing = downloads.get(photo.id)
  if (existing) return existing
  const p = (async () => {
    const sb = getSupabase()
    if (!sb || !navigator.onLine) return
    const { data, error } = await sb.storage.from(PHOTO_BUCKET).download(photo.remotePath!)
    if (error || !data) return
    const { processPhoto } = await import('./photos')
    let thumb: Blob = data
    try {
      thumb = (await processPhoto(new File([data], `${photo.id}.jpg`, { type: 'image/jpeg' }))).thumb
    } catch {
      /* dan maar de volledige foto als thumbnail */
    }
    await db.photos.update(photo.id, { blob: data, thumb, missingBlob: 0 })
  })().finally(() => downloads.delete(photo.id))
  downloads.set(photo.id, p)
  return p
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Geen verbinding met de server. Je gegevens blijven veilig op dit apparaat en worden later gesynchroniseerd.'
  if (/relation .* does not exist|Could not find the table/i.test(msg)) return 'De tabel pp_records bestaat nog niet in Supabase. Voer het SQL-script uit de README uit.'
  if (/Bucket not found/i.test(msg)) return 'De opslagbucket "photos" bestaat nog niet in Supabase. Zie de README.'
  if (/row-level security|violates/i.test(msg)) return 'Supabase weigert de gegevens (RLS-policy). Controleer de policies uit de README.'
  if (/JWT|token/i.test(msg)) return 'Je sessie is verlopen. Log opnieuw in via Instellingen.'
  return `Synchroniseren mislukt: ${msg}`
}

let started = false
let timer: ReturnType<typeof setTimeout> | undefined

/** Start automatische synchronisatie: bij opstarten, online komen, terugkeren naar de app en na wijzigingen. */
export function startAutoSync() {
  if (started) return
  started = true
  const schedule = (ms = 3000) => {
    clearTimeout(timer)
    timer = setTimeout(() => void syncNow(), ms)
  }
  onLocalChange(() => schedule())
  window.addEventListener('online', () => schedule(500))
  window.addEventListener('offline', () => status.state !== 'uit' && set({ state: 'offline' }))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && schedule(500))
  setInterval(() => void syncNow(), 5 * 60 * 1000)
  getSupabase()?.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') schedule(200)
    if (event === 'SIGNED_OUT') set({ state: 'niet-ingelogd', email: undefined })
  })
  void getSetting<number | undefined>('last-sync', undefined).then((t) => t && set({ lastSync: t }))
  schedule(800)
}

/** Na wisselen van Supabase-project: alles opnieuw als "te versturen" markeren. */
export async function markAllDirty() {
  for (const kind of KINDS) await tableFor(kind).toCollection().modify({ dirty: 1 })
  await db.photos.toCollection().modify({ remotePath: undefined })
}

export async function pendingCount() {
  let n = 0
  for (const kind of KINDS) n += await tableFor(kind).where('dirty').equals(1).count()
  return n
}
