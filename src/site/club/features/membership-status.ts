import type { Membership } from '@/lib/club-types';
export const membershipStatusText: Record<Membership['status'], string> = {
  pending: 'Очікуємо підтвердження',
  joined: 'Участь підтверджено',
  waitlisted: 'Ти у листі очікування',
  rejected: 'Заявку відхилено',
};
