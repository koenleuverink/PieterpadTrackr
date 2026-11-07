import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, Chip, EmptyState, Field, LinkButton, Loading, Page, PageHeader, Stars } from '../components/ui'
import { MapView, type MapMarker } from '../components/MapView'
import { StageSelect } from '../components/StageSelect'
import { stageLines } from '../components/mapLayers'
import { usePlaces, useStages } from '../db/hooks'
import type { PlaceType } from '../db/types'
import { useFeedback } from '../components/Feedback'

export const placeTypeLabel: Record<PlaceType, string> = {
  restaurant: 'Restaurant',
  cafe: 'Café',
  overnachting: 'Overnachting',
}
export const placeTypeEmoji: Record<PlaceType, string> = { restaurant: '🍽', cafe: '☕', overnachting: '🛏' }

export default function Places() {
  const places = usePlaces()
  const stages = useStages()
  const navigate = useNavigate()
  const { deleteWithUndo } = useFeedback()
  const [type, setType] = useState<PlaceType | 'alle'>('alle')
  const [stageId, setStageId] = useState<string>()

  const list = useMemo(
    () =>
      (places ?? [])
        .filter((p) => (type === 'alle' || p.type === type) && (!stageId || p.stageId === stageId))
        .sort((a, b) => {
          const na = stages?.find((s) => s.id === a.stageId)?.number ?? 99
          const nb = stages?.find((s) => s.id === b.stageId)?.number ?? 99
          return na - nb || a.name.localeCompare(b.name)
        }),
    [places, type, stageId, stages],
  )
  const markers = useMemo<MapMarker[]>(
    () => list.filter((p) => p.lat != null && p.lon != null).map((p) => ({ id: p.id, lat: p.lat!, lon: p.lon!, type: p.type, label: p.name, onClick: () => document.getElementById(`plek-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) })),
    [list],
  )
  const lines = useMemo(() => (stages ? stageLines(stageId ? stages.filter((s) => s.id === stageId) : stages, []) : []), [stages, stageId])

  if (!places || !stages) return <Loading />

  return (
    <>
      <PageHeader title="Plekken" subtitle={`${places.length} restaurants, cafés en overnachtingen`} />
      <Page>
        {places.length === 0 ? (
          <EmptyState
            icon={<MapPin className="size-10" />}
            title="Nog geen plekken"
            action={
              <LinkButton to="/plekken/nieuw">
                <Plus className="size-5" aria-hidden /> Plek toevoegen
              </LinkButton>
            }
          >
            Bewaar restaurants, cafés en overnachtingen langs de route, met beoordeling en notitie. Handig voor later, of om aan anderen aan te raden.
          </EmptyState>
        ) : (
          <>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Filter op type">
              <Chip active={type === 'alle'} onClick={() => setType('alle')}>
                Alle
              </Chip>
              {(Object.keys(placeTypeLabel) as PlaceType[]).map((t) => (
                <Chip key={t} active={type === t} onClick={() => setType(t)}>
                  {placeTypeEmoji[t]} {placeTypeLabel[t]}
                </Chip>
              ))}
            </div>
            <Field label="Etappe">{(id) => <StageSelect id={id} stages={stages} value={stageId} onChange={setStageId} noneLabel="Alle etappes" />}</Field>
            <MapView lines={lines} markers={markers} fit={markers.length ? 'all' : stageId ?? 'nl'} className="h-72" label="Kaart met plekken" />
            {list.length === 0 ? (
              <p className="py-6 text-center text-muted">Geen plekken die aan dit filter voldoen.</p>
            ) : (
              <ul className="space-y-2">
                {list.map((p) => {
                  const st = stages.find((s) => s.id === p.stageId)
                  return (
                    <li key={p.id} id={`plek-${p.id}`}>
                      <Card>
                        <div className="flex items-start gap-3">
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xl" aria-hidden>
                            {placeTypeEmoji[p.type]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h2 className="font-sans text-lg font-bold">{p.name}</h2>
                            <p className="text-sm text-muted">
                              {placeTypeLabel[p.type]}
                              {st && (
                                <>
                                  {' · '}
                                  <Link to={`/etappes/${st.id}`} className="font-semibold text-red">
                                    Etappe {st.number}
                                  </Link>
                                </>
                              )}
                              {p.price && ` · ${p.price}`}
                            </p>
                            {p.rating && <Stars value={p.rating} />}
                            {p.address && <p className="text-sm">{p.address}</p>}
                            {p.note && <p className="mt-1 font-serif">{p.note}</p>}
                            {p.website && (
                              <a href={p.website} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1 font-semibold text-red">
                                Website <ExternalLink className="size-4" aria-hidden />
                              </a>
                            )}
                          </div>
                          <div className="-mr-2 flex flex-col">
                            <button type="button" onClick={() => navigate(`/plekken/${p.id}/bewerken`)} className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`${p.name} bewerken`}>
                              <Pencil className="size-5" aria-hidden />
                            </button>
                            <button type="button" onClick={() => deleteWithUndo('place', p.id, 'plek')} className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`${p.name} verwijderen`}>
                              <Trash2 className="size-5" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </Page>
    </>
  )
}
