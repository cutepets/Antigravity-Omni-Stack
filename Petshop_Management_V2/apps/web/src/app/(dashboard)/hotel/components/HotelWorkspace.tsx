'use client'

import { useState } from 'react'
import { LayoutGrid, List, Table } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DataListShell } from '@/components/data-list'
import StayList from './StayList'
import CageGrid from './CageGrid'

type ViewMode = 'kanban' | 'list' | 'pricing'

export default function HotelWorkspace() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')

  return (
    <DataListShell className="min-h-0">
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        {/* Header & Tabs */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-foreground">Quản lý Hotel</h1>
          <div className="inline-flex items-center p-1 border rounded-2xl border-border bg-background-secondary">
            <button 
              type="button" 
              onClick={() => setViewMode('kanban')} 
              className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors', viewMode === 'kanban' ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground')}
            >
              <LayoutGrid size={15} />
              Sơ đồ
            </button>
            <button 
              type="button" 
              onClick={() => setViewMode('list')} 
              className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors', viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground')}
            >
              <List size={15} />
              Danh sách
            </button>
            <button 
              type="button" 
              onClick={() => setViewMode('pricing')} 
              className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors', viewMode === 'pricing' ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground')}
            >
              <Table size={15} />
              Bảng giá
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 bg-background-base rounded-3xl border border-border overflow-y-auto">
          {viewMode === 'kanban' && <div className="p-4"><CageGrid /></div>}
          {viewMode === 'list' && <StayList />}
          {viewMode === 'pricing' && <div className="p-4 h-full flex items-center justify-center text-foreground-muted font-medium">Bảng giá View (Coming soon)</div>}
        </div>
      </div>
    </DataListShell>
  )
}
