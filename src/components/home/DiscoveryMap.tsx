import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LayerGroup, Map as LeafletMap } from 'leaflet'
import type { Coords } from '@/lib/geo'
import type { PublicEventData } from '@/components/home/types'
import { eventCategoryLabel } from '@/components/home/eventLabels'

interface DiscoveryMapProps {
  events: PublicEventData[]
  center: Coords
}

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function hasValidCoordinates(event: PublicEventData) {
  return typeof event.location_lat === 'number'
    && Number.isFinite(event.location_lat)
    && event.location_lat >= -90
    && event.location_lat <= 90
    && typeof event.location_lng === 'number'
    && Number.isFinite(event.location_lng)
    && event.location_lng >= -180
    && event.location_lng <= 180
}

function injectLeafletCss() {
  if (document.querySelector('link[href*="leaflet.css"]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  document.head.appendChild(link)
}

function appendText(parent: HTMLElement, className: string, text: string) {
  const element = document.createElement('p')
  element.className = className
  element.textContent = text
  parent.appendChild(element)
}

export default function DiscoveryMap({ events, center }: DiscoveryMapProps) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<LayerGroup | null>(null)
  const lastBoundsKeyRef = useRef<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    setMapReady(false)
    injectLeafletCss()

    void import('leaflet').then((leaflet) => {
      if (cancelled || !containerRef.current || mapRef.current) return

      // Keep the same bundler-safe default marker configuration as EventMap.
      delete (leaflet.Icon.Default.prototype as typeof leaflet.Icon.Default.prototype & { _getIconUrl?: unknown })._getIconUrl
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = leaflet.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: 12,
        zoomControl: true,
        scrollWheelZoom: false,
      })

      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      mapRef.current = map
      markersRef.current = leaflet.layerGroup().addTo(map)
      setMapReady(true)
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current = null
      lastBoundsKeyRef.current = null
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const map = mapRef.current
    if (!container || !map || !mapReady) return

    let frame = 0
    const invalidate = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => map.invalidateSize({ pan: false }))
    }
    const observer = new ResizeObserver(invalidate)
    observer.observe(container)
    window.addEventListener('orientationchange', invalidate)
    invalidate()

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('orientationchange', invalidate)
    }
  }, [mapReady])

  useEffect(() => {
    let cancelled = false

    void import('leaflet').then((leaflet) => {
      const map = mapRef.current
      const markerLayer = markersRef.current
      if (cancelled || !map || !markerLayer) return

      markerLayer.clearLayers()
      const visibleEvents = events.filter(hasValidCoordinates)
      const bounds: [number, number][] = []

      for (const event of visibleEvents) {
        const position: [number, number] = [event.location_lat!, event.location_lng!]
        bounds.push(position)

        const popup = document.createElement('div')
        popup.className = 'min-w-48 text-brand-ink'
        appendText(popup, 'text-sm font-extrabold leading-5', event.title)
        appendText(popup, 'mt-1 text-[11px] font-bold text-brand-accent', eventCategoryLabel(event.category))
        appendText(popup, 'mt-2 text-xs text-brand-ink-soft', dateFormatter.format(new Date(event.event_datetime)))
        const distance = event.distance_km == null ? '' : ` · ${event.distance_km.toFixed(1)} км`
        appendText(popup, 'mt-1 text-xs text-brand-ink-muted', `${event.participant_count}/${event.max_participants} учасників${distance}`)

        const detailsButton = document.createElement('button')
        detailsButton.type = 'button'
        detailsButton.className = 'mt-3 min-h-10 rounded-lg bg-brand-accent px-3 text-[11px] font-extrabold text-white'
        detailsButton.textContent = 'Детальніше'
        detailsButton.addEventListener('click', () => navigate(`/event/${event.id}`))
        popup.appendChild(detailsButton)

        leaflet.marker(position).addTo(markerLayer).bindPopup(popup, { closeButton: false, maxWidth: 260 })
      }

      const markerKey = visibleEvents
        .map((event) => `${event.id}:${event.location_lat}:${event.location_lng}`)
        .sort()
        .join('|')
      const boundsKey = `${center.lat}:${center.lng}|${markerKey}`
      if (lastBoundsKeyRef.current !== boundsKey) {
        if (bounds.length === 1) map.setView(bounds[0], 14)
        else if (bounds.length > 1) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 })
        else map.setView([center.lat, center.lng], 12)
        lastBoundsKeyRef.current = boundsKey
      }
    })

    return () => { cancelled = true }
  }, [center.lat, center.lng, events, mapReady, navigate])

  const markerCount = events.filter(hasValidCoordinates).length

  return (
    <div className="relative min-h-[430px] flex-1 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-muted lg:min-h-0">
      <div ref={containerRef} role="region" className="absolute inset-0 z-0" aria-label="Карта подій поруч" />
      {markerCount === 0 && <div className="pointer-events-none absolute inset-x-4 top-4 z-[400] mx-auto max-w-sm rounded-xl border border-brand-border bg-white/95 px-4 py-3 text-center text-xs font-bold text-brand-ink-soft shadow-card">Для вибраних подій немає координат на карті</div>}
    </div>
  )
}
