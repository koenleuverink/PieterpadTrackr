import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './ui'

/** Meldt wanneer er een nieuwe versie van de app klaarstaat. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[4000] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink p-3 text-bg shadow-xl">
      <span className="flex-1 font-semibold">Er is een nieuwe versie beschikbaar.</span>
      <Button variant="secondary" className="min-h-11" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
      <Button className="min-h-11" onClick={() => updateServiceWorker(true)}>
        Bijwerken
      </Button>
    </div>
  )
}
