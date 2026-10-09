import type { Profile } from './club-types';

export const memberTitles = {
  svoya: {
    label: 'Дама', mark: '01',
    description: 'Ти вже частина нашого кола.',
    criteria: 'Збережена анкета з фото та схвалення команди. Титул з’являється автоматично після схвалення.',
  },
  active: {
    label: 'Леді', mark: '02',
    description: 'Знайомишся, долучаєшся, повертаєшся.',
    criteria: 'Участь щонайменше у трьох зустрічах клубу. Команда підтверджує участь з організаторками.',
  },
  inspirer: {
    label: 'Графиня', mark: '03',
    description: 'Твої ідеї збирають інших разом.',
    criteria: 'Щонайменше дві проведені зустрічі або регулярне ведення свого кола. Команда підтверджує внесок.',
  },
  ambassador: {
    label: 'Княгиня', mark: '04',
    description: 'Допомагаєш клубу зростати у своєму місті.',
    criteria: 'Тривала участь у розвитку клубу, підтримка новеньких і організаторок. Команда запрошує до цієї ролі та погоджує її з учасницею.',
  },
} as const;
export type MemberTitle = keyof typeof memberTitles;
export const titleKeys = Object.keys(memberTitles) as MemberTitle[];
export function normalizedTitle(value: string | undefined): MemberTitle {
  return value && Object.hasOwn(memberTitles,value) ? value as MemberTitle : 'svoya';
}
export function visibleTitle(profile: Profile | null | undefined): MemberTitle | null {
  return profile?.membership_status === 'approved' ? normalizedTitle(profile.member_title) : null;
}
