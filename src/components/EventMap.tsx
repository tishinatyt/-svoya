import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'

interface Props {
  lat: number
  lng: number
  title: string
}

// Leaflet CSS injected once
let cssInjected = false
function injectLeafletCSS() {
  if (cssInjected) return
  cssInjected = true
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  document.head.appendChild(link)
}

export default function EventMap({ lat, lng, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    injectLeafletCSS()

    // Dynamic import to avoid SSR issues
    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) return

      // Fix default icon paths broken by bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(containerRef.current!, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      L.marker([lat, lng])
        .addTo(map)
        .bindPopup(title, { closeButton: false })
        .openPopup()

      mapRef.current = map
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [lat, lng, title])

  return (
    <div
      ref={containerRef}
      className="w-full h-48 rounded-2xl overflow-hidden border border-gray-200"
      style={{ zIndex: 0 }}
    />
  )
}
