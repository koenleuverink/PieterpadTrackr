import type { Stage } from '../db/types'
import { inputClass } from './ui'

export function StageSelect({
  id,
  stages,
  value,
  onChange,
  allowNone = true,
  noneLabel = 'Geen etappe (los)',
}: {
  id?: string
  stages: Stage[]
  value?: string
  onChange: (v: string | undefined) => void
  allowNone?: boolean
  noneLabel?: string
}) {
  return (
    <select id={id} className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      {allowNone && <option value="">{noneLabel}</option>}
      {stages.map((s) => (
        <option key={s.id} value={s.id}>
          {s.number}. {s.name}
          {s.status === 'gelopen' ? ' ✓' : ''}
        </option>
      ))}
    </select>
  )
}
