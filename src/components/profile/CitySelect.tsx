import { UKRAINIAN_OBLAST_CENTERS } from '@/lib/cities'

interface CitySelectProps {
  value: string
  onChange: (value: string) => void
  className?: string
  required?: boolean
}

export function CitySelect({ value, onChange, className, required = false }: CitySelectProps) {
  const isLegacyCity = Boolean(value) && !UKRAINIAN_OBLAST_CENTERS.includes(value as (typeof UKRAINIAN_OBLAST_CENTERS)[number])

  return (
    <select value={value} required={required} onChange={(event) => onChange(event.target.value)} className={className}>
      <option value="">Оберіть місто</option>
      {isLegacyCity && <option value={value}>{value}</option>}
      {UKRAINIAN_OBLAST_CENTERS.map((city) => <option key={city} value={city}>{city}</option>)}
    </select>
  )
}
