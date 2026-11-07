import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { elevationGain, parseGpx, parseTcx } from './trackParse'
import { matchStages } from './matchStage'

const sample = (f: string) => readFileSync(resolve(__dirname, "../../samples", f), "utf8")

describe('GPX-import', () => {
  it('leest afstand, duur, datum en hoogtemeters uit etappe 1', () => {
    const t = parseGpx(sample('etappe-01-pieterburen-winsum.gpx'), 'etappe-01.gpx')
    expect(t.name).toBe('Pieterpad etappe 1')
    expect(t.date).toBe('2026-04-12')
    expect(t.distanceKm).toBeGreaterThan(11.5)
    expect(t.distanceKm).toBeLessThan(13.5)
    // ~12 km op 4,8 km/u = ~2,5 uur + 25 min pauze
    expect(t.durationMin).toBeGreaterThan(160)
    expect(t.durationMin).toBeLessThan(200)
    expect(t.movingMin!).toBeLessThan(t.durationMin!)
    expect(t.ascentM).toBeGreaterThan(10)
  })

  it('stelt de juiste etappe voor', () => {
    const t = parseGpx(sample('etappe-01-pieterburen-winsum.gpx'))
    const [best] = matchStages(t.points)
    expect(best.stage.number).toBe(1)
    expect(best.coverage).toBeGreaterThan(0.9)
    expect(best.reversed).toBe(false)
  })

  it('herkent een etappe die in twee delen is gelopen', () => {
    const a = matchStages(parseGpx(sample('etappe-03-deel-1-groningen-haren.gpx')).points)[0]
    const b = matchStages(parseGpx(sample('etappe-03-deel-2-haren-zuidlaren.gpx')).points)[0]
    expect(a.stage.number).toBe(3)
    expect(b.stage.number).toBe(3)
    expect(a.coverage).toBeLessThan(0.7)
    expect(b.coverage).toBeLessThan(0.7)
  })

  it('herkent een in omgekeerde richting gelopen etappe', () => {
    const [best] = matchStages(parseGpx(sample('etappe-26-omgekeerd-maastricht-strabeek.gpx')).points)
    expect(best.stage.number).toBe(26)
    expect(best.reversed).toBe(true)
  })

  it('stelt niets voor bij een wandeling buiten het Pieterpad', () => {
    expect(matchStages(parseGpx(sample('los-wandeling-utrechtse-heuvelrug.gpx')).points)).toHaveLength(0)
  })

  it('geeft een duidelijke fout bij een kapot bestand', () => {
    expect(() => parseGpx('<gpx><trk>', 'kapot.gpx')).toThrow(/beschadigd/)
    expect(() => parseGpx('<gpx xmlns="http://www.topografix.com/GPX/1/1"></gpx>', 'leeg.gpx')).toThrow(/geen bruikbare/)
  })
})

describe('TCX-import', () => {
  it('leest een TCX-bestand en koppelt het aan etappe 12', () => {
    const t = parseTcx(sample('etappe-12-holten-laren.tcx'))
    expect(t.source).toBe('tcx')
    expect(t.date).toBe('2026-06-21')
    expect(t.distanceKm).toBeGreaterThan(14)
    expect(matchStages(t.points)[0].stage.number).toBe(12)
  })
})

describe('hoogtemeters', () => {
  it('negeert ruis onder de drempel', () => {
    expect(elevationGain([10, 11, 10, 11, 10, 11]).up).toBe(0)
    expect(elevationGain([10, 15, 20, 15, 10]).up).toBe(10)
    expect(elevationGain([10, 15, 20, 15, 10]).down).toBe(10)
  })
})

