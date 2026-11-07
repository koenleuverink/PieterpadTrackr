import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './db'
import { live } from './repo'
import { computeStats } from '../lib/stats'

export const useStages = () => useLiveQuery(live.stages, [])
export const useRoutes = () => useLiveQuery(live.routes, [])
export const useDiary = () => useLiveQuery(live.diary, [])
export const usePhotos = () => useLiveQuery(live.photos, [])
export const usePlaces = () => useLiveQuery(live.places, [])

export function useStats() {
  const stages = useStages()
  const routes = useRoutes()
  return useMemo(() => (stages && routes ? computeStats(stages, routes) : undefined), [stages, routes])
}

export const useStage = (id?: string) => useLiveQuery(() => (id ? db.stages.get(id) : undefined), [id])
export const useRoute = (id?: string) => useLiveQuery(() => (id ? db.routes.get(id) : undefined), [id])
export const useDiaryEntry = (id?: string) => useLiveQuery(() => (id ? db.diary.get(id) : undefined), [id])
export const usePlace = (id?: string) => useLiveQuery(() => (id ? db.places.get(id) : undefined), [id])
