import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Sheet } from './ui'
import { restoreRecord, softDelete } from '../db/repo'
import type { RecordKind } from '../db/types'

interface Toast {
  id: number
  message: string
  tone?: 'info' | 'error' | 'success'
  action?: { label: string; onClick: () => void }
  duration: number
}

interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  danger?: boolean
}

interface FeedbackApi {
  toast: (message: string, opts?: Partial<Omit<Toast, 'id' | 'message'>>) => void
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  /** Vraagt bevestiging, verwijdert (zacht) en toont een melding met "Ongedaan maken". */
  deleteWithUndo: (kind: RecordKind, id: string, what: string, opts?: { onDeleted?: () => void; extra?: { kind: RecordKind; id: string }[] }) => Promise<boolean>
}

const Ctx = createContext<FeedbackApi | null>(null)

export function useFeedback() {
  const c = useContext(Ctx)
  if (!c) throw new Error('FeedbackProvider ontbreekt')
  return c
}

const UNDO_MS = 7000

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback<FeedbackApi['toast']>((message, opts) => {
    const id = nextId.current++
    setToasts((t) => [...t.slice(-2), { id, message, duration: opts?.duration ?? (opts?.tone === 'error' ? 8000 : 4000), ...opts }])
  }, [])

  const confirm = useCallback<FeedbackApi['confirm']>(
    (opts) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })),
    [],
  )

  const closeConfirm = (v: boolean) => {
    confirmState?.resolve(v)
    setConfirmState(null)
  }

  const deleteWithUndo = useCallback<FeedbackApi['deleteWithUndo']>(
    async (kind, id, what, opts) => {
      const ok = await confirm({
        title: `${capitalize(what)} verwijderen?`,
        message: `Je kunt dit direct daarna nog ongedaan maken.`,
        confirmLabel: 'Verwijderen',
        danger: true,
      })
      if (!ok) return false
      const all = [{ kind, id }, ...(opts?.extra ?? [])]
      for (const r of all) await softDelete(r.kind, r.id)
      opts?.onDeleted?.()
      toast(`${capitalize(what)} verwijderd`, {
        duration: UNDO_MS,
        action: {
          label: 'Ongedaan maken',
          onClick: async () => {
            for (const r of all) await restoreRecord(r.kind, r.id)
            toast(`${capitalize(what)} teruggezet`, { tone: 'success' })
          },
        },
      })
      return true
    },
    [confirm, toast],
  )

  return (
    <Ctx.Provider value={{ toast, confirm, deleteWithUndo }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[3000] flex flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
      <Sheet open={!!confirmState} onClose={() => closeConfirm(false)} title={confirmState?.title ?? ''}>
        {confirmState?.message && <div className="mb-5 text-muted">{confirmState.message}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => closeConfirm(false)}>
            Annuleren
          </Button>
          <Button variant={confirmState?.danger ? 'primary' : 'primary'} onClick={() => closeConfirm(true)} autoFocus>
            {confirmState?.confirmLabel ?? 'OK'}
          </Button>
        </div>
      </Sheet>
    </Ctx.Provider>
  )
}

function ToastView({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const t = setTimeout(onDone, toast.duration)
    return () => clearTimeout(t)
  }, [paused, toast.duration, onDone])
  const tone = toast.tone === 'error' ? 'bg-red text-on-red' : 'bg-ink text-bg'
  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-xl ${tone}`}
    >
      <span className="flex-1 font-semibold">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="min-h-11 rounded-lg px-3 font-bold underline underline-offset-4"
          onClick={() => {
            toast.action!.onClick()
            onDone()
          }}
        >
          {toast.action.label}
        </button>
      )}
      {toast.action && (
        <span className="relative h-1 w-10 overflow-hidden rounded-full bg-white/25" aria-hidden>
          <span
            className="absolute inset-y-0 left-0 bg-white/80"
            style={{ animation: `shrink ${toast.duration}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }}
          />
        </span>
      )}
      <style>{`@keyframes shrink { from { width: 100% } to { width: 0 } }`}</style>
    </div>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
