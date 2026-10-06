export const PROFILE_INTERESTS = [
  'Спілкування', 'Кава', 'Кіно', 'Театр', 'Музика', 'Спорт',
  'Подорожі', 'Ігри', 'Технології', 'Їжа', 'Прогулянки', 'Нові знайомства',
] as const

interface InterestChipsProps {
  selected: string[]
  editable?: boolean
  max?: number
  options?: readonly string[]
  onChange?: (interests: string[]) => void
}

export function InterestChips({ selected, editable = false, max = 8, options: providedOptions, onChange }: InterestChipsProps) {
  const options = editable ? providedOptions ?? PROFILE_INTERESTS : selected
  function toggle(interest: string) {
    if (!editable || !onChange) return
    if (selected.includes(interest)) onChange(selected.filter((item) => item !== interest))
    else if (selected.length < max) onChange([...selected, interest])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((interest) => {
        const active = selected.includes(interest)
        return editable ? (
          <button key={interest} type="button" onClick={() => toggle(interest)} aria-pressed={active} disabled={!active && selected.length >= max} className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent disabled:cursor-not-allowed disabled:opacity-45 ${active ? 'border-brand-accent bg-brand-accent text-white' : 'border-brand-border bg-white text-brand-ink-soft hover:border-brand-accent hover:text-brand-accent'}`}>{interest}</button>
        ) : <span key={interest} className="rounded-xl border border-brand-border bg-white px-3 py-2 text-xs font-semibold text-brand-ink-soft">{interest}</span>
      })}
    </div>
  )
}

export function OnboardingProgress({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <div aria-label={`${step} з ${total}`}>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-brand-ink-muted"><span>{step} з {total}</span><span>Poruch</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-brand-surface-muted"><div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: `${(step / total) * 100}%` }} /></div>
    </div>
  )
}
