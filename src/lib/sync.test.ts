import { beforeEach, describe, expect, it, vi } from 'vitest'

// Minimale nep-Supabase: één tabel in het geheugen + storage.
interface Row { user_id: string; kind: string; id: string; data: Record<string, unknown>; updated_at: number; deleted: boolean; server_updated_at: string }
const server: { rows: Row[]; files: Map<string, Blob>; clock: number } = { rows: [], files: new Map(), clock: Date.parse('2026-01-01T00:00:00Z') }
const tick = () => new Date((server.clock += 1000)).toISOString()

function query() {
  let gt: string | undefined
  let from = 0, to = 1e9
  const q = {
    select: () => q,
    order: () => q,
    range: (a: number, b: number) => ((from = a), (to = b), q),
    gt: (_c: string, v: string) => ((gt = v), q),
    then: (resolve: (v: unknown) => void) => {
      const data = server.rows
        .filter((r) => !gt || r.server_updated_at > gt)
        .sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at))
        .slice(from, to + 1)
      resolve({ data: structuredClone(data), error: null })
    },
    upsert: async (row: Omit<Row, 'server_updated_at'>) => {
      const i = server.rows.findIndex((r) => r.user_id === row.user_id && r.kind === row.kind && r.id === row.id)
      const full = { ...structuredClone(row), server_updated_at: tick() }
      if (i >= 0) server.rows[i] = full
      else server.rows.push(full)
      return { error: null }
    },
  }
  return q
}

const fake = {
  from: () => query(),
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'test@example.com' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  storage: {
    from: () => ({
      upload: async (path: string, blob: Blob) => (server.files.set(path, blob), { error: null }),
      download: async (path: string) => ({ data: server.files.get(path) ?? null, error: null }),
    }),
  },
}

vi.mock('./supabase', () => ({ getSupabase: () => fake, RECORDS_TABLE: 'pp_records', PHOTO_BUCKET: 'photos' }))
vi.mock('./homey', () => ({ flushOutbox: async () => {} }))

const { db, seedStages } = await import('../db/db')
const { addRecord, softDelete, updateRecord } = await import('../db/repo')
const { syncNow } = await import('./sync')

describe('synchronisatie', () => {
  beforeEach(async () => {
    server.rows = []
    server.files.clear()
    await Promise.all(db.tables.map((t) => t.clear()))
    await seedStages()
  })

  it('verstuurt lokale wijzigingen, inclusief verwijderingen en foto’s', async () => {
    await updateRecord('stage', 'etappe-01', { status: 'gelopen', walkedDate: '2026-04-12' })
    const placeId = await addRecord('place', { type: 'cafe', name: 'Koffie' })
    const photoId = await addRecord('photo', { blob: new Blob(['x'], { type: 'image/jpeg' }), caption: 'mooi' })
    await softDelete('place', placeId)
    await syncNow()

    expect(server.rows.find((r) => r.id === 'etappe-01')?.data.status).toBe('gelopen')
    expect(server.rows.find((r) => r.id === placeId)?.deleted).toBe(true)
    const photoRow = server.rows.find((r) => r.id === photoId)!
    expect(photoRow.data.blob).toBeUndefined()
    expect(photoRow.data.remotePath).toBe(`u1/${photoId}.jpg`)
    expect(server.files.has(`u1/${photoId}.jpg`)).toBe(true)
    expect(await db.stages.where('dirty').equals(1).count()).toBe(0)
  })

  it('haalt wijzigingen op; de nieuwste versie wint', async () => {
    server.rows.push(
      { user_id: 'u1', kind: 'stage', id: 'etappe-02', data: { id: 'etappe-02', number: 2, name: 'Winsum – Groningen', from: 'Winsum', to: 'Groningen', distanceKm: 22, status: 'gelopen' }, updated_at: 5000, deleted: false, server_updated_at: tick() },
      { user_id: 'u1', kind: 'diary', id: 'd1', data: { id: 'd1', date: '2026-05-01', text: 'vanaf desktop', createdAt: 1 }, updated_at: 5000, deleted: false, server_updated_at: tick() },
    )
    // Lokaal nieuwer: mag niet overschreven worden.
    await addRecord('diary', { id: 'd2', date: '2026-06-01', text: 'lokaal nieuw' })
    server.rows.push({ user_id: 'u1', kind: 'diary', id: 'd2', data: { id: 'd2', text: 'oud op server' }, updated_at: 1, deleted: false, server_updated_at: tick() })

    await syncNow()
    expect((await db.stages.get('etappe-02'))?.status).toBe('gelopen')
    expect((await db.diary.get('d1'))?.text).toBe('vanaf desktop')
    expect((await db.diary.get('d2'))?.text).toBe('lokaal nieuw')
    // ...en de lokale versie is daarna naar de server gegaan.
    expect(server.rows.find((r) => r.id === 'd2')?.data.text).toBe('lokaal nieuw')
  })
})
