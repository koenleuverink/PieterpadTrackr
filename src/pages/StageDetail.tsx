import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, CheckCircle2, ChevronRight, MapPin, Pencil, Plus, Route as RouteIcon, Upload } from 'lucide-react'
import { Button, Card, ErrorBox, Field, LinkButton, Loading, Page, PageHeader, Sheet, Stars, StatusBadge, inputClass } from '../components/ui'
import { MapView, type MapMarker } from '../components/MapView'
import { stageLines } from '../components/mapLayers'
import { AddPhotoButtons, PhotoGrid } from '../components/Photos'
import { Markdown } from '../components/Markdown'
import { useDiary, usePhotos, usePlaces, useRoutes, useStage, useStages } from '../db/hooks'
import { byDateDesc, updateRecord } from '../db/repo'
import type { Stage, StageStatus } from '../db/types'
import { dateLong, dateShort, duration, durationInput, km, parseDuration, parseKm } from '../lib/format'
import { stageProgressKm } from '../lib/stats'
import { useFeedback } from '../components/Feedback'
import { officialStage } from '../data/stages'
import { placeTypeLabel } from './Places'

export default function StageDetail() {
  const { id } = useParams()
  const stage = useStage(id)
  const stages = useStages()
  const routes = useRoutes()
  const photos = usePhotos()
  const diary = useDiary()
  const places = usePlaces()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)

  const linkedRoutes = useMemo(() => routes?.filter((r) => r.stageId === id) ?? [], [routes, id])
  const stagePhotos = useMemo(() => photos?.filter((p) => p.stageId === id) ?? [], [photos, id])
  const entries = useMemo(() => diary?.filter((d) => d.stageId === id).sort(byDateDesc) ?? [], [diary, id])
  const stagePlaces = useMemo(() => places?.filter((p) => p.stageId === id) ?? [], [places, id])

  const lines = useMemo(() => {
    if (!stages || !stage) return []
    // Buuretappes gedimd, deze etappe uitgelicht, plus eigen routes.
    const near = stages.filter((s) => Math.abs(s.number - stage.number) <= 1)
    return stageLines(near, linkedRoutes, (s) => s.id !== stage.id && navigate(`/etappes/${s.id}`), stage.id)
  }, [stages, stage, linkedRoutes, navigate])

  const markers = useMemo<MapMarker[]>(
    () => [
      ...stagePlaces.filter((p) => p.lat != null && p.lon != null).map((p) => ({ id: p.id, lat: p.lat!, lon: p.lon!, type: p.type, label: p.name })),
      ...stagePhotos.filter((p) => p.lat != null && p.lon != null).map((p) => ({ id: p.id, lat: p.lat!, lon: p.lon!, type: 'photo' as const, label: p.caption || 'Foto' })),
    ],
    [stagePlaces, stagePhotos],
  )

  if (stage === undefined || !routes) return <Loading />
  if (!stage) return <ErrorBox>Deze etappe bestaat niet.</ErrorBox>

  const routeKm = linkedRoutes.reduce((s, r) => s + r.distanceKm, 0)
  const routeMin = linkedRoutes.reduce((s, r) => s + (r.durationMin ?? 0), 0)
  const ascent = linkedRoutes.reduce((s, r) => s + (r.ascentM ?? 0), 0)
  const prog = stageProgressKm(stage, routes)
  const official = officialStage(stage.number)

  return (
    <>
      <PageHeader
        back="/etappes"
        title={`Etappe ${stage.number}`}
        subtitle={stage.name}
        actions={
          <button type="button" onClick={() => setEditing(true)} className="flex size-12 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Gegevens bewerken">
            <Pencil className="size-6" aria-hidden />
          </button>
        }
      />
      <Page>
        <MapView lines={lines} markers={markers} fit={stage.id} className="h-72" label={`Kaart van etappe ${stage.number}`} />

        <Card>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-2xl">{stage.name}</h2>
              <p className="text-muted">
                {stage.from} → {stage.to}
              </p>
            </div>
            <StatusBadge walked={stage.status === 'gelopen'} partial={stage.status !== 'gelopen' && prog > 0} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <Stat label="Officiële afstand" value={km(stage.distanceKm, 0)} />
            <Stat label="Gelopen (GPS)" value={routeKm ? km(routeKm) : '–'} />
            <Stat label="Datum" value={stage.walkedDate ? dateShort(stage.walkedDate) : '–'} />
            <Stat label="Duur" value={duration(stage.durationMin ?? (routeMin || undefined))} />
            {ascent > 0 && <Stat label="Hoogtemeters" value={`${ascent} m`} />}
            {official && (
              <Stat
                label="Provincie"
                value={Object.keys(official.provinces).join(' / ')}
              />
            )}
          </dl>
          {stage.notes && (
            <div className="mt-4 border-t border-line pt-3">
              <Markdown text={stage.notes} />
            </div>
          )}
          {stage.status !== 'gelopen' && (
            <LinkButton to={`/etappes/afronden?etappe=${stage.id}`} className="mt-4 w-full">
              <CheckCircle2 className="size-5" aria-hidden /> Etappe afronden
            </LinkButton>
          )}
        </Card>

        <Section title="Routes" icon={<RouteIcon className="size-5" aria-hidden />}>
          {linkedRoutes.length ? (
            <ul className="divide-y divide-line">
              {linkedRoutes.map((r) => (
                <li key={r.id}>
                  <Link to={`/routes/${r.id}`} className="flex min-h-14 items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.name}</span>
                      <span className="text-sm text-muted">
                        {[r.date && dateShort(r.date), km(r.distanceKm), r.durationMin && duration(r.durationMin)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <ChevronRight className="size-5 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Nog geen route. Importeer een GPX-, TCX- of FIT-bestand van je horloge of app, of voer de gegevens handmatig in.</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <LinkButton variant="secondary" to={`/routes/importeren?etappe=${stage.id}`}>
              <Upload className="size-5" aria-hidden /> Importeren
            </LinkButton>
            <LinkButton variant="secondary" to={`/routes/nieuw?etappe=${stage.id}`}>
              <Plus className="size-5" aria-hidden /> Handmatig
            </LinkButton>
          </div>
        </Section>

        <Section title={`Foto’s${stagePhotos.length ? ` (${stagePhotos.length})` : ''}`}>
          <PhotoGrid photos={stagePhotos} emptyText="Nog geen foto’s bij deze etappe." />
          <div className="mt-3">
            <AddPhotoButtons stageId={stage.id} />
          </div>
        </Section>

        <Section title="Dagboek" icon={<BookOpen className="size-5" aria-hidden />}>
          {entries.length ? (
            <ul className="space-y-4">
              {entries.map((e) => (
                <li key={e.id}>
                  <Link to={`/dagboek#${e.id}`} className="block">
                    <p className="text-sm text-muted">{dateLong(e.date)}</p>
                    {e.title && <p className="font-serif text-lg font-bold">{e.title}</p>}
                    <div className="line-clamp-3">
                      <Markdown text={e.text} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Nog niets geschreven over deze etappe.</p>
          )}
          <LinkButton variant="secondary" to={`/dagboek/nieuw?etappe=${stage.id}`} className="mt-3 w-full">
            <Plus className="size-5" aria-hidden /> Dagboekentry
          </LinkButton>
        </Section>

        <Section title="Plekken" icon={<MapPin className="size-5" aria-hidden />}>
          {stagePlaces.length ? (
            <ul className="divide-y divide-line">
              {stagePlaces.map((p) => (
                <li key={p.id}>
                  <Link to={`/plekken/${p.id}/bewerken`} className="flex min-h-14 items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.name}</span>
                      <span className="text-sm text-muted">{placeTypeLabel[p.type]}</span>
                    </span>
                    {p.rating && <Stars value={p.rating} />}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Nog geen restaurants, cafés of overnachtingen bij deze etappe.</p>
          )}
          <LinkButton variant="secondary" to={`/plekken/nieuw?etappe=${stage.id}`} className="mt-3 w-full">
            <Plus className="size-5" aria-hidden /> Plek toevoegen
          </LinkButton>
        </Section>
      </Page>
      {editing && <StageEditSheet stage={stage} open onClose={() => setEditing(false)} />}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-lg font-bold">{value}</dd>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-lg">
        {icon}
        {title}
      </h2>
      {children}
    </Card>
  )
}

function StageEditSheet({ stage, open, onClose }: { stage: Stage; open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<StageStatus>(stage.status)
  const [date, setDate] = useState(stage.walkedDate ?? '')
  const [dur, setDur] = useState(durationInput(stage.durationMin))
  const [dist, setDist] = useState(String(stage.distanceKm).replace('.', ','))
  const [notes, setNotes] = useState(stage.notes ?? '')
  const [error, setError] = useState<string>()
  const { toast, confirm } = useFeedback()

  const save = async () => {
    const durationMin = dur.trim() ? parseDuration(dur) : undefined
    if (dur.trim() && durationMin == null) return setError('De duur begrijp ik niet. Gebruik bijvoorbeeld 4:30 of 270.')
    const distanceKm = parseKm(dist)
    if (distanceKm == null || distanceKm <= 0) return setError('Vul een geldige afstand in, bijvoorbeeld 21 of 21,5.')
    if (stage.status === 'gelopen' && status === 'gepland') {
      const ok = await confirm({ title: 'Terugzetten naar gepland?', message: 'De etappe telt dan niet meer mee in je voortgang. Routes, foto’s en dagboek blijven bewaard.', confirmLabel: 'Terugzetten' })
      if (!ok) return
    }
    await updateRecord('stage', stage.id, { status, walkedDate: date || undefined, durationMin, distanceKm, notes: notes.trim() || undefined })
    toast('Etappe bijgewerkt', { tone: 'success' })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Etappe ${stage.number} bewerken`}>
      <div className="space-y-4">
        <Field label="Status">
          {(id) => (
            <select id={id} className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as StageStatus)}>
              <option value="gepland">Gepland</option>
              <option value="gelopen">Gelopen</option>
            </select>
          )}
        </Field>
        <Field label="Datum gelopen">{(id) => <input id={id} type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Duur" hint="Bijvoorbeeld 4:30 (uren:minuten) of 270 (minuten).">
          {(id) => <input id={id} inputMode="numeric" className={inputClass} value={dur} onChange={(e) => setDur(e.target.value)} placeholder="u:mm" />}
        </Field>
        <Field label="Afstand (km)" hint="Standaard de officiële afstand van pieterpad.nl.">
          {(id) => <input id={id} inputMode="decimal" className={inputClass} value={dist} onChange={(e) => setDist(e.target.value)} />}
        </Field>
        <Field label="Notities">{(id) => <textarea id={id} rows={4} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button className="w-full" onClick={save}>
          Opslaan
        </Button>
      </div>
    </Sheet>
  )
}
