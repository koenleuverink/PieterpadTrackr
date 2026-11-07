import type { TrackPoint } from '../db/types'
import { OFFICIAL_STAGES, type OfficialStage } from '../data/stages'
import { distToLine, haversine, type LatLon } from './geo'

export interface StageMatch {
  stage: OfficialStage
  /** Deel van de routepunten dat binnen 300 m van de officiële etappe ligt (0..1). */
  onRoute: number
  /** Welk deel van de etappe (0..1) door de route wordt gedekt. */
  coverage: number
  startDistM: number
  endDistM: number
  reversed: boolean
  score: number
}

const NEAR_M = 300

function sample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr
  const step = arr.length / max
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)])
}

/**
 * Stelt voor bij welke etappe(s) een route hoort, op basis van begin-/eindpunt
 * en hoeveel van de route over de officiële etappe loopt.
 */
export function matchStages(points: TrackPoint[], stages: OfficialStage[] = OFFICIAL_STAGES): StageMatch[] {
  if (points.length < 2) return []
  const pts = sample(points, 150).map((p) => [p[0], p[1]] as LatLon)
  const start = pts[0]
  const end = pts[pts.length - 1]

  const results: StageMatch[] = []
  for (const stage of stages) {
    if (!stage.line.length) continue
    let near = 0
    let minAlong = 1, maxAlong = 0
    for (const p of pts) {
      const { dist, along } = distToLine(p, stage.line)
      if (dist <= NEAR_M) {
        near++
        minAlong = Math.min(minAlong, along)
        maxAlong = Math.max(maxAlong, along)
      }
    }
    const onRoute = near / pts.length
    if (onRoute < 0.15) continue
    const coverage = near ? Math.max(0, maxAlong - minAlong) : 0
    const sStart = stage.line[0]
    const sEnd = stage.line[stage.line.length - 1]
    const fwd = haversine(start, sStart) + haversine(end, sEnd)
    const rev = haversine(start, sEnd) + haversine(end, sStart)
    const reversed = rev < fwd
    const startDistM = Math.round(haversine(start, reversed ? sEnd : sStart))
    const endDistM = Math.round(haversine(end, reversed ? sStart : sEnd))
    // Begin-/eindpunt dichtbij geeft een bonus (tot 0,3); verder telt vooral de overlap.
    const endpointBonus = 0.15 * Math.max(0, 1 - startDistM / 2000) + 0.15 * Math.max(0, 1 - endDistM / 2000)
    const score = onRoute * 0.4 + coverage * 0.3 + endpointBonus
    results.push({ stage, onRoute, coverage, startDistM, endDistM, reversed, score })
  }
  return results.sort((a, b) => b.score - a.score)
}

export function describeMatch(m: StageMatch) {
  const pct = Math.round(m.coverage * 100)
  if (pct >= 85) return `Komt overeen met etappe ${m.stage.number} (${m.stage.from} – ${m.stage.to})`
  return `Ongeveer ${pct}% van etappe ${m.stage.number} (${m.stage.from} – ${m.stage.to})`
}
