import type { SVGProps } from 'react'

export type IconName =
  | 'home'
  | 'plus'
  | 'message'
  | 'calendar'
  | 'bookmark'
  | 'user'
  | 'settings'
  | 'search'
  | 'pin'
  | 'bell'
  | 'chevron'
  | 'clock'
  | 'film'
  | 'theatre'
  | 'martini'
  | 'dumbbell'
  | 'music'
  | 'utensils'
  | 'gamepad'
  | 'footprints'
  | 'palette'
  | 'users'
  | 'userCheck'
  | 'sparkles'

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5M9 21v-7h6v7"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4m8-4v4M3 10h18"/></>,
  bookmark: <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z"/>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.4.3.8.7 1 .1H21v4h-.1a1.7 1.7 0 0 0-1.5 1.9Z"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  film: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14m10-14v14M3 9h4m10 0h4M3 15h4m10 0h4"/></>,
  theatre: <><path d="M4 5c3 1 5 1 8 0v6c0 4-2 7-4 8-2-1-4-4-4-8Z"/><path d="M12 7c3 1 5 1 8 0v6c0 4-2 7-4 8-1-.5-2-1.5-3-3M6.5 10h.01m3 0h.01M6.5 14c1 .8 2 .8 3 0"/></>,
  martini: <><path d="M4 4h16l-8 9Z"/><path d="M12 13v7m-4 0h8M7 7h10"/></>,
  dumbbell: <><path d="M6 8v8m12-8v8M3 10v4m18-4v4M6 12h12"/></>,
  music: <><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
  utensils: <><path d="M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18m0-18c3 2 4 5 4 8h-4"/></>,
  gamepad: <><path d="M8 7h8a5 5 0 0 1 4.8 6.4l-1 3.4a2.7 2.7 0 0 1-4.5 1.1L13.8 16h-3.6l-1.5 1.9a2.7 2.7 0 0 1-4.5-1.1l-1-3.4A5 5 0 0 1 8 7Z"/><path d="M8 10v4m-2-2h4m6-1h.01m2 2h.01"/></>,
  footprints: <><path d="M8 3c2 0 3 2 3 4s-1 4-3 4-3-2-3-4 1-4 3-2 3-4Zm8 10c2 0 3 2 3 4s-1 4-3 4-3-2-3-4 1-4 3-2 3-4Z"/></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3-4-6-9-6Z"/><path d="M7.5 9h.01M10 6.5h.01M15 7h.01"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5"/></>,
  userCheck: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0m1-7 2 2 4-5"/></>,
  sparkles: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7ZM5 14l.6 1.9 1.9.6-1.9.6L5 19l-.6-1.9-1.9-.6 1.9-.6Z"/></>,
}

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  )
}
