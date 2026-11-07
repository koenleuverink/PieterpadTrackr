import { db, tableFor, uid } from './db'
import type { DiaryEntry, Photo, Place, RecordKind, Route, Stage, SyncFields } from './types'

type Listener = () => void
const listeners = new Set<Listener>()

/** Wordt aangeroepen na elke lokale wijziging (de sync-module plant dan een synchronisatie). */
export function onLocalChange(fn: Listener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function changed() {
  listeners.forEach((fn) => fn())
}

type New<T> = Omit<T, keyof SyncFields | 'createdAt'> & { id?: string }

function stamp<T extends object>(data: T) {
  return { ...data, updatedAt: Date.now(), dirty: 1 as const }
}

export async function addRecord<K extends RecordKind>(kind: K, data: New<KindMap[K]>): Promise<string> {
  const id = data.id ?? uid()
  const now = Date.now()
  await tableFor(kind).add({ ...data, id, createdAt: now, updatedAt: now, deleted: 0, dirty: 1 } as never)
  changed()
  return id
}

export async function updateRecord<K extends RecordKind>(kind: K, id: string, patch: Partial<KindMap[K]>) {
  await tableFor(kind).update(id, stamp(patch) as never)
  changed()
}

/** Zachte verwijdering; met restoreRecord ongedaan te maken. */
export async function softDelete(kind: RecordKind, id: string) {
  await tableFor(kind).update(id, stamp({ deleted: 1 as const }))
  changed()
}

export async function restoreRecord(kind: RecordKind, id: string) {
  await tableFor(kind).update(id, stamp({ deleted: 0 as const }))
  changed()
}

export interface KindMap {
  stage: Stage
  route: Route
  diary: DiaryEntry
  photo: Photo
  place: Place
}

export const live = {
  stages: () => db.stages.orderBy('number').toArray(),
  routes: () => db.routes.filter((r) => !r.deleted).toArray(),
  diary: () => db.diary.filter((r) => !r.deleted).toArray(),
  photos: () => db.photos.filter((r) => !r.deleted).toArray(),
  places: () => db.places.filter((r) => !r.deleted).toArray(),
}

export function byDateDesc<T extends { date?: string; createdAt: number }>(a: T, b: T) {
  const d = (b.date ?? '').localeCompare(a.date ?? '')
  return d !== 0 ? d : b.createdAt - a.createdAt
}
