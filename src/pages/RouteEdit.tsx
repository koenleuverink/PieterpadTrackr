import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, ErrorBox, Field, Loading, Page, PageHeader, inputClass } from '../components/ui'
import { StageSelect } from '../components/StageSelect'
import { useRoute, useStages } from '../db/hooks'
import { addRecord, updateRecord } from '../db/repo'
import { durationInput, parseDuration, parseKm, todayIso } from '../lib/format'
import { useFeedback } from '../components/Feedback'

/** Route handmatig toevoegen (zonder GPX) of een bestaande route bewerken. */
export default function RouteEdit() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const existing = useRoute(id)
  const stages = useStages()
  const navigate = useNavigate()
  const { toast } = useFeedback()

  const [name, setName] = useState('')
  const [stageId, setStageId] = useState<string | undefined>(params.get('etappe') ?? undefined)
  const [date, setDate] = useState(todayIso())
  const [dist, setDist] = useState('')
  const [dur, setDur] = useState('')
  const [ascent, setAscent] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string>()
  const [loaded, setLoaded] = useState(!id)

  useEffect(() => {
    if (!existing || loaded) return
    setName(existing.name)
    setStageId(existing.stageId)
    setDate(existing.date ?? '')
    setDist(String(existing.distanceKm).replace('.', ','))
    setDur(durationInput(existing.durationMin))
    setAscent(existing.ascentM != null ? String(existing.ascentM) : '')
    setNotes(existing.notes ?? '')
    setLoaded(true)
  }, [existing, loaded])

  // Nieuwe handmatige route: naam en afstand voorstellen op basis van de etappe.
  useEffect(() => {
    if (id || !stages || !stageId) return
    const st = stages.find((s) => s.id === stageId)
    if (st && !name) setName(`Etappe ${st.number}: ${st.name}`)
    if (st && !dist) setDist(String(st.distanceKm))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId, stages])

  if (!stages || (id && !loaded)) return <Loading />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)
    const distanceKm = parseKm(dist)
    if (!name.trim()) return setError('Geef de route een naam.')
    if (distanceKm == null || distanceKm <= 0) return setError('Vul de afstand in kilometers in, bijvoorbeeld 12,5.')
    const durationMin = dur.trim() ? parseDuration(dur) : undefined
    if (dur.trim() && durationMin == null) return setError('De duur begrijp ik niet. Gebruik bijvoorbeeld 3:15 of 195.')
    const ascentM = ascent.trim() ? parseInt(ascent, 10) : undefined
    const data = { name: name.trim(), stageId, date: date || undefined, distanceKm, durationMin, ascentM: Number.isFinite(ascentM) ? ascentM : undefined, notes: notes.trim() || undefined }
    if (id) {
      await updateRecord('route', id, data)
      toast('Route bijgewerkt', { tone: 'success' })
      navigate(`/routes/${id}`, { replace: true })
    } else {
      const newId = await addRecord('route', { ...data, source: 'handmatig', points: [] })
      toast('Route toegevoegd', { tone: 'success' })
      navigate(`/routes/${newId}`, { replace: true })
    }
  }

  return (
    <>
      <PageHeader back title={id ? 'Route bewerken' : 'Route handmatig toevoegen'} />
      <Page>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Etappe" hint="Laat leeg voor een losse route, zoals een omleiding.">
            {(fid) => <StageSelect id={fid} stages={stages} value={stageId} onChange={setStageId} />}
          </Field>
          <Field label="Naam">{(fid) => <input id={fid} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Haren – Zuidlaren (deel 2)" />}</Field>
          <Field label="Datum">{(fid) => <input id={fid} type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Afstand (km)">{(fid) => <input id={fid} inputMode="decimal" className={inputClass} value={dist} onChange={(e) => setDist(e.target.value)} />}</Field>
            <Field label="Duur">{(fid) => <input id={fid} inputMode="numeric" placeholder="u:mm" className={inputClass} value={dur} onChange={(e) => setDur(e.target.value)} />}</Field>
          </div>
          <Field label="Hoogtemeters (optioneel)">{(fid) => <input id={fid} inputMode="numeric" className={inputClass} value={ascent} onChange={(e) => setAscent(e.target.value)} />}</Field>
          <Field label="Notities">{(fid) => <textarea id={fid} rows={3} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button type="submit" className="w-full">
            Opslaan
          </Button>
        </form>
      </Page>
    </>
  )
}
