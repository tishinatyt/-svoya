import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, Marker } from 'leaflet'

interface Props {
  lat: number | null
  lng: number | null
  center?: { lat: number; lng: number }
  onPick: (lat: number, lng: number) => void
}

let leafletCssInjected = false

function injectLeafletCss() {
  if (leafletCssInjected) return
  leafletCssInjected = true
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  document.head.appendChild(link)
}

export default function CreateEventMap({ lat, lng, center, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const onPickRef = useRef(onPick)

  useEffect(() => { onPickRef.current = onPick }, [onPick])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    injectLeafletCss()

    import('leaflet').then((leaflet) => {
      if (cancelled || !containerRef.current || mapRef.current) return
      delete (leaflet.Icon.Default.prototype as typeof leaflet.Icon.Default.prototype & { _getIconUrl?: unknown })._getIconUrl
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = leaflet.map(containerRef.current, {
        center: [lat ?? center?.lat ?? 51.4982, lng ?? center?.lng ?? 31.2893], zoom: 14,
        zoomControl: true, scrollWheelZoom: false, attributionControl: false,
      })
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
      if (lat !== null && lng !== null) markerRef.current = leaflet.marker([lat, lng]).addTo(map)
      map.on('click', ({ latlng }: { latlng: { lat: number; lng: number } }) => {
        if (markerRef.current) markerRef.current.setLatLng(latlng)
        else markerRef.current = leaflet.marker(latlng).addTo(map)
        onPickRef.current(latlng.lat, latlng.lng)
      })
      mapRef.current = map
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    if (lat === null || lng === null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    import('leaflet').then((leaflet) => {
      if (!mapRef.current) return
      if (markerRef.current) markerRef.current.setLatLng([lat, lng])
      else markerRef.current = leaflet.marker([lat, lng]).addTo(mapRef.current)
      mapRef.current.panTo([lat, lng])
    })
  }, [lat, lng])

  return <div ref={containerRef} className="h-52 w-full cursor-crosshair overflow-hidden rounded-2xl border border-brand-border sm:h-60" style={{ zIndex: 0 }} />
}
