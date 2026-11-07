import { Cloud, CloudOff, Loader2, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSyncStatus } from '../lib/sync'

const labels = {
  uit: 'Alleen op dit apparaat',
  offline: 'Offline – wordt later gesynchroniseerd',
  bezig: 'Synchroniseren…',
  klaar: 'Gesynchroniseerd',
  fout: 'Synchronisatie mislukt',
  'niet-ingelogd': 'Niet ingelogd voor synchronisatie',
} as const

export function SyncBadge() {
  const { state } = useSyncStatus()
  const Icon = state === 'bezig' ? Loader2 : state === 'fout' ? AlertTriangle : state === 'klaar' ? Cloud : CloudOff
  return (
    <Link to="/instellingen" className="flex size-12 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`${labels[state]}. Open instellingen`} title={labels[state]}>
      <Icon className={`size-6 ${state === 'bezig' ? 'animate-spin' : ''} ${state === 'fout' ? 'text-red' : 'text-muted'}`} aria-hidden />
    </Link>
  )
}
