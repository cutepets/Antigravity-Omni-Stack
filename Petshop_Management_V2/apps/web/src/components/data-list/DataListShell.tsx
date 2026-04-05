'use client'

import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useState } from 'react'

type ActivePanel = 'filter' | 'column' | null

interface DataListContextValue {
  activePanel: ActivePanel
  openPanel: (panel: ActivePanel) => void
  closePanel: () => void
  togglePanel: (panel: 'filter' | 'column') => void
}

const DataListContext = createContext<DataListContextValue | null>(null)

export function useDataList() {
  const ctx = useContext(DataListContext)
  if (!ctx) throw new Error('useDataList must be used inside <DataListShell>')
  return ctx
}

interface DataListShellProps {
  children: ReactNode
  className?: string
}

export function DataListShell({ children, className }: DataListShellProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)

  const openPanel = useCallback((panel: ActivePanel) => setActivePanel(panel), [])
  const closePanel = useCallback(() => setActivePanel(null), [])
  const togglePanel = useCallback((panel: 'filter' | 'column') => {
    setActivePanel((current) => (current === panel ? null : panel))
  }, [])

  return (
    <DataListContext.Provider value={{ activePanel, openPanel, closePanel, togglePanel }}>
      <div className={`relative flex h-full min-h-0 flex-col gap-3 ${className ?? ''}`}>
        {children}
      </div>
    </DataListContext.Provider>
  )
}
