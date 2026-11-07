import type { TrackPoint } from '../db/types'

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180

export type LatLon = [number, number]

/** Afstand in meters tussen twee punten. */
export function haversine(a: LatLon | TrackPoint, b: LatLon | TrackPoint) {
  const dLat = rad(b[0] - a[0])
  const dLon = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Kortste afstand (m) van punt p tot lijnstuk a-b (vlakke benadering, prima op wandelschaal). */
export function distToSegment(p: LatLon, a: LatLon, b: LatLon) {
  const k = Math.cos(rad(a[0]))
  const px = p[1] * k, py = p[0]
  const ax = a[1] * k, ay = a[0]
  const bx = b[1] * k, by = b[0]
  const dx = bx - ax, dy = by - ay
  const len = dx * dx + dy * dy
  let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * 111320
}

/** Kortste afstand van p tot een polyline, plus de positie (0..1) langs de lijn. */
export function distToLine(p: LatLon, line: LatLon[]): { dist: number; along: number } {
  if (line.length === 0) return { dist: Infinity, along: 0 }
  if (line.length === 1) return { dist: haversine(p, line[0]), along: 0 }
  let best = Infinity
  let bestIdx = 0
  for (let i = 1; i < line.length; i++) {
    const d = distToSegment(p, line[i - 1], line[i])
    if (d < best) {
      best = d
      bestIdx = i
    }
  }
  return { dist: best, along: bestIdx / (line.length - 1) }
}

export function lineLength(points: (LatLon | TrackPoint)[]) {
  let d = 0
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i])
  return d
}

/** Douglas–Peucker vereenvoudiging met tolerantie in meters. */
export function simplify<T extends LatLon | TrackPoint>(pts: T[], tolerance: number): T[] {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()!
    let max = 0
    let idx = -1
    for (let i = s + 1; i < e; i++) {
      const d = distToSegment([pts[i][0], pts[i][1]], [pts[s][0], pts[s][1]], [pts[e][0], pts[e][1]])
      if (d > max) {
        max = d
        idx = i
      }
    }
    if (max > tolerance && idx > 0) {
      keep[idx] = 1
      stack.push([s, idx], [idx, e])
    }
  }
  return pts.filter((_, i) => keep[i])
}

export function bounds(points: (LatLon | TrackPoint)[]): [LatLon, LatLon] | undefined {
  if (!points.length) return undefined
  let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity
  for (const p of points) {
    minLat = Math.min(minLat, p[0]); maxLat = Math.max(maxLat, p[0])
    minLon = Math.min(minLon, p[1]); maxLon = Math.max(maxLon, p[1])
  }
  return [[minLat, minLon], [maxLat, maxLon]]
}
