import type { Route } from '../db/types'

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)

export function toGpx(route: Route) {
  const pts = route.points
    .map((p) => {
      const ele = p[2] != null ? `<ele>${p[2].toFixed(1)}</ele>` : ''
      const time = p[3] != null ? `<time>${new Date(p[3]).toISOString()}</time>` : ''
      return `      <trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}">${ele}${time}</trkpt>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Pieterpad Tracker" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${esc(route.name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`
}
