import { db, tableFor } from '../db/db'
import type { RecordKind } from '../db/types'

const KINDS: RecordKind[] = ['stage', 'route', 'diary', 'photo', 'place']
export const BACKUP_VERSION = 1

interface BackupJson {
  app: 'pieterpad-tracker'
  version: number
  exportedAt: string
  records: Record<RecordKind, Record<string, unknown>[]>
  settings: { key: string; value: unknown }[]
}

/** Maakt een zip met data.json en alle foto's (photos/<id>.jpg, thumbs/<id>.jpg). */
export async function exportBackup(onProgress?: (msg: string) => void): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const records = {} as BackupJson['records']
  for (const kind of KINDS) {
    const rows = (await tableFor(kind).toArray()) as unknown as Record<string, unknown>[]
    records[kind] = rows.map((r) => {
      const { blob, thumb, dirty: _d, ...rest } = r
      void _d
      if (kind === 'photo') {
        if (blob instanceof Blob) zip.file(`photos/${r.id}.jpg`, blob)
        if (thumb instanceof Blob) zip.file(`thumbs/${r.id}.jpg`, thumb)
      }
      return rest
    })
  }
  const settings = (await db.settings.toArray()).filter((s) => !String(s.key).startsWith('sync-cursor'))
  const json: BackupJson = { app: 'pieterpad-tracker', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), records, settings }
  zip.file('data.json', JSON.stringify(json, null, 2))
  onProgress?.('Zip maken…')
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

export interface ImportResult {
  added: number
  updated: number
  skipped: number
  photos: number
}

/**
 * Leest een back-up (zip of losse data.json) en voegt samen met wat er al is:
 * per record wint de nieuwste versie. Er wordt nooit iets gewist.
 */
export async function importBackup(file: File): Promise<ImportResult> {
  let json: BackupJson
  let zip: import('jszip') | null = null
  if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
    json = JSON.parse(await file.text())
  } else {
    const { default: JSZip } = await import('jszip')
    try {
      zip = await JSZip.loadAsync(file)
    } catch {
      throw new Error('Dit bestand is geen geldige back-up (zip kon niet geopend worden).')
    }
    const data = zip.file('data.json')
    if (!data) throw new Error('In deze zip staat geen data.json. Is het wel een Pieterpad-back-up?')
    json = JSON.parse(await data.async('string'))
  }
  if (json?.app !== 'pieterpad-tracker' || !json.records) throw new Error('Dit is geen back-up van Pieterpad Tracker.')
  if (json.version > BACKUP_VERSION) throw new Error('Deze back-up is gemaakt met een nieuwere versie van de app. Werk de app eerst bij.')

  const result: ImportResult = { added: 0, updated: 0, skipped: 0, photos: 0 }
  for (const kind of KINDS) {
    const table = tableFor(kind)
    for (const rec of json.records[kind] ?? []) {
      const id = rec.id as string
      if (!id) continue
      const local = (await table.get(id)) as Record<string, unknown> | undefined
      const incomingTs = (rec.updatedAt as number) ?? 0
      if (local && (local.updatedAt as number) >= incomingTs && local.updatedAt !== 0) {
        result.skipped++
        continue
      }
      const next: Record<string, unknown> = { ...rec, dirty: 1 }
      if (kind === 'photo') {
        const blob = await zip?.file(`photos/${id}.jpg`)?.async('blob')
        const thumb = await zip?.file(`thumbs/${id}.jpg`)?.async('blob')
        if (blob) {
          next.blob = new Blob([blob], { type: 'image/jpeg' })
          next.thumb = thumb ? new Blob([thumb], { type: 'image/jpeg' }) : next.blob
          next.missingBlob = 0
          result.photos++
        } else if (local?.blob) {
          next.blob = local.blob
          next.thumb = local.thumb
        } else {
          next.missingBlob = 1
        }
      }
      await table.put(next as never)
      if (local) result.updated++
      else result.added++
    }
  }
  for (const s of json.settings ?? []) {
    if (s.key === 'homey' && !(await db.settings.get('homey'))) await db.settings.put(s)
  }
  return result
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
