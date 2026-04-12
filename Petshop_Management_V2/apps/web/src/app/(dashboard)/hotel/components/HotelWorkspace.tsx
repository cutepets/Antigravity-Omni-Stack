'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid, List, Table } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DataListShell } from '@/components/data-list'
import { ServicePricingWorkspace } from '@/components/service-pricing/ServicePricingWorkspace'
import { useAuthorization } from '@/hooks/useAuthorization'
import StayList from './StayList'
import CageGrid from './CageGrid'

type ViewMode = 'kanban' | 'list' | 'pricing'

export default function HotelWorkspace() {
  const router = useRouter()
  const { hasPermission, isLoading: isAuthLoading } = useAuthorization()
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const canReadHotel = hasPermission('hotel.read')

  useEffect(() => {
    if (isAuthLoading) return
    if (!canReadHotel) {
      router.replace('/dashboard')
    }
  }, [canReadHotel, isAuthLoading, router])

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Dang kiem tra quyen truy cap...</div>
  }

  if (!canReadHotel) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Dang chuyen huong...</div>
  }

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
          {viewMode === 'pricing' && <ServicePricingWorkspace mode="HOTEL" />}
        </div>
      </div>
    </DataListShell>
  )
}
