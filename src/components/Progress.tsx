import { percent } from '../lib/format'

/** Voortgangsbalk in de stijl van de rood-witte markering. */
export function ProgressBar({ value, label, thin }: { value: number; label: string; thin?: boolean }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-valuetext={percent(v)}
      className={`relative w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-line ${thin ? 'h-2.5' : 'h-5'}`}
    >
      <div className="h-full rounded-full bg-red-brand transition-[width] duration-500" style={{ width: `${v}%` }}>
        {!thin && <div className="h-1/2 w-full bg-white" />}
      </div>
    </div>
  )
}
