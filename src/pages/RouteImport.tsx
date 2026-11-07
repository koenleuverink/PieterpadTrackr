import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileUp, Plus, Trash2, Wand2 } from 'lucide-react'
import { Button, Card, ErrorBox, Field, LinkButton, Loading, Page, PageHeader, inputClass } from '../components/ui'
import { MapView } from '../components/MapView'
import { StageSelect } from '../components/StageSelect'
import { useStages } from '../db/hooks'
import { addRecord, updateRecord } from '../db/repo'
import { parseTrackFile, TrackParseError, type ParsedTrack } from '../lib/trackParse'
import { describeMatch, matchStages, type StageMatch } from '../lib/matchStage'
import { stageId as toStageId } from '../data/stages'
import { dateShort, duration, km } from '../lib/format'
import { useFeedback } from '../components/Feedback'
import { db } from '../db/db'

interface Item {
  key: string
  track: ParsedTrack
  matches: StageMatch[]
  name: string
  stageId?: string
  markWalked: boolean
}

export default function RouteImport() {
  const stages = useStages()
  const [params] = useSearchParams()
  const presetStage = params.get('etappe') ?? undefined
  const [items, setItems] = useState<Item[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { toast } = useFeedback()

  const handleFiles = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    const errs: string[] = []
    const next: Item[] = []
    for (const f of files) {
      try {
        const track = await parseTrackFile(f)
        const matches = matchStages(track.points)
        const best = matches[0]
        const suggested = best && best.onRoute >= 0.5 ? toStageId(best.stage.number) : undefined
        next.push({
          key: `${f.name}-${f.size}-${Math.random()}`,
          track,
          matches,
          name: track.name,
          stageId: presetStage ?? suggested,
          markWalked: !!best && best.coverage >= 0.85 && best.onRoute >= 0.8 && (presetStage ?? suggested) === suggested,
        })
      } catch (e) {
        errs.push(e instanceof TrackParseError ? e.message : `"${f.name}" kon niet gelezen worden.`)
      }
    }
    setItems((cur) => [...cur, ...next])
    setErrors(errs)
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  const update = (key: string, patch: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const saveAll = async () => {
    setSaving(true)
    try {
      let marked = 0
      for (const it of items) {
        await addRecord('route', { ...it.track, name: it.name.trim() || it.track.name, stageId: it.stageId })
        if (it.stageId && it.markWalked) {
          const st = await db.stages.get(it.stageId)
          if (st && st.status !== 'gelopen') {
            await updateRecord('stage', st.id, { status: 'gelopen', walkedDate: it.track.date ?? st.walkedDate, durationMin: st.durationMin ?? it.track.durationMin })
            marked++
          }
        }
      }
      toast(`${items.length === 1 ? 'Route' : `${items.length} routes`} opgeslagen${marked ? `, ${marked} etappe${marked > 1 ? 's' : ''} op gelopen gezet` : ''}`, { tone: 'success' })
      const single = items.length === 1 ? items[0].stageId : undefined
      navigate(single ? `/etappes/${single}` : '/etappes', { replace: true })
    } catch (e) {
      toast(`Opslaan mislukt: ${e instanceof Error ? e.message : String(e)}`, { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (!stages) return <Loading />

  return (
    <>
      <PageHeader back title="Route importeren" />
      <Page>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            void handleFiles(Array.from(e.dataTransfer.files))
          }}
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${drag ? 'border-red bg-red-soft' : 'border-line'}`}
        >
          <FileUp className="mx-auto size-10 text-muted" aria-hidden />
          <p className="mt-2 font-semibold">Kies één of meer GPX-, TCX- of FIT-bestanden</p>
          <p className="text-sm text-muted">Afstand, duur, datum en hoogtemeters worden automatisch uitgelezen, en de app stelt voor bij welke etappe de route hoort.</p>
          <input
            ref={input}
            type="file"
            multiple
            accept=".gpx,.tcx,.fit,application/gpx+xml,application/vnd.garmin.tcx+xml,application/octet-stream"
            className="sr-only"
            id="trackfiles"
            onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
          />
          <Button className="mt-4" onClick={() => input.current?.click()} busy={busy}>
            Bestanden kiezen
          </Button>
          <p className="mt-3 text-sm text-muted">
            Geen bestand?{' '}
            <a href={`/routes/nieuw${presetStage ? `?etappe=${presetStage}` : ''}`} onClick={(e) => { e.preventDefault(); navigate(`/routes/nieuw${presetStage ? `?etappe=${presetStage}` : ''}`) }} className="font-semibold text-red underline">
              Voer de route handmatig in
            </a>
          </p>
        </div>

        {errors.length > 0 && (
          <ErrorBox>
            <ul className="space-y-1">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </ErrorBox>
        )}

        {items.map((it) => (
          <ImportCard key={it.key} item={it} stages={stages} onChange={(p) => update(it.key, p)} onRemove={() => setItems((c) => c.filter((x) => x.key !== it.key))} />
        ))}

        {items.length > 0 && (
          <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10">
            <Button className="w-full shadow-lg" onClick={saveAll} busy={saving}>
              {items.length === 1 ? 'Route opslaan' : `${items.length} routes opslaan`}
            </Button>
          </div>
        )}

        {items.length === 0 && !busy && (
          <LinkButton variant="ghost" to={`/routes/nieuw${presetStage ? `?etappe=${presetStage}` : ''}`} className="w-full">
            <Plus className="size-5" aria-hidden /> Handmatig toevoegen zonder bestand
          </LinkButton>
        )}
      </Page>
    </>
  )
}

function ImportCard({ item, stages, onChange, onRemove }: { item: Item; stages: import('../db/types').Stage[]; onChange: (p: Partial<Item>) => void; onRemove: () => void }) {
  const t = item.track
  const lines = useMemo(() => [{ id: item.key, points: t.points, kind: 'highlight' as const }], [item.key, t.points])
  const best = item.matches[0]
  const selected = stages.find((s) => s.id === item.stageId)
  return (
    <Card>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted">{t.fileName}</p>
        </div>
        <button type="button" onClick={onRemove} className="-mt-2 -mr-2 flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`${t.fileName} niet importeren`}>
          <Trash2 className="size-5" aria-hidden />
        </button>
      </div>
      <MapView lines={lines} fit={item.key} className="mt-2 h-44" interactive={false} label={`Voorbeeld van ${t.fileName}`} />
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Info label="Afstand" value={km(t.distanceKm)} />
        <Info label="Datum" value={t.date ? dateShort(t.date) : 'onbekend'} />
        <Info label="Duur" value={duration(t.durationMin)} />
        <Info label="Hoogtemeters" value={t.ascentM != null ? `↑ ${t.ascentM} m` : '–'} />
      </dl>
      <div className="mt-4 space-y-3">
        <Field label="Naam">{(id) => <input id={id} className={inputClass} value={item.name} onChange={(e) => onChange({ name: e.target.value })} />}</Field>
        <Field
          label="Etappe"
          hint={
            best ? (
              <span className="inline-flex items-start gap-1">
                <Wand2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {describeMatch(best)}
                  {best.reversed ? ' (omgekeerde richting)' : ''}.
                </span>
              </span>
            ) : (
              'Deze route ligt niet op het Pieterpad. Je kunt hem los opslaan, bijvoorbeeld als omleiding of extra wandeling.'
            )
          }
        >
          {(id) => <StageSelect id={id} stages={stages} value={item.stageId} onChange={(v) => onChange({ stageId: v })} />}
        </Field>
        {selected && selected.status !== 'gelopen' && (
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" className="size-6 accent-[var(--c-red)]" checked={item.markWalked} onChange={(e) => onChange({ markWalked: e.target.checked })} />
            <span>Etappe {selected.number} direct op “gelopen” zetten</span>
          </label>
        )}
      </div>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  )
}
