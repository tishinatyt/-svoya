export const EVENT_CATEGORY_LABELS: Record<string, string> = {
  cinema: 'Кіно',
  theatre: 'Театр',
  bar: 'Бар',
  sport: 'Спорт',
  music: 'Музика',
  food: 'Їжа',
  games: 'Ігри',
  walk: 'Прогулянка',
  art: 'Мистецтво',
  communication: 'Спілкування',
  other: 'Інше',
}

export function eventCategoryLabel(category: string) {
  return EVENT_CATEGORY_LABELS[category] ?? category
}
