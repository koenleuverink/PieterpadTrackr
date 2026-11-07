import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BookOpen, Camera, PartyPopper } from 'lucide-react'
import { Button, ErrorBox, Field, Loading, Page, PageHeader, Sheet, inputClass } from '../components/ui'
import { StageSelect } from '../components/StageSelect'
import { useRoutes, useStages } from '../db/hooks'
import { updateRecord } from '../db/repo'
import { db } from '../db/db'
import { duration, durationInput, km, parseDuration, percent, todayIso } from '../lib/format'
import { computeStats } from '../lib/stats'
import { queueHomeyEvent } from '../lib/homey'
import { useFeedback } from '../components/Feedback'

export default function StageComplete() {
  const stages = useStages()
  const routes = useRoutes()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useFeedback()

  const [stageId, setStageId] = useState<string | undefined>(params.get('etappe') ?? undefined)
  const [date, setDate] = useState(todayIso())
  const [dur, setDur] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ stageId: string; number: number; km: number; total: number; pct: number } | null>(null)

  // Standaard: eerstvolgende niet-gelopen etappe.
  useEffect(() => {
    if (!stageId && stages) setStageId(stages.find((s) => s.status !== 'gelopen')?.id ?? stages[0]?.id)
  }, [stages, stageId])

  const linked = useMemo(() => routes?.filter((r) => r.stageId === stageId) ?? [], [routes, stageId])

  // Duur en datum voorstellen vanuit gekoppelde routes.
  useEffect(() => {
    if (!linked.length) return
    const mins = linked.reduce((s, r) => s + (r.durationMin ?? 0), 0)
    if (mins && !dur) setDur(durationInput(mins))
    const dates = linked.map((r) => r.date).filter(Boolean).sort() as string[]
    if (dates.length) setDate(dates[dates.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked])

  if (!stages || !routes) return <Loading />
  const stage = stages.find((s) => s.id === stageId)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)
    if (!stage) return setError('Kies eerst een etappe.')
    const durationMin = dur.trim() ? parseDuration(dur) : undefined
    if (dur.trim() && durationMin == null) return setError('De duur begrijp ik niet. Gebruik bijvoorbeeld 4:30 of 270.')
    setBusy(true)
    try {
      await updateRecord('stage', stage.id, {
        status: 'gelopen',
        walkedDate: date || todayIso(),
        durationMin,
        notes: [stage.notes, notes.trim()].filter(Boolean).join('\n\n') || undefined,
      })
      const fresh = await db.stages.toArray()
      const st = computeStats(fresh, routes)
      const routeKm = linked.reduce((s, r) => s + r.distanceKm, 0)
      const stageKm = routeKm || stage.distanceKm
      await queueHomeyEvent({
        etappe: stage.number,
        naam: stage.name,
        km: Math.round(stageKm * 10) / 10,
        totaalKm: st.progressKm,
        procent: Math.round(st.percent * 10) / 10,
        datum: date,
      }).catch(() => toast('Homey-melding kon niet verstuurd worden; we proberen het later opnieuw.', { tone: 'error' }))
      setDone({ stageId: stage.id, number: stage.number, km: stageKm, total: st.progressKm, pct: st.percent })
    } catch (err) {
      setError(`Opslaan mislukt: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader back title="Etappe afronden" />
      <Page>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Etappe">{(id) => <StageSelect id={id} stages={stages} value={stageId} onChange={setStageId} allowNone={false} />}</Field>
          {stage?.status === 'gelopen' && !done && <p className="rounded-xl bg-surface-2 p-3 text-sm">Deze etappe staat al op gelopen. Opslaan werkt de gegevens bij.</p>}
          {stage && (
            <p className="text-muted">
              {km(stage.distanceKm, 0)} officieel
              {linked.length > 0 && ` · ${linked.length} gekoppelde route${linked.length > 1 ? 's' : ''}: ${km(linked.reduce((s, r) => s + r.distanceKm, 0))}`}
            </p>
          )}
          <Field label="Datum">{(id) => <input id={id} type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Duur (optioneel)" hint={`Bijvoorbeeld 4:30 of 270 minuten${dur && parseDuration(dur) ? ` = ${duration(parseDuration(dur))}` : ''}.`}>
            {(id) => <input id={id} inputMode="numeric" placeholder="u:mm" className={inputClass} value={dur} onChange={(e) => setDur(e.target.value)} />}
          </Field>
          <Field label="Korte notitie (optioneel)">{(id) => <textarea id={id} rows={3} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
          <p className="text-sm text-muted">Heb je een GPX-bestand? Importeer dat via + → Route importeren; dan worden afstand en tijd automatisch ingevuld.</p>
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button type="submit" className="w-full" busy={busy}>
            Markeer als gelopen
          </Button>
        </form>
      </Page>
      <Sheet open={!!done} onClose={() => navigate(`/etappes/${done?.stageId}`)} title="Goed gelopen!">
        {done && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <PartyPopper className="size-10 shrink-0 text-red" aria-hidden />
              <p>
                Etappe {done.number} is afgerond. Je hebt nu <strong>{km(done.total, 0)}</strong> gelopen, dat is <strong>{percent(done.pct)}</strong> van het Pieterpad.
              </p>
            </div>
            <div className="grid gap-2">
              <Button onClick={() => navigate(`/dagboek/nieuw?etappe=${done.stageId}`, { replace: true })}>
                <BookOpen className="size-5" aria-hidden /> Dagboekentry schrijven
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/fotos/nieuw?etappe=${done.stageId}`, { replace: true })}>
                <Camera className="size-5" aria-hidden /> Foto’s toevoegen
              </Button>
              <Button variant="ghost" onClick={() => navigate(`/etappes/${done.stageId}`, { replace: true })}>
                Later
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}
