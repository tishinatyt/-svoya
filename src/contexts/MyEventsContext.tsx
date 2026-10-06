import { createContext, useContext, type ReactNode } from 'react'
import { useMyEvents } from '@/hooks/useMyEvents'

type MyEventsValue = ReturnType<typeof useMyEvents>

const MyEventsContext = createContext<MyEventsValue | null>(null)

export function MyEventsProvider({ children }: { children: ReactNode }) {
  const value = useMyEvents()
  return <MyEventsContext.Provider value={value}>{children}</MyEventsContext.Provider>
}

export function useMyEventsContext() {
  const context = useContext(MyEventsContext)
  if (!context) throw new Error('useMyEventsContext must be used within MyEventsProvider')
  return context
}
