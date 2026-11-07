import Dexie, { type EntityTable } from 'dexie'
import type { DiaryEntry, OutboxItem, Photo, Place, RecordKind, Route, Setting, Stage } from './types'
import { OFFICIAL_STAGES, stageId } from '../data/stages'

export class PieterpadDB extends Dexie {
  stages!: EntityTable<Stage, 'id'>
  routes!: EntityTable<Route, 'id'>
  diary!: EntityTable<DiaryEntry, 'id'>
  photos!: EntityTable<Photo, 'id'>
  places!: EntityTable<Place, 'id'>
  outbox!: EntityTable<OutboxItem, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name = 'pieterpad') {
    super(name)
    this.version(1).stores({
      stages: 'id, number, status, walkedDate, dirty, deleted',
      routes: 'id, stageId, date, dirty, deleted',
      diary: 'id, date, stageId, dirty, deleted',
      photos: 'id, stageId, diaryId, takenAt, dirty, deleted',
      places: 'id, type, stageId, dirty, deleted',
      outbox: '++id, kind',
      settings: 'key',
    })
  }
}

export const db = new PieterpadDB()

export const tables = {
  stage: () => db.stages,
  route: () => db.routes,
  diary: () => db.diary,
  photo: () => db.photos,
  place: () => db.places,
} satisfies Record<RecordKind, () => unknown>

export function tableFor(kind: RecordKind) {
  // Type-erased toegang voor generieke code (sync, import, verwijderen).
  return tables[kind]() as unknown as Dexie.Table<{ id: string; updatedAt: number; deleted: 0 | 1; dirty: 0 | 1 }, string>
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Vult de 26 officiële etappes in als ze nog niet bestaan. */
export async function seedStages(database: PieterpadDB = db) {
  await database.transaction('rw', database.stages, async () => {
    const existing = new Set((await database.stages.toCollection().primaryKeys()) as string[])
    const missing = OFFICIAL_STAGES.filter((s) => !existing.has(stageId(s.number))).map<Stage>((s) => ({
      id: stageId(s.number),
      number: s.number,
      name: `${s.from} – ${s.to}`,
      from: s.from,
      to: s.to,
      distanceKm: s.distanceKm,
      status: 'gepland',
      // updatedAt 0: een versie uit de cloud wint altijd van de standaardwaarden.
      updatedAt: 0,
      deleted: 0,
      dirty: 0,
    }))
    if (missing.length) await database.stages.bulkAdd(missing)
  })
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return (row?.value as T) ?? fallback
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}
