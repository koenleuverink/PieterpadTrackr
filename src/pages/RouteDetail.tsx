import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, Pencil, Trash2 } from 'lucide-react'
import { Button, Card, ErrorBox, LinkButton, Loading, Page, PageHeader } from '../components/ui'
import { MapView } from '../components/MapView'
import { useRoute, useStages } from '../db/hooks'
import { dateLong, duration, km } from '../lib/format'
import { useFeedback } from '../components/Feedback'
import { Markdown } from '../components/Markdown'
import { downloadBlob } from '../lib/backup'
import { toGpx } from '../lib/gpxExport'

const sourceLabel = { gpx: 'GPX-bestand', tcx: 'TCX-bestand', fit: 'FIT-bestand', handmatig: 'Handmatig ingevoerd' }

export default function RouteDetail() {
  const { id } = useParams()
  const route = useRoute(id)
  const stages = useStages()
  const navigate = useNavigate()
  const { deleteWithUndo } = useFeedback()
  const lines = useMemo(() => (route ? [{ id: route.id, points: route.points, kind: 'highlight' as const }] : []), [route])

  if (route === undefined || !stages) return <Loading />
  if (!route || route.deleted) return <ErrorBox>Deze route bestaat niet (meer).</ErrorBox>
  const stage = stages.find((s) => s.id === route.stageId)

  return (
    <>
      <PageHeader back title={route.name} subtitle={stage ? `Etappe ${stage.number}: ${stage.name}` : 'Losse route'} />
      <Page>
        {route.points.length > 1 ? (
          <MapView lines={lines} fit={route.id} className="h-72" label={`Kaart van ${route.name}`} />
        ) : (
          <p className="rounded-2xl bg-surface-2 p-4 text-muted">Deze route heeft geen GPS-track.</p>
        )}
        <Card>
          <dl className="grid grid-cols-2 gap-3">
            <Row label="Afstand" value={km(route.distanceKm)} />
            <Row label="Datum" value={route.date ? dateLong(route.date) : '–'} />
            <Row label="Totale duur" value={duration(route.durationMin)} />
            <Row label="In beweging" value={duration(route.movingMin)} />
            <Row label="Stijgen" value={route.ascentM != null ? `${route.ascentM} m` : '–'} />
            <Row label="Dalen" value={route.descentM != null ? `${route.descentM} m` : '–'} />
            <Row label="Bron" value={`${sourceLabel[route.source]}${route.fileName ? ` (${route.fileName})` : ''}`} />
            {route.durationMin && route.distanceKm ? <Row label="Gem. snelheid" value={`${(route.distanceKm / (route.durationMin / 60)).toFixed(1).replace('.', ',')} km/u`} /> : null}
          </dl>
          {route.notes && (
            <div className="mt-4 border-t border-line pt-3">
              <Markdown text={route.notes} />
            </div>
          )}
        </Card>
        <div className="grid grid-cols-2 gap-2">
          <LinkButton variant="secondary" to={`/routes/${route.id}/bewerken`}>
            <Pencil className="size-5" aria-hidden /> Bewerken
          </LinkButton>
          {route.points.length > 1 && (
            <Button variant="secondary" onClick={() => downloadBlob(new Blob([toGpx(route)], { type: 'application/gpx+xml' }), `${route.name.replace(/[^\w-]+/g, '_')}.gpx`)}>
              <Download className="size-5" aria-hidden /> GPX
            </Button>
          )}
        </div>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => deleteWithUndo('route', route.id, 'route', { onDeleted: () => navigate(stage ? `/etappes/${stage.id}` : '/etappes', { replace: true }) })}
        >
          <Trash2 className="size-5" aria-hidden /> Route verwijderen
        </Button>
      </Page>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-bold break-words">{value}</dd>
    </div>
  )
}
