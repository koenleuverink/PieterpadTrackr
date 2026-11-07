import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Cloud, Download, LogOut, RefreshCw, Send, Upload, Webhook } from 'lucide-react'
import { Button, Card, ErrorBox, Field, Page, PageHeader, inputClass } from '../components/ui'
import { useFeedback } from '../components/Feedback'
import { getSupabase, saveSupabaseConfig, supabaseConfig, clearSupabaseConfig } from '../lib/supabase'
import { markAllDirty, pendingCount, syncNow, useSyncStatus } from '../lib/sync'
import { DEFAULT_HOMEY, getHomeySettings, saveHomeySettings, sendTest, buildRequest, type HomeySettings } from '../lib/homey'
import { downloadBlob, exportBackup, importBackup } from '../lib/backup'
import { db } from '../db/db'

export default function Settings() {
  return (
    <>
      <PageHeader back title="Instellingen" />
      <Page>
        <SyncSection />
        <HomeySection />
        <BackupSection />
        <AboutSection />
      </Page>
    </>
  )
}

function SyncSection() {
  const status = useSyncStatus()
  const cfg = supabaseConfig()
  const [url, setUrl] = useState(cfg.url)
  const [key, setKey] = useState(cfg.key)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const pending = useLiveQuery(() => pendingCount(), [], 0)
  const { toast, confirm } = useFeedback()
  const configured = !!(cfg.url && cfg.key)

  const saveCfg = async () => {
    if (!/^https:\/\/.+/.test(url.trim()) || key.trim().length < 20) return setError('Vul de Project URL (https://…supabase.co) en de anon public key uit Supabase in.')
    const changed = url.trim() !== cfg.url
    saveSupabaseConfig(url, key)
    if (changed && cfg.url) await markAllDirty()
    setError(undefined)
    toast('Supabase-gegevens opgeslagen. Herlaad de app om in te loggen.', { tone: 'success' })
    setTimeout(() => window.location.reload(), 800)
  }

  const sendLink = async () => {
    const sb = getSupabase()
    if (!sb) return
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Vul een geldig e-mailadres in.')
    setBusy(true)
    setError(undefined)
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (error) return setError(`Versturen mislukt: ${error.message}`)
    setSent(true)
  }

  const verify = async () => {
    const sb = getSupabase()
    if (!sb) return
    setBusy(true)
    setError(undefined)
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) return setError('De code klopt niet of is verlopen. Vraag een nieuwe aan.')
    toast('Ingelogd. Synchroniseren…', { tone: 'success' })
    void syncNow()
  }

  const logout = async () => {
    const ok = await confirm({ title: 'Uitloggen?', message: 'Je gegevens blijven op dit apparaat staan. Synchronisatie stopt tot je weer inlogt.', confirmLabel: 'Uitloggen' })
    if (!ok) return
    await getSupabase()?.auth.signOut()
  }

  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 text-lg">
        <Cloud className="size-5" aria-hidden /> Synchronisatie
      </h2>
      <p className="mb-4 text-sm text-muted">Alles werkt ook zonder account; je gegevens staan altijd op dit apparaat. Met Supabase synchroniseer je tussen iPhone en desktop en heb je een back-up in de cloud.</p>

      {status.state !== 'uit' && (
        <div className="mb-4 rounded-xl bg-surface-2 p-3 text-sm">
          <p className="font-semibold">
            {status.state === 'klaar' && 'Gesynchroniseerd'}
            {status.state === 'bezig' && 'Bezig met synchroniseren…'}
            {status.state === 'offline' && 'Offline – wijzigingen worden later verstuurd'}
            {status.state === 'fout' && 'Synchronisatie mislukt'}
            {status.state === 'niet-ingelogd' && 'Niet ingelogd'}
          </p>
          {status.email && <p>Ingelogd als {status.email}</p>}
          {status.lastSync && <p className="text-muted">Laatst: {new Date(status.lastSync).toLocaleString('nl-NL')}</p>}
          {!!pending && <p className="text-muted">{pending} wijziging(en) nog te versturen</p>}
          {status.error && <p className="mt-1 text-red">{status.error}</p>}
        </div>
      )}

      {!configured || !cfg.fromEnv ? (
        <details className="mb-4" open={!configured}>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">Supabase-project {configured ? '(ingesteld)' : 'instellen'}</summary>
          <div className="space-y-3 pt-2">
            <Field label="Project URL">{(id) => <input id={id} className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xyz.supabase.co" inputMode="url" autoCapitalize="off" autoCorrect="off" />}</Field>
            <Field label="Anon public key" hint="Te vinden in Supabase onder Project Settings → API. Zie de README voor de volledige setup.">
              {(id) => <input id={id} className={inputClass} value={key} onChange={(e) => setKey(e.target.value)} autoCapitalize="off" autoCorrect="off" />}
            </Field>
            <div className="flex gap-2">
              <Button onClick={saveCfg}>Opslaan</Button>
              {configured && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    clearSupabaseConfig()
                    window.location.reload()
                  }}
                >
                  Verwijderen
                </Button>
              )}
            </div>
          </div>
        </details>
      ) : null}

      {configured && status.state === 'niet-ingelogd' && (
        <div className="space-y-3">
          {!sent ? (
            <>
              <Field label="E-mailadres" hint="Je krijgt een e-mail met een inloglink en een code.">
                {(id) => <input id={id} type="email" autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Field>
              <Button onClick={sendLink} busy={busy} className="w-full">
                Stuur inloglink
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm">
                Check je mail. Gebruik je de app vanaf het beginscherm van je iPhone? Typ dan de <strong>code</strong> uit de e-mail hieronder in; de link opent namelijk in Safari in plaats van in de app.
              </p>
              <Field label="Code uit de e-mail">
                {(id) => <input id={id} inputMode="numeric" autoComplete="one-time-code" className={`${inputClass} text-center text-2xl tracking-[0.3em]`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} maxLength={10} />}
              </Field>
              <Button onClick={verify} busy={busy} className="w-full" disabled={code.length < 6}>
                Inloggen
              </Button>
              <button type="button" className="min-h-11 text-sm font-semibold text-red" onClick={() => setSent(false)}>
                Ander e-mailadres / opnieuw versturen
              </button>
            </>
          )}
        </div>
      )}

      {configured && status.email && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => void syncNow()} busy={status.state === 'bezig'}>
            <RefreshCw className="size-5" aria-hidden /> Nu syncen
          </Button>
          <Button variant="ghost" onClick={logout}>
            <LogOut className="size-5" aria-hidden /> Uitloggen
          </Button>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}
    </Card>
  )
}

