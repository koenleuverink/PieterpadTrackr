import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, CheckCircle2, ChevronRight, Settings as SettingsIcon, PartyPopper } from 'lucide-react'
import { Card, LinkButton, Loading, Page } from '../components/ui'
import { MapView } from '../components/MapView'
import { ProgressBar } from '../components/Progress'
import { SyncBadge } from '../components/SyncBadge'
import { stageLines } from '../components/mapLayers'
import { useDiary, useRoutes, useStages, useStats } from '../db/hooks'
import { byDateDesc } from '../db/repo'
import { dateLong, km, percent } from '../lib/format'
import { Markdown } from '../components/Markdown'

export default function Home() {
  const stages = useStages()
  const routes = useRoutes()
  const diary = useDiary()
  const stats = useStats()
  const navigate = useNavigate()

  const lines = useMemo(() => (stages && routes ? stageLines(stages, routes, (s) => navigate(`/etappes/${s.id}`)) : []), [stages, routes, navigate])
  const lastEntry = useMemo(() => diary?.slice().sort(byDateDesc)[0], [diary])

  return (
    <>
      <header className="safe-top sticky top-0 z-[500] border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-3xl items-center gap-3 px-4">
          <span className="law-mark" aria-hidden />
          <h1 className="flex-1 text-xl">Mijn Pieterpad</h1>
          <SyncBadge />
          <Link to="/instellingen" className="-mr-2 flex size-12 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Instellingen">
            <SettingsIcon className="size-6" aria-hidden />
          </Link>
        </div>
      </header>
      <Page>
        {!stats ? (
          <Loading />
        ) : (
          <>
            <Card>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-muted">Gelopen</p>
                  <p className="font-serif text-4xl font-bold">
                    {km(stats.progressKm, 0)}
                    <span className="ml-2 text-lg font-normal text-muted">van {km(stats.totalKm, 0)}</span>
                  </p>
                </div>
                <p className="font-serif text-3xl font-bold text-red">{percent(stats.percent)}</p>
              </div>
              <div className="mt-3">
                <ProgressBar value={stats.percent} label="Voortgang op het Pieterpad" />
              </div>
              <p className="mt-2 text-sm text-muted">
                {stats.stagesDone} van {stats.stagesTotal} etappes gelopen · Pieterburen → Sint-Pietersberg
              </p>
            </Card>

            <MapView lines={lines} fit="nl" className="h-[22rem]" label="Kaart van het Pieterpad met gelopen etappes in rood" />

            {stats.nextStage ? (
              <Card>
                <p className="text-sm font-semibold text-muted">Eerstvolgende etappe</p>
                <Link to={`/etappes/${stats.nextStage.id}`} className="mt-1 flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink font-serif text-lg font-bold text-bg">{stats.nextStage.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold">{stats.nextStage.name}</span>
                    <span className="block text-muted">{km(stats.nextStage.distanceKm, 0)}</span>
                  </span>
                  <ChevronRight className="size-6 text-muted" aria-hidden />
                </Link>
                <LinkButton to={`/etappes/afronden?etappe=${stats.nextStage.id}`} className="mt-4 w-full">
                  <CheckCircle2 className="size-5" aria-hidden /> Etappe afronden
                </LinkButton>
              </Card>
            ) : (
              <Card className="text-center">
                <PartyPopper className="mx-auto size-10 text-red" aria-hidden />
                <h2 className="mt-2 text-xl">Gefeliciteerd! Het hele Pieterpad is gelopen.</h2>
              </Card>
            )}

            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg">Laatste dagboekentry</h2>
                <Link to="/dagboek" className="min-h-11 px-2 py-2 font-semibold text-red">
                  Alles
                </Link>
              </div>
              {lastEntry ? (
                <Link to={`/dagboek#${lastEntry.id}`} className="block">
                  <p className="text-sm text-muted">{dateLong(lastEntry.date)}</p>
                  {lastEntry.title && <p className="font-serif text-lg font-bold">{lastEntry.title}</p>}
                  <div className="line-clamp-4">
                    <Markdown text={lastEntry.text} />
                  </div>
                </Link>
              ) : (
                <div className="text-muted">
                  <p>Nog geen dagboekentries. Schrijf na een wandeling op wat je zag, at en beleefde.</p>
                  <LinkButton to="/dagboek/nieuw" variant="secondary" className="mt-3">
                    <BookOpen className="size-5" aria-hidden /> Eerste entry schrijven
                  </LinkButton>
                </div>
              )}
            </Card>
          </>
        )}
      </Page>
    </>
  )
}
