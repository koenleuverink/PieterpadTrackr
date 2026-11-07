import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Crosshair, Search, Trash2 } from 'lucide-react'
import { Button, ErrorBox, Field, Loading, Page, PageHeader, Stars, inputClass } from '../components/ui'
import { StageSelect } from '../components/StageSelect'
import { MapView } from '../components/MapView'
import { stageLines } from '../components/mapLayers'
import { usePlace, useStages } from '../db/hooks'
import { addRecord, updateRecord } from '../db/repo'
import type { PlaceType } from '../db/types'
import { useFeedback } from '../components/Feedback'
import { placeTypeEmoji, placeTypeLabel } from './Places'
import { officialStage, stageId as toStageId, OFFICIAL_STAGES } from '../data/stages'
import { distToLine } from '../lib/geo'

export default function PlaceEdit() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const existing = usePlace(id)
  const stages = useStages()
  const navigate = useNavigate()
  const { toast, deleteWithUndo } = useFeedback()

  const [type, setType] = useState<PlaceType>('restaurant')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<[number, number]>()
  const [website, setWebsite] = useState('')
  const [rating, setRating] = useState<number>()
  const [note, setNote] = useState('')
  const [price, setPrice] = useState('')
  const [stageId, setStageId] = useState<string | undefined>(params.get('etappe') ?? undefined)
  const [error, setError] = useState<string>()
  const [locating, setLocating] = useState(false)
  const [searching, setSearching] = useState(false)
  const [loaded, setLoaded] = useState(!id)

  useEffect(() => {
    if (!existing || loaded) return
    setType(existing.type)
    setName(existing.name)
    setAddress(existing.address ?? '')
    setCoords(existing.lat != null && existing.lon != null ? [existing.lat, existing.lon] : undefined)
    setWebsite(existing.website ?? '')
    setRating(existing.rating)
    setNote(existing.note ?? '')
    setPrice(existing.price ?? '')
    setStageId(existing.stageId)
    setLoaded(true)
  }, [existing, loaded])

  const setPoint = (lat: number, lon: number) => {
    setCoords([lat, lon])
    // Dichtstbijzijnde etappe voorstellen als er nog geen gekozen is.
    if (!stageId) {
      let best: { n: number; d: number } | undefined
      for (const s of OFFICIAL_STAGES) {
        const { dist } = distToLine([lat, lon], s.line)
        if (!best || dist < best.d) best = { n: s.number, d: dist }
      }
      if (best && best.d < 5000) setStageId(toStageId(best.n))
    }
  }

  const lines = useMemo(() => {
    if (!stages) return []
    const st = stages.find((s) => s.id === stageId)
    return stageLines(st ? [st] : stages, [])
  }, [stages, stageId])
  const markers = useMemo(() => (coords ? [{ id: 'p', lat: coords[0], lon: coords[1], type, label: name || 'Nieuwe plek' }] : []), [coords, type, name])

  if (!stages || (id && !loaded)) return <Loading />

  const locate = () => {
    if (!navigator.geolocation) return toast('Je apparaat ondersteunt geen locatiebepaling.', { tone: 'error' })
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint(pos.coords.latitude, pos.coords.longitude)
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        toast(err.code === err.PERMISSION_DENIED ? 'Geen toestemming voor je locatie. Sta dit toe in de instellingen van je telefoon.' : 'Je locatie kon niet bepaald worden. Probeer het buiten nog eens.', { tone: 'error' })
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const searchAddress = async () => {
    const q = [name, address].filter(Boolean).join(', ')
    if (!q) return toast('Vul eerst een naam of adres in.')
    if (!navigator.onLine) return toast('Adres zoeken werkt alleen met internet. Je kunt ook op de kaart tikken.', { tone: 'error' })
    setSearching(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=nl,de,be&accept-language=nl&q=${encodeURIComponent(q)}`
      const res = await fetch(url)
      const data = (await res.json()) as { lat: string; lon: string; display_name: string }[]
      if (!data.length) toast('Niets gevonden. Probeer alleen het adres of tik op de kaart.', { tone: 'error' })
      else {
        setPoint(parseFloat(data[0].lat), parseFloat(data[0].lon))
        if (!address) setAddress(data[0].display_name.split(',').slice(0, 3).join(',').trim())
      }
    } catch {
      toast('Adres zoeken mislukt. Tik in plaats daarvan op de kaart.', { tone: 'error' })
    } finally {
      setSearching(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Geef de plek een naam.')
    let site = website.trim()
    if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`
    const data = {
      type,
      name: name.trim(),
      address: address.trim() || undefined,
      lat: coords?.[0],
      lon: coords?.[1],
      website: site || undefined,
      rating,
      note: note.trim() || undefined,
      price: price.trim() || undefined,
      stageId,
    }
    if (id) await updateRecord('place', id, data)
    else await addRecord('place', data)
    toast(id ? 'Plek bijgewerkt' : 'Plek toegevoegd', { tone: 'success' })
    navigate(-1)
  }

  const st = stages.find((s) => s.id === stageId)

  return (
    <>
      <PageHeader back title={id ? 'Plek bewerken' : 'Plek toevoegen'} />
      <Page>
        <form onSubmit={submit} className="space-y-4">
          <fieldset>
            <legend className="mb-2 font-semibold">Type</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(placeTypeLabel) as PlaceType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={`flex min-h-16 flex-col items-center justify-center rounded-xl border-2 text-sm font-semibold ${type === t ? 'border-ink bg-ink text-bg' : 'border-line bg-surface'}`}
                >
                  <span className="text-xl" aria-hidden>
                    {placeTypeEmoji[t]}
                  </span>
                  {placeTypeLabel[t]}
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Naam">{(fid) => <input id={fid} required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Adres">{(fid) => <input id={fid} className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />}</Field>
          <div className="space-y-2">
            <p className="font-semibold">Locatie</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={locate} busy={locating}>
                <Crosshair className="size-5" aria-hidden /> Hier ben ik
              </Button>
              <Button variant="secondary" onClick={searchAddress} busy={searching}>
                <Search className="size-5" aria-hidden /> Zoek adres
              </Button>
            </div>
            <MapView lines={lines} markers={markers} fit={coords ? 'all' : st?.id ?? 'nl'} onMapClick={setPoint} className="h-56" label="Tik op de kaart om de locatie te kiezen" />
            <p className="text-sm text-muted">{coords ? `Gekozen: ${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}. Tik op de kaart om te verplaatsen.` : 'Tik op de kaart om de locatie te kiezen.'}</p>
            {coords && (
              <button type="button" className="min-h-11 text-sm font-semibold text-red" onClick={() => setCoords(undefined)}>
                Locatie wissen
              </button>
            )}
          </div>
          <Field label="Etappe" hint={st && officialStage(st.number) ? undefined : 'Wordt automatisch voorgesteld als je een locatie kiest.'}>
            {(fid) => <StageSelect id={fid} stages={stages} value={stageId} onChange={setStageId} noneLabel="Geen etappe" />}
          </Field>
          <div>
            <p className="mb-1 font-semibold">Beoordeling</p>
            <Stars value={rating} onChange={setRating} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prijs (optioneel)">{(fid) => <input id={fid} className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="€ 85 p.n." />}</Field>
            <Field label="Website">{(fid) => <input id={fid} type="url" inputMode="url" className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www…" />}</Field>
          </div>
          <Field label="Notitie">{(fid) => <textarea id={fid} rows={3} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button type="submit" className="w-full">
            Opslaan
          </Button>
          {id && (
            <Button variant="danger" className="w-full" onClick={() => deleteWithUndo('place', id, 'plek', { onDeleted: () => navigate('/plekken', { replace: true }) })}>
              <Trash2 className="size-5" aria-hidden /> Plek verwijderen
            </Button>
          )}
        </form>
      </Page>
    </>
  )
}
