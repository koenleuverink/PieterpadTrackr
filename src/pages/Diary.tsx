import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Images, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, Chip, EmptyState, LinkButton, Loading, Page, PageHeader } from '../components/ui'
import { PhotoGrid } from '../components/Photos'
import { Markdown } from '../components/Markdown'
import { useDiary, usePhotos, useStages } from '../db/hooks'
import { byDateDesc } from '../db/repo'
import { dateLong } from '../lib/format'
import { useFeedback } from '../components/Feedback'
import { MOODS, WEATHER } from './DiaryEdit'

export default function Diary() {
  const diary = useDiary()
  const photos = usePhotos()
  const stages = useStages()
  const location = useLocation()
  const [view, setView] = useState<'tijdlijn' | 'fotos'>('tijdlijn')
  const { deleteWithUndo } = useFeedback()

  const entries = useMemo(() => diary?.slice().sort(byDateDesc) ?? [], [diary])
  const months = useMemo(() => {
    const m = new Map<string, typeof entries>()
    for (const e of entries) {
      const k = e.date.slice(0, 7)
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return [...m.entries()]
  }, [entries])

  useEffect(() => {
    if (!location.hash || !diary) return
    const el = document.getElementById(location.hash.slice(1))
    el?.scrollIntoView({ block: 'start' })
  }, [location.hash, diary])

  if (!diary || !photos || !stages) return <Loading />

  return (
    <>
      <PageHeader title="Dagboek" subtitle={`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · ${photos.length} foto’s`} />
      <Page>
        <div className="flex gap-2" role="group" aria-label="Weergave">
          <Chip active={view === 'tijdlijn'} onClick={() => setView('tijdlijn')}>
            Tijdlijn
          </Chip>
          <Chip active={view === 'fotos'} onClick={() => setView('fotos')}>
            Alle foto’s
          </Chip>
        </div>

        {view === 'fotos' ? (
          photos.length ? (
            <PhotoGrid photos={photos} />
          ) : (
            <EmptyState icon={<Images className="size-10" />} title="Nog geen foto’s" action={<LinkButton to="/fotos/nieuw">Foto’s toevoegen</LinkButton>}>
              Voeg foto’s toe vanaf je camera of fotobibliotheek. Ze worden automatisch verkleind en, als ze locatiegegevens hebben, op de kaart gezet.
            </EmptyState>
          )
        ) : entries.length === 0 ? (
          <EmptyState icon={<BookOpen className="size-10" />} title="Je dagboek is nog leeg" action={<LinkButton to="/dagboek/nieuw"><Plus className="size-5" aria-hidden /> Eerste entry</LinkButton>}>
            Schrijf na elke etappe kort op hoe het was: wat je zag, waar je at, hoe je benen voelden. Foto’s kun je er direct bij zetten.
          </EmptyState>
        ) : (
          months.map(([month, list]) => (
            <section key={month} aria-label={new Date(month + '-15').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}>
              <h2 className="sticky top-14 z-10 -mx-4 bg-bg/95 px-4 py-2 text-base text-muted capitalize backdrop-blur">
                {new Date(month + '-15').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
              </h2>
              <ol className="relative space-y-4 border-l-2 border-line pl-4">
                {list.map((e) => {
                  const stage = stages.find((s) => s.id === e.stageId)
                  const ph = photos.filter((p) => p.diaryId === e.id)
                  return (
                    <li key={e.id} id={e.id} className="scroll-mt-28">
                      <span className="absolute -left-[0.55rem] mt-5 size-4 rounded-full border-2 border-bg bg-red-brand" aria-hidden />
                      <Card as="article">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-muted">{dateLong(e.date)}</p>
                            {stage && (
                              <Link to={`/etappes/${stage.id}`} className="text-sm font-semibold text-red underline-offset-2 hover:underline">
                                Etappe {stage.number}: {stage.name}
                              </Link>
                            )}
                          </div>
                          <Link to={`/dagboek/${e.id}/bewerken`} className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Entry bewerken">
                            <Pencil className="size-5" aria-hidden />
                          </Link>
                          <button
                            type="button"
                            className="-mr-2 flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
                            aria-label="Entry verwijderen"
                            onClick={() => deleteWithUndo('diary', e.id, 'dagboekentry')}
                          >
                            <Trash2 className="size-5" aria-hidden />
                          </button>
                        </div>
                        {e.title && <h3 className="mt-1 text-xl">{e.title}</h3>}
                        {(e.mood || e.weather) && (
                          <p className="mt-1 text-sm text-muted">
                            {[MOODS.find((m) => m.value === e.mood)?.label, WEATHER.find((w) => w.value === e.weather)?.label].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {e.text && <Markdown text={e.text} className="mt-2" />}
                        {ph.length > 0 && (
                          <div className="mt-3">
                            <PhotoGrid photos={ph} />
                          </div>
                        )}
                      </Card>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))
        )}
      </Page>
    </>
  )
}
