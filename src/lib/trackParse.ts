import type { RouteSource, TrackPoint } from '../db/types'
import { haversine, simplify } from './geo'

export interface ParsedTrack {
  name: string
  source: RouteSource
  fileName: string
  date?: string
  distanceKm: number
  durationMin?: number
  movingMin?: number
  ascentM?: number
  descentM?: number
  points: TrackPoint[]
}

export class TrackParseError extends Error {}

/** Leest een GPX-, TCX- of FIT-bestand. */
export async function parseTrackFile(file: File): Promise<ParsedTrack> {
  const ext = file.name.toLowerCase().split('.').pop()
  if (ext === 'fit') {
    return parseFit(await file.arrayBuffer(), file.name)
  }
  const text = await file.text()
  if (ext === 'tcx' || /<TrainingCenterDatabase/i.test(text.slice(0, 2000))) return parseTcx(text, file.name)
  if (ext === 'gpx' || /<gpx/i.test(text.slice(0, 2000))) return parseGpx(text, file.name)
  throw new TrackParseError(`"${file.name}" is geen GPX-, TCX- of FIT-bestand.`)
}

function xml(text: string, fileName: string) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new TrackParseError(`"${fileName}" kon niet gelezen worden: het bestand lijkt beschadigd.`)
  }
  return doc
}

const byLocal = (el: Element | Document, name: string) => Array.from(el.getElementsByTagNameNS('*', name))
const childText = (el: Element, name: string) => byLocal(el, name)[0]?.textContent?.trim() || undefined

export function parseGpx(text: string, fileName = 'track.gpx'): ParsedTrack {
  const doc = xml(text, fileName)
  let els = byLocal(doc, 'trkpt')
  if (!els.length) els = byLocal(doc, 'rtept')
  const points: TrackPoint[] = []
  for (const el of els) {
    const lat = parseFloat(el.getAttribute('lat') ?? '')
    const lon = parseFloat(el.getAttribute('lon') ?? '')
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const ele = childText(el, 'ele')
    const time = childText(el, 'time')
    points.push(point(lat, lon, ele ? parseFloat(ele) : undefined, time ? Date.parse(time) : undefined))
  }
  const name =
    byLocal(doc, 'trk').map((t) => childText(t, 'name'))[0] ??
    byLocal(doc, 'metadata').map((m) => childText(m, 'name'))[0] ??
    stripExt(fileName)
  const metaTime = byLocal(doc, 'metadata').map((m) => childText(m, 'time'))[0]
  return summarize(points, { name, source: 'gpx', fileName, fallbackTime: metaTime ? Date.parse(metaTime) : undefined })
}

export function parseTcx(text: string, fileName = 'track.tcx'): ParsedTrack {
  const doc = xml(text, fileName)
  const points: TrackPoint[] = []
  for (const tp of byLocal(doc, 'Trackpoint')) {
    const pos = byLocal(tp, 'Position')[0]
    if (!pos) continue
    const lat = parseFloat(childText(pos, 'LatitudeDegrees') ?? '')
    const lon = parseFloat(childText(pos, 'LongitudeDegrees') ?? '')
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const ele = childText(tp, 'AltitudeMeters')
    const time = childText(tp, 'Time')
    points.push(point(lat, lon, ele ? parseFloat(ele) : undefined, time ? Date.parse(time) : undefined))
  }
  const name = childText(doc.documentElement, 'Notes') ?? stripExt(fileName)
  const id = byLocal(doc, 'Id')[0]?.textContent?.trim()
  return summarize(points, { name, source: 'tcx', fileName, fallbackTime: id ? Date.parse(id) : undefined })
}

export async function parseFit(buffer: ArrayBuffer, fileName = 'track.fit'): Promise<ParsedTrack> {
  const { default: FitParser } = await import('fit-file-parser')
  const parser = new FitParser({ force: true, lengthUnit: 'm', mode: 'list' })
  type Rec = { position_lat?: number; position_long?: number; altitude?: number; enhanced_altitude?: number; timestamp?: string | Date | number }
  let data: { records?: Rec[] }
  try {
    data = (await parser.parseAsync(buffer)) as unknown as { records?: Rec[] }
  } catch {
    throw new TrackParseError(`"${fileName}" kon niet gelezen worden als FIT-bestand.`)
  }
  const points: TrackPoint[] = []
  for (const r of data.records ?? []) {
    if (r.position_lat == null || r.position_long == null) continue
    const alt = r.enhanced_altitude ?? r.altitude
    const t = r.timestamp != null ? new Date(r.timestamp).getTime() : undefined
    points.push(point(r.position_lat, r.position_long, alt, t))
  }
  return summarize(points, { name: stripExt(fileName), source: 'fit', fileName })
}

function point(lat: number, lon: number, ele?: number, time?: number): TrackPoint {
  const p: TrackPoint = [lat, lon]
  if (ele != null && Number.isFinite(ele)) p[2] = ele
  if (time != null && Number.isFinite(time)) p[3] = time
  return p
}

const stripExt = (n: string) => n.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()

export function toIsoDate(ms: number) {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Hoogtemeters met een drempel (hysterese) om GPS-ruis niet mee te tellen. */
export function elevationGain(eles: number[], threshold = 3) {
  let up = 0, down = 0
  if (!eles.length) return { up, down }
  let ref = eles[0]
  for (const e of eles) {
    const diff = e - ref
    if (diff >= threshold) { up += diff; ref = e }
    else if (diff <= -threshold) { down -= diff; ref = e }
  }
  return { up: Math.round(up), down: Math.round(down) }
}

function summarize(
  points: TrackPoint[],
  meta: { name: string; source: RouteSource; fileName: string; fallbackTime?: number },
): ParsedTrack {
  if (points.length < 2) {
    throw new TrackParseError(`"${meta.fileName}" bevat geen bruikbare trackpunten.`)
  }
  let dist = 0
  let moving = 0
  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i])
    dist += d
    const t0 = points[i - 1][3], t1 = points[i][3]
    if (t0 != null && t1 != null && t1 > t0) {
      const dt = (t1 - t0) / 1000
      const speed = d / dt // m/s
      // Bewegingstijd: alleen stukken tussen ~1 en 12 km/u, en geen gaten van >5 min.
      if (speed > 0.28 && speed < 3.4 && dt < 300) moving += dt
    }
  }
  const times = points.map((p) => p[3]).filter((t): t is number => t != null)
  const start = times.length ? Math.min(...times) : meta.fallbackTime
  const end = times.length ? Math.max(...times) : undefined
  const eles = points.map((p) => p[2]).filter((e): e is number => e != null)
  const gain = eles.length > 1 ? elevationGain(eles) : undefined

  // Opslag compact houden: vereenvoudigen tot ~5 m nauwkeurigheid.
  const stored = points.length > 400 ? simplify(points, 5) : points

  return {
    name: meta.name,
    source: meta.source,
    fileName: meta.fileName,
    date: start ? toIsoDate(start) : undefined,
    distanceKm: Math.round(dist / 10) / 100,
    durationMin: start && end && end > start ? Math.round((end - start) / 60000) : undefined,
    movingMin: moving > 60 ? Math.round(moving / 60) : undefined,
    ascentM: gain?.up,
    descentM: gain?.down,
    points: stored,
  }
}
