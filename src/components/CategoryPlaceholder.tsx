import { Icon, type IconName } from '@/components/icons'

interface Props {
  category: string
  /** Tailwind height + width classes, e.g. "h-32 w-full" or "h-52 w-full" */
  className?: string
  compact?: boolean
}

interface CategoryVisual {
  icon: IconName
  label: string
  gradient: string
  glow: string
  pattern: string
}

const META: Record<string, CategoryVisual> = {
  cinema: { icon: 'film', label: 'Кіно', gradient: 'linear-gradient(135deg,#24134f 0%,#5132a9 56%,#8b6cff 100%)', glow: '#c4b5fd', pattern: 'rgba(255,255,255,.1)' },
  theatre: { icon: 'theatre', label: 'Театр', gradient: 'linear-gradient(135deg,#4b163b 0%,#842f68 52%,#7c4dca 100%)', glow: '#f9a8d4', pattern: 'rgba(255,255,255,.09)' },
  bar: { icon: 'martini', label: 'Бар', gradient: 'linear-gradient(135deg,#6a294b 0%,#b45357 52%,#7c3aed 100%)', glow: '#fdba74', pattern: 'rgba(255,255,255,.11)' },
  sport: { icon: 'dumbbell', label: 'Спорт', gradient: 'linear-gradient(135deg,#243b8f 0%,#4f46e5 50%,#7c3aed 100%)', glow: '#93c5fd', pattern: 'rgba(255,255,255,.12)' },
  music: { icon: 'music', label: 'Музика', gradient: 'linear-gradient(135deg,#5b21b6 0%,#9333a8 52%,#db4f91 100%)', glow: '#f0abfc', pattern: 'rgba(255,255,255,.1)' },
  food: { icon: 'utensils', label: 'Їжа', gradient: 'linear-gradient(135deg,#9a4a23 0%,#dd6b3d 48%,#7c3aed 100%)', glow: '#fed7aa', pattern: 'rgba(255,255,255,.12)' },
  games: { icon: 'gamepad', label: 'Ігри', gradient: 'linear-gradient(135deg,#164e91 0%,#2563eb 48%,#7138d0 100%)', glow: '#7dd3fc', pattern: 'rgba(255,255,255,.12)' },
  walk: { icon: 'footprints', label: 'Прогулянка', gradient: 'linear-gradient(135deg,#176b5a 0%,#2f8f78 48%,#6d48c7 100%)', glow: '#a7f3d0', pattern: 'rgba(255,255,255,.11)' },
  art: { icon: 'palette', label: 'Мистецтво', gradient: 'linear-gradient(135deg,#93336f 0%,#db5b9a 50%,#7351c8 100%)', glow: '#fbcfe8', pattern: 'rgba(255,255,255,.12)' },
  communication: { icon: 'users', label: 'Спілкування', gradient: 'linear-gradient(135deg,#2856a7 0%,#5369d8 48%,#7650ca 100%)', glow: '#bfdbfe', pattern: 'rgba(255,255,255,.12)' },
  other: { icon: 'sparkles', label: 'Інше', gradient: 'linear-gradient(135deg,#49358d 0%,#6846ff 52%,#9b7cff 100%)', glow: '#ddd6fe', pattern: 'rgba(255,255,255,.11)' },
}

export default function CategoryPlaceholder({ category, className = 'h-32 w-full', compact = false }: Props) {
  const meta = META[category] ?? META.other
  return (
    <div aria-hidden="true" className={`${className} relative flex items-center justify-center overflow-hidden text-white`} style={{ background: meta.gradient }}>
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, ${meta.pattern} 1px, transparent 0)`, backgroundSize: compact ? '10px 10px' : '18px 18px' }} />
      <div className="absolute -right-[12%] -top-[42%] aspect-square w-[58%] rounded-full border border-white/15 bg-white/10" />
      <div className="absolute -bottom-[52%] -left-[14%] aspect-square w-[68%] rounded-full border border-white/10 bg-black/10" />
      <Icon name={meta.icon} className={`${compact ? 'h-8 w-8' : 'h-20 w-20'} absolute -bottom-2 -right-1 rotate-[-9deg] text-white opacity-[0.07]`} />
      <div className={`relative flex flex-col items-center text-center ${compact ? '' : 'gap-2'}`}>
        <div className={`${compact ? 'h-8 w-8 rounded-lg' : 'h-12 w-12 rounded-xl'} grid place-items-center border border-white/30 bg-white/16 shadow-[0_8px_28px_rgba(20,10,50,0.18)] backdrop-blur-sm`} style={{ boxShadow: `0 8px 26px ${meta.glow}30` }}>
          <Icon name={meta.icon} className={compact ? 'h-4 w-4' : 'h-6 w-6'} />
        </div>
        {!compact && <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/85">{meta.label}</span>}
      </div>
    </div>
  )
}
