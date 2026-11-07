import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Field, Loading, Page, PageHeader } from '../components/ui'
import { StageSelect } from '../components/StageSelect'
import { AddPhotoButtons, PhotoGrid } from '../components/Photos'
import { usePhotos, useStages } from '../db/hooks'

export default function PhotoAdd() {
  const [params] = useSearchParams()
  const stages = useStages()
  const photos = usePhotos()
  const [stageId, setStageId] = useState<string | undefined>(params.get('etappe') ?? undefined)
  const [added, setAdded] = useState<string[]>([])
  const recent = useMemo(() => photos?.filter((p) => added.includes(p.id)) ?? [], [photos, added])

  if (!stages) return <Loading />
  return (
    <>
      <PageHeader back title="Foto’s toevoegen" />
      <Page>
        <Field label="Bij etappe" hint="Datum en locatie worden uit de foto gelezen als die beschikbaar zijn.">
          {(id) => <StageSelect id={id} stages={stages} value={stageId} onChange={setStageId} noneLabel="Geen etappe" />}
        </Field>
        <AddPhotoButtons stageId={stageId} onAdded={(ids) => setAdded((a) => [...a, ...ids])} />
        {recent.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg">Zojuist toegevoegd</h2>
            <p className="mb-2 text-sm text-muted">Tik op een foto om een bijschrift toe te voegen.</p>
            <PhotoGrid photos={recent} />
          </section>
        )}
      </Page>
    </>
  )
}
