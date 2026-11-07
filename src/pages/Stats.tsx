import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { Card, EmptyState, Loading, Page, PageHeader } from '../components/ui'
import { ProgressBar } from '../components/Progress'
import { useStats } from '../db/hooks'
import { dateLong, duration, km, monthLabel, percent } from '../lib/format'

export default function Stats() {
  const s = useStats()
  if (!s) return <Loading />
  const empty = s.progressKm === 0 && s.walkedKm === 0

  return (
    <>
      <PageHeader title="Statistieken" />
      <Page>
        {empty ? (
          <EmptyState icon={<BarChart3 className="size-10" />} title="Nog niets te tellen">
            Zodra je een etappe afrondt of een route importeert, zie je hier je kilometers, looptijd, tempo en een geschatte einddatum.
          </EmptyState>
        ) : (
          <>
            <Card>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg">Voltooid</h2>
                <span className="font-serif text-3xl font-bold text-red">{percent(s.percent)}</span>
              </div>
              <div className="mt-2">
                <ProgressBar value={s.percent} label="Percentage van het Pieterpad voltooid" />
              </div>
              <p className="mt-2 text-sm text-muted">
                {km(s.progressKm, 0)} van {km(s.totalKm, 0)} · nog {km(Math.max(0, s.totalKm - s.progressKm), 0)} te gaan
              </p>
            </Card>

            <dl className="grid grid-cols-2 gap-3">
              <Tile label="Etappes gelopen" value={`${s.stagesDone} / ${s.stagesTotal}`} />
              <Tile label="Totaal gelopen" value={km(s.walkedKm)} hint="incl. omleidingen en losse routes" />
              <Tile label="Totale looptijd" value={duration(s.totalMinutes)} />
              <Tile label="Gemiddelde snelheid" value={s.avgSpeedKmh ? `${s.avgSpeedKmh.toLocaleString('nl-NL')} km/u` : '–'} />
              <Tile label="Hoogtemeters" value={s.ascentM ? `${s.ascentM.toLocaleString('nl-NL')} m` : '–'} hint={s.ascentM ? undefined : 'uit GPS-tracks'} />
              <Tile label="Wandeldagen" value={String(s.walkingDays)} />
            </dl>

            {s.longest && (
              <Card>
                <p className="text-sm font-semibold text-muted">Langste etappe</p>
                {s.longest.stageId ? (
                  <Link to={`/etappes/${s.longest.stageId}`} className="text-lg font-bold underline-offset-2 hover:underline">
                    {s.longest.label}
                  </Link>
                ) : (
                  <p className="text-lg font-bold">{s.longest.label}</p>
                )}
                <p className="text-muted">{km(s.longest.km)}</p>
              </Card>
            )}

            <Card>
              <h2 className="text-lg">Geschatte einddatum</h2>
              {s.estimatedFinish ? (
                <>
                  <p className="mt-1 font-serif text-2xl font-bold">{dateLong(s.estimatedFinish.toISOString().slice(0, 10))}</p>
                  <p className="text-sm text-muted">Op basis van je tempo sinds {dateLong(s.firstWalk)}: gemiddeld {km((s.progressKm / Math.max(1, (Date.now() - Date.parse(s.firstWalk + 'T12:00:00')) / 86400000)) * 30, 0)} per maand.</p>
                </>
              ) : s.percent >= 100 ? (
                <p className="mt-1">Je bent er al! 🎉</p>
              ) : (
                <p className="mt-1 text-muted">Na minstens twee wandeldagen kan ik een einddatum schatten.</p>
              )}
            </Card>

            <MonthChart data={s.kmPerMonth} />

            <Card>
              <h2 className="mb-3 text-lg">Voortgang per provincie</h2>
              <ul className="space-y-3">
                {s.provinces.map((p) => (
                  <li key={p.province}>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{p.province}</span>
                      <span className="text-muted">
                        {km(p.doneKm, 0)} / {km(p.totalKm, 0)}
                      </span>
                    </div>
                    <ProgressBar thin value={(p.doneKm / p.totalKm) * 100} label={`${p.province}: ${percent((p.doneKm / p.totalKm) * 100)}`} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">Etappes die over een provinciegrens lopen zijn naar schatting verdeeld.</p>
            </Card>
          </>
        )}
      </Page>
    </>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-serif text-2xl font-bold">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  )
}

/** Staafgrafiek km per maand: één reeks, dus één kleur en geen legenda. */
function MonthChart({ data }: { data: { month: string; km: number }[] }) {
  const [active, setActive] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  if (!data.length) return null
  const max = Math.max(...data.map((d) => d.km), 1)
  const nice = Math.ceil(max / 10) * 10
  const H = 160
  const barW = Math.max(10, Math.min(36, 280 / data.length))
  const gap = 6
  const W = data.length * (barW + gap) + 32
  const sel = active != null ? data[active] : data.reduce((a, b) => (b.km > a.km ? b : a), data[0])

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Kilometers per maand</h2>
        <button type="button" className="min-h-11 px-2 text-sm font-semibold text-red" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          {table ? 'Grafiek' : 'Tabel'}
        </button>
      </div>
      {table ? (
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-sm text-muted">
              <th className="py-1 font-semibold">Maand</th>
              <th className="py-1 text-right font-semibold">Km</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month} className="border-t border-line">
                <td className="py-1.5 capitalize">{new Date(d.month + '-15').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</td>
                <td className="py-1.5 text-right font-semibold">{d.km.toLocaleString('nl-NL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            <span className="capitalize">{new Date(sel.month + '-15').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</span>: <strong className="text-ink">{km(sel.km)}</strong>
            {active == null && ' (beste maand)'}
          </p>
          <div className="no-scrollbar mt-2 overflow-x-auto">
            <svg width={W} height={H + 28} role="img" aria-label="Staafgrafiek van gelopen kilometers per maand. Gebruik de knop Tabel voor de exacte waarden." className="block">
              {[0, 0.5, 1].map((f) => (
                <g key={f}>
                  <line x1={28} x2={W} y1={H - f * H + 4} y2={H - f * H + 4} stroke="var(--c-line)" strokeWidth={1} />
                  <text x={24} y={H - f * H + 8} textAnchor="end" fontSize={11} fill="var(--c-muted)">
                    {Math.round(nice * f)}
                  </text>
                </g>
              ))}
              {data.map((d, i) => {
                const h = (d.km / nice) * H
                const x = 32 + i * (barW + gap)
                const y = H - h + 4
                const r = Math.min(4, h / 2, barW / 2)
                return (
                  <g
                    key={d.month}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${monthLabel(d.month)}: ${km(d.km)}`}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  >
                    {/* Ruim raakvlak, groter dan de staaf */}
                    <rect x={x - gap / 2} y={0} width={barW + gap} height={H + 28} fill="transparent" />
                    {h > 0 && (
                      <path
                        d={`M${x},${H + 4} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${H + 4} Z`}
                        fill="var(--c-red-brand)"
                        opacity={active == null || active === i ? 1 : 0.45}
                      />
                    )}
                    <text x={x + barW / 2} y={H + 22} textAnchor="middle" fontSize={10} fill={active === i ? 'var(--c-ink)' : 'var(--c-muted)'}>
                      {monthLabel(d.month)}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </>
      )}
    </Card>
  )
}
