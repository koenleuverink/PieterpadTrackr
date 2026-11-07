import { describe, expect, it } from 'vitest'
import { computeStats } from './stats'
import { OFFICIAL_STAGES, TOTAL_KM, stageId } from '../data/stages'
import type { Route, Stage } from '../db/types'

const base = { updatedAt: 0, deleted: 0 as const, dirty: 0 as const }
const stages = (): Stage[] =>
  OFFICIAL_STAGES.map((s) => ({ ...base, id: stageId(s.number), number: s.number, name: `${s.from} – ${s.to}`, from: s.from, to: s.to, distanceKm: s.distanceKm, status: 'gepland' }))

describe('statistieken', () => {
  it('telt 26 etappes en ~506 km', () => {
    const st = computeStats(stages(), [])
    expect(st.stagesTotal).toBe(26)
    expect(TOTAL_KM).toBe(506)
    expect(st.percent).toBe(0)
    expect(st.nextStage?.number).toBe(1)
  })

  it('rekent voortgang, tijd, snelheid, maanden en provincies', () => {
    const s = stages()
    Object.assign(s[0], { status: 'gelopen', walkedDate: '2026-04-12', durationMin: 180 })
    Object.assign(s[1], { status: 'gelopen', walkedDate: '2026-05-01' })
    const routes: Route[] = [
      { ...base, id: 'r1', name: 'etappe 2', stageId: s[1].id, source: 'gpx', date: '2026-05-01', distanceKm: 23, durationMin: 300, ascentM: 40, points: [], createdAt: 0 },
      { ...base, id: 'r2', name: 'halve 3', stageId: s[2].id, source: 'gpx', date: '2026-06-10', distanceKm: 10, durationMin: 120, points: [], createdAt: 0 },
    ]
    const st = computeStats(s, routes, new Date('2026-07-01T12:00:00'))
    expect(st.stagesDone).toBe(2)
    expect(st.progressKm).toBe(12 + 22 + 10)
    expect(st.walkedKm).toBe(12 + 23 + 10)
    expect(st.totalMinutes).toBe(180 + 300 + 120)
    expect(st.avgSpeedKmh).toBeCloseTo(4.5, 1)
    expect(st.ascentM).toBe(40)
    expect(st.longest?.km).toBe(23)
    expect(st.walkingDays).toBe(3)
    expect(st.kmPerMonth.map((m) => m.month)).toEqual(['2026-04', '2026-05', '2026-06'])
    expect(st.provinces.find((p) => p.province === 'Groningen')?.doneKm).toBe(12 + 22 + 10 * 0.6)
    expect(st.estimatedFinish).toBeInstanceOf(Date)
    expect(st.nextStage?.number).toBe(3)
  })
})
