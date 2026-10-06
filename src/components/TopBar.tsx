import { useAuth } from '@/contexts/AuthContext'
import { Icon } from '@/components/icons'
import BrandLogo from '@/components/BrandLogo'
import { Link } from 'react-router-dom'

interface Props {
  title?: string
  searchQuery?: string
  onSearchChange?: (value: string) => void
  radiusKm?: number
  onRadiusChange?: (value: number) => void
  radiusOptions?: { value: number; label: string }[]
}

export default function TopBar({ title, searchQuery = '', onSearchChange, radiusKm = 5, onRadiusChange, radiusOptions = [] }: Props) {
  const { profile } = useAuth()

  return (
    <header className={`${title ? 'hidden lg:block' : ''} top-bar-surface sticky top-0 z-30 border-b backdrop-blur-xl lg:flex-none`}>
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 px-4 py-1 sm:px-6 lg:flex lg:h-12 lg:items-center lg:gap-4 lg:px-7 lg:py-0 xl:px-10">
        <div className="col-span-2 flex min-h-6 items-center justify-between lg:w-[190px] lg:flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink-soft">
            <Icon name="pin" className="h-4 w-4 text-brand-accent" />
            <span>{profile?.city ? `${profile.city}, Україна` : 'Україна'}</span>
            <span className="text-brand-ink-muted">⌄</span>
          </div>
          <BrandLogo className="w-24 lg:hidden" />
        </div>

        {title ? <div className="min-w-0 flex-1 text-sm font-bold text-brand-ink">{title}</div> : <div id="search" className="relative min-w-0">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink-muted" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Пошук за назвою, категорією або місцем..."
            className="h-9 w-full rounded-lg border border-[#eceaf1] bg-[#fafafd] pl-9 pr-3 text-xs text-brand-ink outline-none transition focus:border-brand-accent focus:bg-white focus:ring-2 focus:ring-brand-accent/10"
          />
        </div>}

        <div className="flex items-center gap-2">
          {!title && <select
            value={radiusKm}
            onChange={(event) => onRadiusChange?.(Number(event.target.value))}
            className="h-9 flex-1 rounded-lg border border-[#eceaf1] bg-[#fafafd] px-2.5 text-[11px] font-semibold text-brand-ink-soft outline-none transition hover:border-brand-border-strong focus:border-brand-accent sm:flex-none"
            aria-label="Радіус пошуку"
          >
            {radiusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>}
          {!title && <Link to="/create" className="hidden h-9 items-center gap-1.5 rounded-lg bg-brand-accent px-3 text-[11px] font-extrabold text-white shadow-[0_3px_10px_rgba(104,70,255,0.18)] transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent lg:inline-flex" aria-label="Додати подію"><Icon name="plus" className="h-4 w-4" /><span>Додати</span></Link>}
          <button type="button" disabled title="Сповіщення з’являться незабаром" className="hidden h-9 w-9 cursor-not-allowed place-items-center rounded-xl text-brand-ink-muted opacity-55 sm:grid lg:h-11 lg:w-11" aria-label="Сповіщення — незабаром">
            <Icon name="bell" className="h-4.5 w-4.5" />
          </button>
          <div className="hidden h-9 w-9 overflow-hidden rounded-full bg-brand-accent-soft sm:block">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xs font-bold text-brand-accent">{profile?.name?.charAt(0) ?? 'L'}</div>}
          </div>
        </div>
      </div>
    </header>
  )
}
