export interface EventAccess {
  is_public?: boolean
  join_mode?: 'open' | 'approval'
}

export function getEventAccessLabel(event: EventAccess) {
  if (event.is_public === false) return 'За запрошенням'
  if (event.join_mode === 'approval') return 'За підтвердженням'
  return 'Вільний вхід'
}

export function getEventAccessChipClass(event: EventAccess) {
  if (event.is_public === false) return 'border-slate-200 bg-slate-100 text-slate-700'
  if (event.join_mode === 'approval') return 'border-amber-200 bg-amber-100 text-amber-900'
  return 'border-emerald-200 bg-emerald-100 text-emerald-800'
}
