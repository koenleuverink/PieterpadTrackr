import { db, getSetting, setSetting } from '../db/db'

export interface HomeySettings {
  enabled: boolean
  /** Bijv. https://webhook.homey.app/<jouw-homey-id>/{event} — placeholders zijn toegestaan. */
  url: string
  event: string
  method: 'GET' | 'POST'
  /** Sjabloon voor de "tag"-parameter die Homey als token doorgeeft aan je flow. */
  tagTemplate: string
}

export const DEFAULT_HOMEY: HomeySettings = {
  enabled: false,
  url: '',
  event: 'pieterpad_etappe_afgerond',
  method: 'GET',
  tagTemplate: '{etappe}|{km}|{totaalKm}|{procent}',
}

export async function getHomeySettings(): Promise<HomeySettings> {
  return { ...DEFAULT_HOMEY, ...(await getSetting<Partial<HomeySettings>>('homey', {})) }
}

export async function saveHomeySettings(s: HomeySettings) {
  await setSetting('homey', s)
}

export interface StageCompletedPayload {
  event: string
  etappe: number
  naam: string
  km: number
  totaalKm: number
  procent: number
  datum: string
  test?: boolean
}

function fill(template: string, p: StageCompletedPayload) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = (p as unknown as Record<string, unknown>)[k]
    return v == null ? '' : encodeURIComponent(String(v))
  })
}

export function buildRequest(s: HomeySettings, p: StageCompletedPayload): { url: string; init: RequestInit } {
  const url = new URL(fill(s.url, p))
  const tag = decodeURIComponent(fill(s.tagTemplate, p))
  url.searchParams.set('tag', tag)
  for (const [k, v] of Object.entries(p)) url.searchParams.set(k, String(v))
  if (s.method === 'POST') {
    return {
      url: url.toString(),
      // text/plain houdt het een "simple request", zodat de browser geen CORS-preflight nodig heeft.
      init: { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ ...p, tag }) },
    }
  }
  return { url: url.toString(), init: { method: 'GET', mode: 'no-cors' } }
}

/** Zet een event in de wachtrij (werkt ook offline) en probeert direct te versturen. */
export async function queueHomeyEvent(p: Omit<StageCompletedPayload, 'event'>) {
  const s = await getHomeySettings()
  if (!s.enabled || !s.url) return
  await db.outbox.add({ kind: 'homey', payload: { ...p, event: s.event }, createdAt: Date.now(), attempts: 0 })
  await flushOutbox()
}

let flushing = false
export async function flushOutbox() {
  if (flushing || !navigator.onLine) return
  flushing = true
  try {
    const s = await getHomeySettings()
    const items = await db.outbox.where('kind').equals('homey').toArray()
    for (const item of items) {
      if (!s.enabled || !s.url) break
      try {
        const { url, init } = buildRequest(s, item.payload as StageCompletedPayload)
        await fetch(url, init)
        await db.outbox.delete(item.id!)
      } catch (e) {
        await db.outbox.update(item.id!, { attempts: item.attempts + 1, lastError: e instanceof Error ? e.message : String(e) })
      }
    }
  } finally {
    flushing = false
  }
}

export async function sendTest(s: HomeySettings) {
  const { url, init } = buildRequest(s, {
    event: s.event,
    etappe: 0,
    naam: 'Testmelding',
    km: 12,
    totaalKm: 123,
    procent: 24.3,
    datum: new Date().toISOString().slice(0, 10),
    test: true,
  })
  await fetch(url, init)
  return url
}
