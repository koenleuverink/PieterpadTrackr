// Genereert testbestanden in samples/ op basis van de vereenvoudigde etappelijnen.
// Gebruik: node scripts/make-samples.mjs
import fs from 'node:fs'
import { FitEncoder, FitBaseType } from 'fit-file-parser'
const lines = JSON.parse(fs.readFileSync(new URL('../src/data/stageLines.json', import.meta.url)))
const R = 6371000, rad = (d) => (d * Math.PI) / 180
const hav = (a, b) => { const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) }

// Punten om de ~25 m met een beetje GPS-ruis, tijd op ~4,8 km/u en een glooiend hoogteprofiel.
function densify(line, startIso, { pause = true, baseEle = 5, amp = 8 } = {}) {
  const out = []; let t = Date.parse(startIso); let total = 0; let seed = 42
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5)
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i]; const d = hav(a, b); const n = Math.max(1, Math.round(d / 25))
    for (let k = 0; k < n; k++) {
      const f = k / n; const lat = a[0] + (b[0] - a[0]) * f + rnd() * 0.00004; const lon = a[1] + (b[1] - a[1]) * f + rnd() * 0.00004
      const step = d / n; total += step; t += (step / 1.33) * 1000
      if (pause && Math.abs(total - 8000) < step) t += 25 * 60 * 1000 // koffiepauze
      out.push({ lat, lon, ele: baseEle + amp * Math.sin(total / 1500) + amp / 2 * Math.sin(total / 400), t })
    }
  }
  const last = line[line.length - 1]; out.push({ lat: last[0], lon: last[1], ele: out[out.length - 1].ele, t: t + 20000 })
  return out
}
const iso = (t) => new Date(t).toISOString().replace(/\.\d+Z$/, 'Z')
function gpx(name, pts) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Pieterpad Tracker testdata" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${name}</name><time>${iso(pts[0].t)}</time></metadata>
  <trk><name>${name}</name><trkseg>
${pts.map((p) => `    <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.ele.toFixed(1)}</ele><time>${iso(p.t)}</time></trkpt>`).join('\n')}
  </trkseg></trk>
</gpx>
`
}
function tcx(name, pts) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities><Activity Sport="Other"><Id>${iso(pts[0].t)}</Id><Lap StartTime="${iso(pts[0].t)}"><Track>
${pts.map((p) => `      <Trackpoint><Time>${iso(p.t)}</Time><Position><LatitudeDegrees>${p.lat.toFixed(6)}</LatitudeDegrees><LongitudeDegrees>${p.lon.toFixed(6)}</LongitudeDegrees></Position><AltitudeMeters>${p.ele.toFixed(1)}</AltitudeMeters></Trackpoint>`).join('\n')}
  </Track></Lap><Notes>${name}</Notes></Activity></Activities>
</TrainingCenterDatabase>
`
}
const L = (n) => lines[String(n)].line
const w = (f, s) => { fs.writeFileSync(new URL(`../samples/${f}`, import.meta.url), s); console.log('samples/' + f) }

w('etappe-01-pieterburen-winsum.gpx', gpx('Pieterpad etappe 1', densify(L(1), '2026-04-12T09:15:00Z')))
const l3 = L(3); const mid = Math.floor(l3.length * 0.45)
w('etappe-03-deel-1-groningen-haren.gpx', gpx('Groningen – Haren', densify(l3.slice(0, mid + 1), '2026-05-03T10:00:00Z', { pause: false })))
w('etappe-03-deel-2-haren-zuidlaren.gpx', gpx('Haren – Zuidlaren', densify(l3.slice(mid), '2026-05-17T09:30:00Z')))
w('etappe-12-holten-laren.tcx', tcx('Holten naar Laren', densify(L(12), '2026-06-21T08:45:00Z', { baseEle: 20, amp: 25 })))
w('etappe-26-omgekeerd-maastricht-strabeek.gpx', gpx('Sint-Pietersberg terug naar Strabeek', densify([...L(26)].reverse(), '2026-09-06T11:00:00Z', { baseEle: 80, amp: 40 })))
// Een wandeling ver van het Pieterpad (Utrechtse Heuvelrug): hoort bij geen enkele etappe.
w('los-wandeling-utrechtse-heuvelrug.gpx', gpx('Rondje Amerongen', densify([[52.0, 5.45], [52.01, 5.47], [52.02, 5.46], [52.015, 5.44], [52.0, 5.45]], '2026-07-10T13:00:00Z', { baseEle: 30, amp: 20 })))

// FIT (Garmin-formaat): etappe 8, Coevorden – Hardenberg.
function fit(pts) {
  const enc = new FitEncoder()
  const ts = (t) => FitEncoder.toFitTimestamp(new Date(t))
  const semi = (deg) => Math.round((deg * 2 ** 31) / 180)
  enc.writeMessage(0, [
    { number: 0, size: 1, baseType: FitBaseType.Enum, value: 4 },
    { number: 1, size: 2, baseType: FitBaseType.Uint16, value: 255 },
    { number: 4, size: 4, baseType: FitBaseType.Uint32, value: ts(pts[0].t) },
  ], 0)
  for (const p of pts) {
    enc.writeMessage(20, [
      { number: 253, size: 4, baseType: FitBaseType.Uint32, value: ts(p.t) },
      { number: 0, size: 4, baseType: FitBaseType.Sint32, value: semi(p.lat) },
      { number: 1, size: 4, baseType: FitBaseType.Sint32, value: semi(p.lon) },
      { number: 2, size: 2, baseType: FitBaseType.Uint16, value: Math.round((p.ele + 500) * 5) },
    ], 1)
  }
  return Buffer.from(enc.close())
}
w('etappe-08-coevorden-hardenberg.fit', fit(densify(L(8), '2026-08-15T07:50:00Z', { baseEle: 12, amp: 6 })))
