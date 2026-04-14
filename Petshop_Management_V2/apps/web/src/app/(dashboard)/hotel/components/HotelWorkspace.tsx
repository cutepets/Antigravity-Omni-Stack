'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DataListShell } from '@petshop/ui/data-list'
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

  useEffect(() => {
    const handleOpenSettings = () => setViewMode('pricing')
    const handleCloseSettings = () => setViewMode('kanban')
    window.addEventListener('openHotelSettings', handleOpenSettings)
    window.addEventListener('closeHotelSettings', handleCloseSettings)
    return () => {
      window.removeEventListener('openHotelSettings', handleOpenSettings)
      window.removeEventListener('closeHotelSettings', handleCloseSettings)
    }
  }, [])

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Đang kiểm tra quyền truy cập...</div>
  }

  if (!canReadHotel) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Đang chuyển hướng...</div>
  }

  return (
    <DataListShell className="min-h-0">
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        {/* Header & Tabs */}
        {viewMode !== 'pricing' && (
          <div className="flex items-center justify-end mb-4">
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
            </div>
          </div>
        )}

        {/* Content Area */}
        {viewMode === 'pricing' ? (
          <div className="flex flex-col flex-1 min-h-0">
            <ServicePricingWorkspace mode="HOTEL" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 bg-background-base rounded-3xl border border-border overflow-y-auto flex flex-col">
            {viewMode === 'kanban' && <div className="p-4 flex-1 min-h-0 flex flex-col"><CageGrid /></div>}
            {viewMode === 'list' && <StayList />}
          </div>
        )}
      </div>
    </DataListShell>
  )
}
