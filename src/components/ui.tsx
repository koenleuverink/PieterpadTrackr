import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Loader2, X } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-red text-on-red hover:brightness-95 active:brightness-90',
  secondary: 'bg-surface text-ink border-2 border-line hover:border-muted',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'bg-surface text-red border-2 border-red/50 hover:bg-red-soft',
}

export function Button({
  variant = 'primary',
  className = '',
  busy,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function LinkButton({ to, variant = 'primary', className = '', children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  )
}

export function Card({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' | 'li' }) {
  return <As className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>{children}</As>
}

export function PageHeader({ title, back, actions, subtitle }: { title: string; back?: boolean | string; actions?: ReactNode; subtitle?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="safe-top sticky top-0 z-[500] border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-3xl items-center gap-2 px-3">
        {back && (
          <button
            type="button"
            onClick={() => (typeof back === 'string' ? navigate(back) : window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="-ml-1 flex size-12 items-center justify-center rounded-full hover:bg-surface-2"
            aria-label="Terug"
          >
            <ChevronLeft className="size-7" aria-hidden />
          </button>
        )}
        <div className="min-w-0 flex-1 py-2">
          <h1 className="truncate text-xl">{title}</h1>
          {subtitle && <div className="truncate text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    </header>
  )
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto max-w-3xl space-y-4 px-4 pt-4 pb-32 ${className}`}>{children}</main>
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <h2 className="text-lg">{title}</h2>
      {children && <div className="mt-2 max-w-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Loading({ label = 'Laden…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-muted">
      <Loader2 className="size-6 animate-spin" aria-hidden /> {label}
    </div>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border-2 border-red/40 bg-red-soft px-4 py-3 text-ink">
      {children}
    </div>
  )
}

export function Field({ label, hint, children, id }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode; id?: string }) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className="space-y-1">
      <label htmlFor={fid} className="block font-semibold">
        {label}
      </label>
      {children(fid)}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'block w-full min-h-12 rounded-xl border-2 border-line bg-surface px-3 py-2 text-ink placeholder:text-muted/70 focus:border-red focus:outline-none'

/** Bottom sheet / dialoog. Sluit met Escape of tik op de achtergrond. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="safe-bottom animate-slide-up relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl outline-none sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-xl">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Sluiten">
            <X className="size-6" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Stars({ value, onChange, label = 'Beoordeling' }: { value?: number; onChange?: (v: number | undefined) => void; label?: string }) {
  const v = value ?? 0
  if (!onChange) {
    return (
      <span aria-label={`${v} van 5 sterren`} className="tracking-tight text-red-brand">
        {'★'.repeat(v)}
        <span className="text-line">{'★'.repeat(5 - v)}</span>
      </span>
    )
  }
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={v === n}
          aria-label={`${n} ${n === 1 ? 'ster' : 'sterren'}`}
          onClick={() => onChange(v === n ? undefined : n)}
          className={`flex size-12 items-center justify-center rounded-xl text-3xl ${n <= v ? 'text-red-brand' : 'text-line'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full border-2 px-4 font-semibold transition ${active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink'}`}
    >
      {children}
    </button>
  )
}

export function StatusBadge({ walked, partial }: { walked: boolean; partial?: boolean }) {
  if (walked) return <span className="rounded-full bg-red px-2.5 py-0.5 text-sm font-bold text-on-red">Gelopen</span>
  if (partial) return <span className="rounded-full border-2 border-red px-2 py-0.5 text-sm font-bold text-red">Deels</span>
  return <span className="rounded-full border-2 border-line px-2 py-0.5 text-sm font-semibold text-muted">Gepland</span>
}
