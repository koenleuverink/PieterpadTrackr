// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFit } from './trackParse'
import { matchStages } from './matchStage'

describe('FIT-import', () => {
  it('leest een FIT-bestand en koppelt het aan etappe 8', async () => {
    const buf = readFileSync(resolve(__dirname, '../../samples/etappe-08-coevorden-hardenberg.fit'))
    const t = await parseFit(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), 'etappe-08.fit')
    expect(t.source).toBe('fit')
    expect(t.date).toBe('2026-08-15')
    expect(t.distanceKm).toBeGreaterThan(17)
    expect(t.durationMin).toBeGreaterThan(200)
    expect(t.ascentM).toBeGreaterThan(5)
    expect(matchStages(t.points)[0].stage.number).toBe(8)
  })
})
