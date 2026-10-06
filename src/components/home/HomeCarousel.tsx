import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '@/components/icons'

interface HomeCarouselProps {
  id: string
  label: string
  children: ReactNode
  className?: string
  showScrollControls?: boolean
}

export default function HomeCarousel({ id, label, children, className = '', showScrollControls = false }: HomeCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current
    if (!element) return
    setCanScrollUp(element.scrollTop > 1)
    setCanScrollDown(element.scrollTop + element.clientHeight < element.scrollHeight - 1)
  }, [])

  useEffect(() => {
    const element = scrollRef.current
    if (!element || !showScrollControls) return
    updateScrollState()
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(element)
    for (const child of Array.from(element.children)) observer.observe(child)
    element.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)
    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [children, showScrollControls, updateScrollState])

  const scrollOneCard = (direction: -1 | 1) => {
    const element = scrollRef.current
    const firstCard = element?.querySelector<HTMLElement>('[role="listitem"]')
    if (!element) return
    const gap = Number.parseFloat(getComputedStyle(element).rowGap) || 0
    const distance = firstCard ? firstCard.getBoundingClientRect().height + gap : element.clientHeight * 0.8
    element.scrollBy({ top: direction * distance, behavior: 'smooth' })
  }

  return (
    <div className="relative min-w-0 max-w-full lg:min-h-0 lg:flex-1">
      <div
        ref={scrollRef}
        id={id}
        role="list"
        aria-label={label}
        data-home-carousel={id}
        className={`scrollbar-hide desktop-feed-scrollbar isolate flex min-w-0 max-w-full snap-x snap-mandatory items-stretch gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2 pr-4 [scroll-padding-inline:1px] [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch] lg:block lg:h-full lg:min-h-0 lg:snap-none lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-x-auto lg:overscroll-y-contain lg:pb-0 lg:pr-2 ${className}`}
      >
        {children}
      </div>
      {showScrollControls && <div className="pointer-events-none absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 gap-1.5 lg:grid">
        <button type="button" onClick={() => scrollOneCard(-1)} disabled={!canScrollUp} aria-label={`Прокрутити ${label} вгору`} className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full border border-white/70 bg-white/75 text-brand-ink-soft opacity-70 shadow-sm transition hover:bg-white hover:opacity-100 disabled:pointer-events-none disabled:opacity-25"><Icon name="chevron" className="h-4 w-4 -rotate-90" /></button>
        <button type="button" onClick={() => scrollOneCard(1)} disabled={!canScrollDown} aria-label={`Прокрутити ${label} вниз`} className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full border border-white/70 bg-white/75 text-brand-ink-soft opacity-70 shadow-sm transition hover:bg-white hover:opacity-100 disabled:pointer-events-none disabled:opacity-25"><Icon name="chevron" className="h-4 w-4 rotate-90" /></button>
      </div>}
    </div>
  )
}
