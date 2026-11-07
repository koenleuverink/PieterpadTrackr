import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Chip, ErrorBox, Field, Loading, Page, PageHeader, inputClass } from '../components/ui'
import { StageSelect } from '../components/StageSelect'
import { AddPhotoButtons, PhotoGrid } from '../components/Photos'
import { Markdown } from '../components/Markdown'
import { useDiaryEntry, usePhotos, useStages } from '../db/hooks'
import { addRecord, updateRecord } from '../db/repo'
import { uid } from '../db/db'
import type { Mood, Weather } from '../db/types'
import { todayIso } from '../lib/format'
import { useFeedback } from '../components/Feedback'

export const MOODS: { value: Mood; label: string }[] = [
  { value: 'geweldig', label: '😄 Geweldig' },
  { value: 'goed', label: '🙂 Goed' },
  { value: 'oké', label: '😐 Oké' },
  { value: 'zwaar', label: '😓 Zwaar' },
  { value: 'afzien', label: '🥵 Afzien' },
]
export const WEATHER: { value: Weather; label: string }[] = [
  { value: 'zon', label: '☀️ Zon' },
  { value: 'half bewolkt', label: '⛅ Half bewolkt' },
  { value: 'bewolkt', label: '☁️ Bewolkt' },
  { value: 'regen', label: '🌧 Regen' },
  { value: 'wind', label: '💨 Wind' },
  { value: 'warm', label: '🥵 Warm' },
  { value: 'koud', label: '🥶 Koud' },
  { value: 'sneeuw', label: '❄️ Sneeuw' },
]

const DRAFT_KEY = 'pp-diary-draft'

export default function DiaryEdit() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const existing = useDiaryEntry(id)
  const stages = useStages()
  const photos = usePhotos()
  const navigate = useNavigate()
  const { toast } = useFeedback()

  // Voor een nieuwe entry maken we het id vooraf aan, zodat foto's er direct aan gekoppeld kunnen worden.
  const entryId = useRef(id ?? uid()).current
  const [date, setDate] = useState(todayIso())
  const [stageId, setStageId] = useState<string | undefined>(params.get('etappe') ?? undefined)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [mood, setMood] = useState<Mood>()
  const [weather, setWeather] = useState<Weather>()
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState<string>()
  const [loaded, setLoaded] = useState(!id)
  const saved = useRef(false)

  useEffect(() => {
    if (id) {
      if (!existing || loaded) return
      setDate(existing.date)
      setStageId(existing.stageId)
      setTitle(existing.title ?? '')
      setText(existing.text)
      setMood(existing.mood)
      setWeather(existing.weather)
      setLoaded(true)
      return
    }
    // Concept van een eerder niet-opgeslagen entry terughalen.
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
      if (d?.text || d?.title) {
        setTitle(d.title ?? '')
        setText(d.text ?? '')
        if (!params.get('etappe') && d.stageId) setStageId(d.stageId)
        toast('Je niet-opgeslagen concept is teruggezet.')
      }
    } catch {
      /* geen concept */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, id])

  // Nieuw: concept automatisch bewaren.
  useEffect(() => {
    if (id || saved.current) return
    try {
      if (text || title) localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, text, stageId }))
    } catch {
      /* opslag vol of geblokkeerd */
    }
  }, [id, title, text, stageId])

  // Bij een etappe: datum voorstellen = datum gelopen.
  useEffect(() => {
    if (id || !stages || !stageId) return
    const st = stages.find((s) => s.id === stageId)
    if (st?.walkedDate) setDate(st.walkedDate)
  }, [id, stageId, stages])

  const entryPhotos = useMemo(() => photos?.filter((p) => p.diaryId === entryId) ?? [], [photos, entryId])

  if (!stages || (id && !loaded)) return <Loading />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() && !title.trim() && !entryPhotos.length) return setError('Schrijf iets of voeg een foto toe.')
    const data = { date, stageId, title: title.trim() || undefined, text, mood, weather }
    if (id) await updateRecord('diary', id, data)
    else await addRecord('diary', { ...data, id: entryId })
    // Foto's die bij deze entry horen ook aan de etappe koppelen.
    for (const p of entryPhotos) if (stageId && p.stageId !== stageId) await updateRecord('photo', p.id, { stageId })
    saved.current = true
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* */
    }
    toast(id ? 'Entry bijgewerkt' : 'Entry opgeslagen', { tone: 'success' })
    navigate(`/dagboek#${entryId}`, { replace: true })
  }

  return (
    <>
      <PageHeader back title={id ? 'Entry bewerken' : 'Nieuwe dagboekentry'} />
      <Page>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Datum">{(fid) => <input id={fid} type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Field label="Etappe">{(fid) => <StageSelect id={fid} stages={stages} value={stageId} onChange={setStageId} noneLabel="Geen" />}</Field>
          </div>
          <Field label="Titel (optioneel)">{(fid) => <input id={fid} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Door de mist over de Hondsrug" />}</Field>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="diary-text" className="font-semibold">
                Tekst
              </label>
              <div className="flex gap-1" role="group" aria-label="Weergave">
                <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${!preview ? 'bg-surface-2' : 'text-muted'}`}>
                  Schrijven
                </button>
                <button type="button" aria-pressed={preview} onClick={() => setPreview(true)} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${preview ? 'bg-surface-2' : 'text-muted'}`}>
                  Voorbeeld
                </button>
              </div>
            </div>
            {preview ? (
              <div className="min-h-48 rounded-xl border-2 border-line bg-surface p-3">{text ? <Markdown text={text} /> : <p className="text-muted">Nog niets geschreven.</p>}</div>
            ) : (
              <textarea id="diary-text" rows={9} className={`${inputClass} font-serif text-[1.05rem]`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hoe was de wandeling? Markdown mag: **vet**, *schuin*, - lijstjes." />
            )}
          </div>
          <fieldset>
            <legend className="mb-2 font-semibold">Stemming (optioneel)</legend>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <Chip key={m.value} active={mood === m.value} onClick={() => setMood(mood === m.value ? undefined : m.value)}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">Weer (optioneel)</legend>
            <div className="flex flex-wrap gap-2">
              {WEATHER.map((w) => (
                <Chip key={w.value} active={weather === w.value} onClick={() => setWeather(weather === w.value ? undefined : w.value)}>
                  {w.label}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="mb-2 font-semibold">Foto’s</legend>
            <PhotoGrid photos={entryPhotos} />
            <AddPhotoButtons diaryId={entryId} stageId={stageId} />
          </fieldset>
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button type="submit" className="w-full">
            Opslaan
          </Button>
        </form>
      </Page>
    </>
  )
}
