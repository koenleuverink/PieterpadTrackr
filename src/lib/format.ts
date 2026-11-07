const nl = 'nl-NL'

export function km(n: number | undefined, digits = 1) {
  if (n == null || !Number.isFinite(n)) return '–'
  return `${n.toLocaleString(nl, { maximumFractionDigits: digits, minimumFractionDigits: 0 })} km`
}

export function duration(min: number | undefined) {
  if (!min) return '–'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (!h) return `${m} min`
  return `${h} u ${String(m).padStart(2, '0')} min`
}

export function dateLong(iso: string | undefined) {
  if (!iso) return '–'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString(nl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function dateShort(iso: string | undefined) {
  if (!iso) return '–'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString(nl, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function monthLabel(ym: string) {
  const d = new Date(ym + '-15T12:00:00')
  return d.toLocaleDateString(nl, { month: 'short', year: '2-digit' })
}

export function todayIso() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function percent(n: number) {
  return `${n.toLocaleString(nl, { maximumFractionDigits: n < 10 ? 1 : 0 })}%`
}

/** Leest "2:45", "2u45", "165" (minuten) of "2,5" (uren) als minuten. */
export function parseDuration(input: string): number | undefined {
  const s = input.trim().toLowerCase()
  if (!s) return undefined
  let m = s.match(/^(\d+)\s*[:u]\s*(\d{1,2})\s*(min)?$/)
  if (m) return +m[1] * 60 + +m[2]
  m = s.match(/^(\d+)\s*u(ur)?$/)
  if (m) return +m[1] * 60
  m = s.match(/^(\d+)[.,](\d+)\s*(u|uur)?$/)
  if (m) return Math.round(parseFloat(`${m[1]}.${m[2]}`) * 60)
  m = s.match(/^(\d+)\s*(m|min)?$/)
  if (m) return +m[1]
  return undefined
}

export function durationInput(min: number | undefined) {
  if (!min) return ''
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
}

export function parseKm(input: string): number | undefined {
  const n = parseFloat(input.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
