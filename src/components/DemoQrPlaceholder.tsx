const PATTERN = [
  1, 1, 1, 0, 1, 1, 1,
  1, 0, 1, 1, 1, 0, 1,
  1, 1, 1, 0, 1, 1, 1,
  0, 1, 0, 1, 0, 1, 0,
  1, 1, 1, 0, 1, 0, 1,
  1, 0, 1, 1, 0, 1, 1,
  1, 1, 1, 0, 1, 1, 0,
] as const

export default function DemoQrPlaceholder({ className = 'h-20 w-20' }: { className?: string }) {
  return (
    <div className={`grid grid-cols-7 gap-px rounded-lg border border-brand-border bg-white p-2 ${className}`} aria-hidden="true">
      {PATTERN.map((filled, index) => <span key={index} className={filled ? 'bg-brand-ink' : 'bg-transparent'} />)}
    </div>
  )
}
