import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Camera, BookOpen, Route as RouteIcon } from 'lucide-react'
import { Chip, Loading, Page, PageHeader, StatusBadge } from '../components/ui'
import { useDiary, usePhotos, useRoutes, useStages, useStats } from '../db/hooks'
import { dateShort, km } from '../lib/format'
import { ProgressBar } from '../components/Progress'
import { stageProgressKm } from '../lib/stats'

type Filter = 'alle' | 'gepland' | 'gelopen'

export default function Stages() {
  const stages = useStages()
  const routes = useRoutes()
  const photos = usePhotos()
  const diary = useDiary()
  const stats = useStats()
  const [filter, setFilter] = useState<Filter>('alle')

  const counts = useMemo(() => {
    const m = new Map<string, { photos: number; diary: number; routes: number }>()
    const get = (id?: string) => {
      if (!id) return undefined
      if (!m.has(id)) m.set(id, { photos: 0, diary: 0, routes: 0 })
      return m.get(id)!
    }
    photos?.forEach((p) => get(p.stageId) && get(p.stageId)!.photos++)
    diary?.forEach((d) => get(d.stageId) && get(d.stageId)!.diary++)
    routes?.forEach((r) => get(r.stageId) && get(r.stageId)!.routes++)
    return m
  }, [photos, diary, routes])

  if (!stages || !routes) return <Loading />
  const list = stages.filter((s) => filter === 'alle' || s.status === filter)

  return (
    <>
      <PageHeader title="Etappes" subtitle={stats && `${stats.stagesDone} van ${stats.stagesTotal} gelopen · ${km(stats.progressKm, 0)}`} />
      <Page>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Filter op status">
          {(['alle', 'gepland', 'gelopen'] as Filter[]).map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f === 'alle' ? 'Alle' : f === 'gepland' ? 'Gepland' : 'Gelopen'}
            </Chip>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="py-8 text-center text-muted">{filter === 'gelopen' ? 'Je hebt nog geen etappes gelopen. Tik op + om je eerste etappe af te ronden.' : 'Alle etappes zijn gelopen!'}</p>
        ) : (
          <ol className="space-y-2">
            {list.map((s) => {
              const c = counts.get(s.id)
              const prog = stageProgressKm(s, routes)
              const partial = s.status !== 'gelopen' && prog > 0
              return (
                <li key={s.id}>
                  <Link to={`/etappes/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-muted">
                    <span
                      className={`flex size-12 shrink-0 items-center justify-center rounded-full font-serif text-lg font-bold ${s.status === 'gelopen' ? 'bg-red text-on-red' : 'bg-surface-2 text-ink'}`}
                      aria-hidden
                    >
                      {s.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="sr-only">Etappe {s.number}: </span>
                      <span className="block font-bold leading-snug">{s.name}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                        <StatusBadge walked={s.status === 'gelopen'} partial={partial} />
                        <span>{km(s.distanceKm, 0)}</span>
                        {s.walkedDate && <span>{dateShort(s.walkedDate)}</span>}
                        {!!c?.routes && (
                          <span className="inline-flex items-center gap-1">
                            <RouteIcon className="size-4" aria-hidden />
                            {c.routes}
                            <span className="sr-only"> routes</span>
                          </span>
                        )}
                        {!!c?.photos && (
                          <span className="inline-flex items-center gap-1">
                            <Camera className="size-4" aria-hidden />
                            {c.photos}
                            <span className="sr-only"> foto’s</span>
                          </span>
                        )}
                        {!!c?.diary && (
                          <span className="inline-flex items-center gap-1">
                            <BookOpen className="size-4" aria-hidden />
                            {c.diary}
                            <span className="sr-only"> dagboekentries</span>
                          </span>
                        )}
                      </span>
                      {partial && (
                        <span className="mt-1.5 block">
                          <ProgressBar thin value={(prog / s.distanceKm) * 100} label={`Etappe ${s.number} deels gelopen`} />
                        </span>
                      )}
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </Page>
    </>
  )
}
