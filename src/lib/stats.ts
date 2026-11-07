import type { Route, Stage } from '../db/types'
import { OFFICIAL_STAGES, PROVINCES, TOTAL_KM, type Province } from '../data/stages'

export interface Stats {
  totalKm: number
  progressKm: number
  percent: number
  stagesDone: number
  stagesTotal: number
  /** Werkelijk gelopen km (GPS waar beschikbaar, anders officiële afstand). */
  walkedKm: number
  totalMinutes: number
  avgSpeedKmh?: number
  ascentM: number
  longest?: { label: string; km: number; stageId?: string }
  kmPerMonth: { month: string; km: number }[]
  walkingDays: number
  provinces: { province: Province; doneKm: number; totalKm: number }[]
  estimatedFinish?: Date
  nextStage?: Stage
  firstWalk?: string
  lastWalk?: string
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Voortgang van één etappe in km: volledig als gelopen, anders deels via gekoppelde routes. */
export function stageProgressKm(stage: Stage, routes: Route[]) {
  if (stage.status === 'gelopen') return stage.distanceKm
  const linked = sum(routes.filter((r) => r.stageId === stage.id).map((r) => r.distanceKm))
  return Math.min(stage.distanceKm * 0.95, linked)
}

export function computeStats(allStages: Stage[], allRoutes: Route[], today = new Date()): Stats {
  const stages = allStages.filter((s) => !s.deleted).sort((a, b) => a.number - b.number)
  const routes = allRoutes.filter((r) => !r.deleted)
  const totalKm = sum(stages.map((s) => s.distanceKm)) || TOTAL_KM

  const done = stages.filter((s) => s.status === 'gelopen')
  const progressKm = sum(stages.map((s) => stageProgressKm(s, routes)))

  // Werkelijk gelopen afstand, tijd en per-datum verdeling.
  let walkedKm = 0
  let minutes = 0
  let speedKm = 0
  let speedMin = 0
  const perDate: { date: string; km: number }[] = []
  let longest: Stats['longest']

  for (const s of stages) {
    const linked = routes.filter((r) => r.stageId === s.id)
    const routeKm = sum(linked.map((r) => r.distanceKm))
    const routeMin = sum(linked.map((r) => r.durationMin ?? 0))
    let km = 0
    let min = 0
    if (s.status === 'gelopen') {
      km = routeKm > 0 ? routeKm : s.distanceKm
      min = s.durationMin ?? routeMin
      if (linked.length === 0 && s.walkedDate) perDate.push({ date: s.walkedDate, km })
    } else if (linked.length) {
      km = routeKm
      min = routeMin
    }
    for (const r of linked) if (r.date) perDate.push({ date: r.date, km: r.distanceKm })
    if (s.status === 'gelopen' && linked.length && !linked.some((r) => r.date) && s.walkedDate) {
      perDate.push({ date: s.walkedDate, km })
    }
    walkedKm += km
    minutes += min
    if (min > 0 && km > 0) { speedKm += km; speedMin += min }
    if (km > 0 && (!longest || km > longest.km)) longest = { label: `Etappe ${s.number}: ${s.name}`, km, stageId: s.id }
  }
  for (const r of routes.filter((r) => !r.stageId)) {
    walkedKm += r.distanceKm
    minutes += r.durationMin ?? 0
    if (r.durationMin && r.distanceKm) { speedKm += r.distanceKm; speedMin += r.durationMin }
    if (r.date) perDate.push({ date: r.date, km: r.distanceKm })
    if (!longest || r.distanceKm > longest.km) longest = { label: r.name, km: r.distanceKm }
  }

  const months = new Map<string, number>()
  for (const { date, km } of perDate) months.set(date.slice(0, 7), (months.get(date.slice(0, 7)) ?? 0) + km)
  const kmPerMonth = fillMonths([...months.keys()].sort()).map((month) => ({ month, km: round1(months.get(month) ?? 0) }))

  const dates = [...new Set(perDate.map((p) => p.date))].sort()

  const provinces = PROVINCES.map((province) => {
    let doneKm = 0, total = 0
    for (const s of stages) {
      const share = OFFICIAL_STAGES.find((o) => o.number === s.number)?.provinces[province] ?? 0
      total += share * s.distanceKm
      doneKm += share * stageProgressKm(s, routes)
    }
    return { province, doneKm: round1(doneKm), totalKm: round1(total) }
  }).filter((p) => p.totalKm > 0)

  let estimatedFinish: Date | undefined
  if (dates.length >= 2 && progressKm < totalKm) {
    const first = new Date(dates[0] + 'T12:00:00')
    const days = Math.max(1, (today.getTime() - first.getTime()) / 86400000)
    const kmPerDay = progressKm / days
    if (kmPerDay > 0) estimatedFinish = new Date(today.getTime() + ((totalKm - progressKm) / kmPerDay) * 86400000)
  }

  return {
    totalKm,
    progressKm: round1(progressKm),
    percent: totalKm ? Math.min(100, (progressKm / totalKm) * 100) : 0,
    stagesDone: done.length,
    stagesTotal: stages.length,
    walkedKm: round1(walkedKm),
    totalMinutes: Math.round(minutes),
    avgSpeedKmh: speedMin > 0 ? round1(speedKm / (speedMin / 60)) : undefined,
    ascentM: Math.round(sum(routes.map((r) => r.ascentM ?? 0))),
    longest: longest && { ...longest, km: round1(longest.km) },
    kmPerMonth,
    walkingDays: dates.length,
    provinces,
    estimatedFinish,
    nextStage: stages.find((s) => s.status !== 'gelopen'),
    firstWalk: dates[0],
    lastWalk: dates[dates.length - 1],
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Vult ontbrekende maanden tussen de eerste en laatste maand aan. */
function fillMonths(sorted: string[]) {
  if (!sorted.length) return []
  const out: string[] = []
  let [y, m] = sorted[0].split('-').map(Number)
  const [ey, em] = sorted[sorted.length - 1].split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}
