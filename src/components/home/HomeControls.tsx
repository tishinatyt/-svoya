export function CategoryChips({ items, selected, onSelect }: { items: { key: string; label: string }[]; selected: string; onSelect: (key: string) => void }) {
  return (
    <div className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Категорії подій">
      {items.map((item) => <button key={item.key} type="button" aria-pressed={selected === item.key} onClick={() => onSelect(item.key)} className={`min-h-10 flex-shrink-0 rounded-xl border px-3 text-[11px] font-bold transition ${selected === item.key ? 'border-brand-accent bg-brand-accent text-white' : 'border-brand-border bg-white text-brand-ink-soft hover:border-brand-accent/30 hover:bg-brand-accent-soft'}`}>{item.label}</button>)}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-brand-border-strong bg-white px-6 py-10 text-center"><div className="mx-auto mb-4 h-10 w-10 rounded-full bg-brand-accent-soft"/><h3 className="text-sm font-bold text-brand-ink">{title}</h3><p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-brand-ink-muted">{description}</p>{action && <div className="mt-5">{action}</div>}</div>
}
