export const UKRAINIAN_OBLAST_CENTERS = [
  'Вінниця',
  'Дніпро',
  'Донецьк',
  'Житомир',
  'Запоріжжя',
  'Івано-Франківськ',
  'Київ',
  'Кропивницький',
  'Луганськ',
  'Луцьк',
  'Львів',
  'Миколаїв',
  'Одеса',
  'Полтава',
  'Рівне',
  'Суми',
  'Тернопіль',
  'Ужгород',
  'Харків',
  'Херсон',
  'Хмельницький',
  'Черкаси',
  'Чернівці',
  'Чернігів',
] as const

export type UkrainianOblastCenter = (typeof UKRAINIAN_OBLAST_CENTERS)[number]

export interface CityCoordinates {
  lat: number
  lng: number
}

export const OBLAST_CENTER_COORDINATES: Record<UkrainianOblastCenter, CityCoordinates> = {
  'Вінниця': { lat: 49.2331, lng: 28.4682 },
  'Дніпро': { lat: 48.4647, lng: 35.0462 },
  'Донецьк': { lat: 48.0159, lng: 37.8029 },
  'Житомир': { lat: 50.2547, lng: 28.6587 },
  'Запоріжжя': { lat: 47.8388, lng: 35.1396 },
  'Івано-Франківськ': { lat: 48.9226, lng: 24.7111 },
  'Київ': { lat: 50.4501, lng: 30.5234 },
  'Кропивницький': { lat: 48.5079, lng: 32.2623 },
  'Луганськ': { lat: 48.574, lng: 39.3078 },
  'Луцьк': { lat: 50.7472, lng: 25.3254 },
  'Львів': { lat: 49.8397, lng: 24.0297 },
  'Миколаїв': { lat: 46.975, lng: 31.9946 },
  'Одеса': { lat: 46.4825, lng: 30.7233 },
  'Полтава': { lat: 49.5883, lng: 34.5514 },
  'Рівне': { lat: 50.6199, lng: 26.2516 },
  'Суми': { lat: 50.9077, lng: 34.7981 },
  'Тернопіль': { lat: 49.5535, lng: 25.5948 },
  'Ужгород': { lat: 48.6208, lng: 22.2879 },
  'Харків': { lat: 49.9935, lng: 36.2304 },
  'Херсон': { lat: 46.6354, lng: 32.6169 },
  'Хмельницький': { lat: 49.423, lng: 26.9871 },
  'Черкаси': { lat: 49.4444, lng: 32.0598 },
  'Чернівці': { lat: 48.2915, lng: 25.9403 },
  'Чернігів': { lat: 51.493, lng: 31.2945 },
}

export function getOblastCenterCoordinates(city: string | null | undefined): CityCoordinates | null {
  if (!city || !UKRAINIAN_OBLAST_CENTERS.includes(city as UkrainianOblastCenter)) return null
  return OBLAST_CENTER_COORDINATES[city as UkrainianOblastCenter]
}