function HomeySection() {
  const [s, setS] = useState<HomeySettings>(DEFAULT_HOMEY)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const queued = useLiveQuery(() => db.outbox.count(), [], 0)
  const { toast } = useFeedback()

  useEffect(() => {
    void getHomeySettings().then((v) => {
      setS(v)
      setLoaded(true)
    })
  }, [])

  const validate = () => {
    if (!s.url) return 'Vul de webhook-URL in.'
    try {
      buildRequest(s, { event: s.event, etappe: 1, naam: 'x', km: 1, totaalKm: 1, procent: 1, datum: '2026-01-01' })
    } catch {
      return 'De webhook-URL is ongeldig. Begin met https://'
    }
    return undefined
  }

  const save = async () => {
    const err = s.enabled ? validate() : undefined
    setError(err)
    if (err) return
    await saveHomeySettings(s)
    toast('Homey-instellingen opgeslagen', { tone: 'success' })
  }

  const test = async () => {
    const err = validate()
    setError(err)
    if (err) return
    setBusy(true)
    try {
      await sendTest(s)
      toast('Testmelding verstuurd. Controleer in Homey of je flow is gestart.', { tone: 'success', duration: 6000 })
    } catch {
      setError('Versturen mislukt. Controleer de URL en je internetverbinding.')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return null
  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 text-lg">
        <Webhook className="size-5" aria-hidden /> Homey-koppeling
      </h2>
      <p className="mb-4 text-sm text-muted">Stuur bij het afronden van een etappe een webhook, zodat je er in Homey (of elk ander systeem) een flow aan kunt hangen. Zonder internet wordt de melding bewaard en later verstuurd.</p>
      <label className="mb-4 flex min-h-12 items-center gap-3">
        <input type="checkbox" className="size-6 accent-[var(--c-red)]" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
        <span className="font-semibold">Webhook versturen bij etappe afronden</span>
      </label>
      <div className="space-y-3">
        <Field label="Webhook-URL" hint={<>Voor Homey: <code>https://webhook.homey.app/&lt;homey-id&gt;/{'{event}'}</code>. Placeholders: {'{event} {etappe} {km} {totaalKm} {procent} {naam} {datum}'}.</>}>
          {(id) => <input id={id} className={inputClass} value={s.url} onChange={(e) => setS({ ...s, url: e.target.value })} placeholder="https://webhook.homey.app/…/{event}" inputMode="url" autoCapitalize="off" autoCorrect="off" />}
        </Field>
        <Field label="Event-naam">{(id) => <input id={id} className={inputClass} value={s.event} onChange={(e) => setS({ ...s, event: e.target.value })} autoCapitalize="off" />}</Field>
        <Field label="Tag-sjabloon" hint="Homey geeft de parameter “tag” door als token in je flow. Alle waarden gaan daarnaast ook als losse parameters (en bij POST als JSON) mee.">
          {(id) => <input id={id} className={inputClass} value={s.tagTemplate} onChange={(e) => setS({ ...s, tagTemplate: e.target.value })} autoCapitalize="off" />}
        </Field>
        <Field label="Methode">
          {(id) => (
            <select id={id} className={inputClass} value={s.method} onChange={(e) => setS({ ...s, method: e.target.value as 'GET' | 'POST' })}>
              <option value="GET">GET (aanbevolen voor Homey)</option>
              <option value="POST">POST met JSON</option>
            </select>
          )}
        </Field>
        {!!queued && <p className="text-sm text-muted">{queued} melding(en) wachten op verbinding.</p>}
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={save}>Opslaan</Button>
          <Button variant="secondary" onClick={test} busy={busy}>
            <Send className="size-5" aria-hidden /> Test
          </Button>
        </div>
      </div>
    </Card>
  )
}

function BackupSection() {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [error, setError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  const { toast, confirm } = useFeedback()

  const doExport = async () => {
    setBusy('export')
    setError(undefined)
    try {
      const blob = await exportBackup()
      const name = `pieterpad-backup-${new Date().toISOString().slice(0, 10)}.zip`
      const file = new File([blob], name, { type: 'application/zip' })
      // Op iPhone werkt delen (bewaren in Bestanden) beter dan downloaden.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Pieterpad back-up' })
          return
        } catch (e) {
          if ((e as Error).name === 'AbortError') return
        }
      }
      downloadBlob(blob, name)
    } catch (e) {
      setError(`Back-up maken mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const doImport = async (file?: File) => {
    if (!file) return
    const ok = await confirm({
      title: 'Back-up importeren?',
      message: 'De back-up wordt samengevoegd met wat er al staat. Per item wint de nieuwste versie; er wordt niets gewist.',
      confirmLabel: 'Importeren',
    })
    if (!ok) return
    setBusy('import')
    setError(undefined)
    try {
      const r = await importBackup(file)
      toast(`Import klaar: ${r.added} nieuw, ${r.updated} bijgewerkt, ${r.skipped} ongewijzigd, ${r.photos} foto’s.`, { tone: 'success', duration: 7000 })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg">Back-up</h2>
      <p className="mb-4 text-sm text-muted">Exporteer al je gegevens als zip (data.json + foto’s). Bewaar hem bijvoorbeeld in iCloud Drive. Importeren voegt samen en wist nooit iets.</p>
      <input ref={input} type="file" accept=".zip,.json,application/zip,application/json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => doImport(e.target.files?.[0])} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={doExport} busy={busy === 'export'}>
          <Download className="size-5" aria-hidden /> Exporteren
        </Button>
        <Button variant="secondary" onClick={() => input.current?.click()} busy={busy === 'import'}>
          <Upload className="size-5" aria-hidden /> Importeren
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}
    </Card>
  )
}

function AboutSection() {
  const [usage, setUsage] = useState<string>()
  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => e.usage != null && setUsage(`${(e.usage / 1024 / 1024).toFixed(1).replace('.', ',')} MB`))
  }, [])
  return (
    <Card>
      <h2 className="mb-2 text-lg">Over</h2>
      <ul className="space-y-1 text-sm text-muted">
        <li>Etappes en afstanden: pieterpad.nl (Stichting Pieterpad). Deze app is een persoonlijk hulpmiddel en niet officieel.</li>
        <li>Kaart: © OpenStreetMap-bijdragers.</li>
        {usage && <li>Opslag op dit apparaat: {usage}</li>}
      </ul>
    </Card>
  )
}
