import type { Route, Stage } from '../db/types'
import { officialStage } from '../data/stages'
import type { MapLine } from './MapView'

/** Officiële etappes (gelopen = rood, gepland = grijs gestreept) plus eigen routes. */
export function stageLines(stages: Stage[], routes: Route[], onStage?: (s: Stage) => void, highlight?: string): MapLine[] {
  const lines: MapLine[] = stages.map((s) => ({
    id: s.id,
    points: officialStage(s.number)?.line ?? [],
    kind: s.id === highlight ? 'highlight' : s.status === 'gelopen' ? 'walked' : 'planned',
    label: `Etappe ${s.number}: ${s.name}${s.status === 'gelopen' ? ' (gelopen)' : ''}`,
    onClick: onStage ? () => onStage(s) : undefined,
  }))
  for (const r of routes) {
    const st = stages.find((s) => s.id === r.stageId)
    // Routes bij een gelopen etappe vallen samen met de rode lijn; alleen tonen als ze los of deels zijn.
    if (st?.status === 'gelopen' && !highlight) continue
    lines.push({ id: r.id, points: r.points, kind: 'route', label: r.name })
  }
  return lines
}
