import type { PublicEventData } from '@/components/home/types'

export const PUBLIC_CATEGORIES = ['cinema', 'theatre', 'bar', 'sport', 'music', 'other'] as const
export const DEMO_EVENTS_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_EVENTS === 'true'

function upcomingDate(dayOffset: number, hour: number, minute: number) {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

function nextWeekdayDate(weekday: number, hour: number, minute: number) {
  const today = new Date()
  const offset = (weekday - today.getDay() + 7) % 7 || 7
  return upcomingDate(offset, hour, minute)
}

const demoPeople = [
  { id: 'demo-person-1', name: 'Олена', avatar_url: null },
  { id: 'demo-person-2', name: 'Максим', avatar_url: null },
  { id: 'demo-person-3', name: 'Ірина', avatar_url: null },
  { id: 'demo-person-4', name: 'Тарас', avatar_url: null },
]

const organizer = {
  id: 'demo-organizer',
  name: 'Анастасія Коваль',
  avatar_url: null,
  google_verified: true,
}

function demoEvent(event: Omit<PublicEventData, 'isDemo' | 'organizer' | 'cover_photo_url' | 'created_at' | 'participants'>): PublicEventData {
  return {
    ...event,
    isDemo: true,
    organizer,
    cover_photo_url: `${import.meta.env.BASE_URL}demo-events/${event.category}.jpg`,
    created_at: '2026-08-27T09:00:00+03:00',
    participants: demoPeople.slice(0, Math.min(4, event.participant_count)),
  }
}

export const DEMO_PUBLIC_EVENTS: PublicEventData[] = [
  demoEvent({ id: 'demo-cinema', title: "Прем'єра: Дюна 2", category: 'cinema', address_text: 'Multiplex, ТРЦ Hollywood', event_datetime: '2026-09-04T19:30:00+03:00', min_age: 18, max_age: 35, gender_filter: 'any', max_participants: 8, participant_count: 5, distance_km: 1.8, description: 'Збираємо невелику компанію на вечірній сеанс. Після фільму можемо випити кави й обговорити прем’єру.', location_lat: 51.5031, location_lng: 31.2849 }),
  demoEvent({ id: 'demo-theatre', title: 'Вистава «Хто ти є?»', category: 'theatre', address_text: 'Чернігівський драмтеатр, просп. Миру, 23', event_datetime: '2026-09-06T18:00:00+03:00', min_age: 22, max_age: 45, gender_filter: 'any', max_participants: 6, participant_count: 4, distance_km: 0.9, description: 'Йдемо разом на сучасну камерну виставу в центрі Чернігова. Зустрічаємося біля головного входу за 20 хвилин до початку.', location_lat: 51.4938, location_lng: 31.2945 }),
  demoEvent({ id: 'demo-bar', title: 'Вечір у барі Chill', category: 'bar', address_text: 'Chill Bar, вул. Коцюбинського, 8', event_datetime: '2026-09-11T20:00:00+03:00', min_age: 21, max_age: 38, gender_filter: 'any', max_participants: 10, participant_count: 7, distance_km: 1.2, description: 'Невимушений вечір, нові знайомства й коктейлі. Бронюємо великий столик, тож приходьте вчасно.', location_lat: 51.4907, location_lng: 31.2967 }),
  demoEvent({ id: 'demo-sport', title: 'Футбол. Відкрита гра', category: 'sport', address_text: 'Стадіон ім. Гагаріна, вул. Шевченка, 61', event_datetime: '2026-09-05T11:00:00+03:00', min_age: 18, max_age: 40, gender_filter: 'any', max_participants: 14, participant_count: 9, distance_km: 2.6, description: 'Дружня відкрита гра без турнірної напруги. Беріть зручну форму й воду, команди сформуємо на місці.', location_lat: 51.5057, location_lng: 31.3141 }),
  demoEvent({ id: 'demo-music', title: 'Живий концерт у центрі', category: 'music', address_text: 'Артпростір на Красній площі', event_datetime: '2026-09-12T19:00:00+03:00', min_age: 18, max_age: 42, gender_filter: 'any', max_participants: 12, participant_count: 8, distance_km: 0.7, description: 'Слухаємо наживо локальних музикантів просто неба. Зустрічаємося біля фонтану й разом ідемо до сцени.', location_lat: 51.4914, location_lng: 31.2985 }),
  demoEvent({ id: 'demo-other', title: 'Мафія: вечірня гра', category: 'other', address_text: 'Центр розвитку молоді, вул. Магістратська, 3', event_datetime: '2026-09-10T18:30:00+03:00', min_age: 20, max_age: 40, gender_filter: 'any', max_participants: 12, participant_count: 6, distance_km: 1.1, description: 'Класична «Мафія» для новачків і досвідчених гравців. Ведучий пояснить правила перед першою грою.', location_lat: 51.4919, location_lng: 31.2928 }),
]

export const DEMO_PERSONAL_EVENTS: PublicEventData[] = [
  {
    id: 'demo-personal-coffee', title: 'Кава після роботи', description: 'Хочу випити кави в центрі та познайомитися з новими людьми ☕', category: 'communication', address_text: 'Центр', event_datetime: upcomingDate(0, 19, 0), created_at: upcomingDate(0, 9, 0), min_age: 18, max_age: 40, gender_filter: 'any', cover_photo_url: null, max_participants: 4, participant_count: 1, distance_km: 0.8, organizer: { id: 'demo-personal-maria', name: 'Марія', age: 27, avatar_url: `${import.meta.env.BASE_URL}demo-avatars/maria.png`, google_verified: true }, event_type: 'personal', join_mode: 'approval', participants: [], location_lat: 51.4913, location_lng: 31.2947, isDemo: true,
  },
  {
    id: 'demo-personal-run', title: 'Пробіжка в парку', description: 'Легка вечірня пробіжка без рекордів. Приєднуйтесь', category: 'sport', address_text: 'Міський парк', event_datetime: upcomingDate(1, 18, 30), created_at: upcomingDate(0, 10, 0), min_age: 18, max_age: 45, gender_filter: 'any', cover_photo_url: null, max_participants: 5, participant_count: 2, distance_km: 1.6, organizer: { id: 'demo-personal-oleksii', name: 'Олексій', age: 31, avatar_url: `${import.meta.env.BASE_URL}demo-avatars/oleksii.png`, google_verified: true }, event_type: 'personal', join_mode: 'open', participants: demoPeople.slice(0, 1), location_lat: 51.505, location_lng: 31.315, isDemo: true,
  },
  {
    id: 'demo-personal-games', title: 'Настільні ігри ввечері', description: 'Збираємо невелику компанію пограти та поспілкуватися', category: 'games', address_text: 'Центр', event_datetime: nextWeekdayDate(5, 19, 30), created_at: upcomingDate(0, 11, 0), min_age: 18, max_age: 38, gender_filter: 'any', cover_photo_url: null, max_participants: 6, participant_count: 3, distance_km: 1.1, organizer: { id: 'demo-personal-anna', name: 'Анна', age: 25, avatar_url: `${import.meta.env.BASE_URL}demo-avatars/anna.png`, google_verified: true }, event_type: 'personal', join_mode: 'approval', participants: demoPeople.slice(0, 2), location_lat: 51.492, location_lng: 31.296, isDemo: true,
  },
  {
    id: 'demo-personal-walk', title: 'Прогулянка та кава', description: 'Без планів на вечір — можна пройтися містом і взяти каву.', category: 'communication', address_text: 'Красна площа', event_datetime: nextWeekdayDate(6, 17, 0), created_at: upcomingDate(0, 12, 0), min_age: 18, max_age: 40, gender_filter: 'any', cover_photo_url: null, max_participants: 3, participant_count: 1, distance_km: 0.6, organizer: { id: 'demo-personal-maksym', name: 'Максим', age: 29, avatar_url: `${import.meta.env.BASE_URL}demo-avatars/maksym.png`, google_verified: true }, event_type: 'personal', join_mode: 'open', participants: [], location_lat: 51.4914, location_lng: 31.2985, isDemo: true,
  },
]

export function getDemoEvent(id: string | undefined) {
  if (!DEMO_EVENTS_ENABLED) return null
  return [...DEMO_PUBLIC_EVENTS, ...DEMO_PERSONAL_EVENTS].find((event) => event.id === id) ?? null
}
