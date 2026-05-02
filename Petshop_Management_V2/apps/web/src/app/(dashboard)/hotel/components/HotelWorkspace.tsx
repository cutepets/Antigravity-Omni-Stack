'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DataListFilterPanel,
  DataListShell,
  DataListToolbar,
  filterSelectClass,
  toolbarSelectClass,
} from '@petshop/ui/data-list'
import { HotelQuickPreviewTool } from '@/components/hotel-quick-preview/HotelQuickPreviewTool'
import { ServicePricingWorkspace } from '@/components/service-pricing/ServicePricingWorkspace'
import { useAuthorization } from '@/hooks/useAuthorization'
import StayList from './StayList'
import CageGrid from './CageGrid'

type ViewMode = 'kanban' | 'list' | 'pricing'

function HotelWorkspaceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: isAuthLoading } = useAuthorization()
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [boardSearch, setBoardSearch] = useState('')
  const [boardStatus, setBoardStatus] = useState('')
  const [showBookedPanel, setShowBookedPanel] = useState(true)
  const [showCheckedOutPanel, setShowCheckedOutPanel] = useState(true)
  const canReadHotel = hasPermission('hotel.read')
  const initialSearch = searchParams.get('search')?.trim() ?? ''
  const focusStayId = searchParams.get('stayId')

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

  const wasDeepLinkedRef = useRef(false)

  useEffect(() => {
    if (initialSearch || focusStayId) {
      wasDeepLinkedRef.current = true
      setViewMode('list')
    } else if (wasDeepLinkedRef.current) {
      // Return to kanban when deep-link params are cleared (e.g. dialog closed)
      wasDeepLinkedRef.current = false
      setViewMode('kanban')
    }
  }, [focusStayId, initialSearch])

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Đang kiểm tra quyền truy cập...</div>
  }

  if (!canReadHotel) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Đang chuyển hướng...</div>
  }

  return (
    <DataListShell className="min-h-0">
      <div className="flex flex-col flex-1 min-h-0 gap-2.5">
        {/* Content Area */}
        {viewMode === 'pricing' ? (
          <div className="flex flex-col">
            <ServicePricingWorkspace mode="HOTEL" />
          </div>
        ) : viewMode === 'kanban' ? (
          <>
            <DataListToolbar
              searchValue={boardSearch}
              onSearchChange={setBoardSearch}
              searchPlaceholder="Tìm thú cưng, mã lưu trú..."
              showFilterToggle={true}
              showColumnToggle={true}
              filterSlot={
                <select
                  className={toolbarSelectClass}
                  value={boardStatus}
                  onChange={(event) => setBoardStatus(event.target.value)}
                >
                  <option value="">Trạng thái (Tất cả)</option>
                  <option value="BOOKED">Đã đặt</option>
                  <option value="CHECKED_IN">Đang ở</option>
                  <option value="CHECKED_OUT">Đã trả</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              }
              columnPanelContent={
                <div className="w-64 rounded-2xl border border-border bg-background-secondary p-3 shadow-xl">
                  <div className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Cột sơ đồ</div>
                  <label className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-foreground hover:bg-background-tertiary">
                    <input
                      type="checkbox"
                      checked={showBookedPanel}
                      onChange={(event) => setShowBookedPanel(event.target.checked)}
                      className="h-4 w-4 accent-primary-500"
                    />
                    Đặt lịch
                  </label>
                  <label className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-foreground hover:bg-background-tertiary">
                    <input
                      type="checkbox"
                      checked={showCheckedOutPanel}
                      onChange={(event) => setShowCheckedOutPanel(event.target.checked)}
                      className="h-4 w-4 accent-primary-500"
                    />
                    Đã trả hôm nay
                  </label>
                </div>
              }
              extraActions={
                <div className="flex flex-wrap items-center gap-2">
                  <HotelQuickPreviewTool triggerClassName="bg-background-secondary text-foreground hover:bg-background-secondary/80" />
                  <div className="inline-flex items-center rounded-2xl border border-border bg-background-secondary p-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('kanban')}
                      className={cn('inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors', viewMode === 'kanban' ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground')}
                    >
                      <LayoutGrid size={15} />
                      Sơ đồ
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground-muted transition-colors hover:text-foreground"
                    >
                      <List size={15} />
                      Danh sách
                    </button>
                  </div>
                </div>
              }
            />
            <DataListFilterPanel onClearAll={() => {
              setBoardSearch('')
              setBoardStatus('')
            }}>
              <label className="space-y-2">
                <span className="text-sm text-foreground-muted">Trạng thái lưu trú</span>
                <select
                  value={boardStatus}
                  onChange={(event) => setBoardStatus(event.target.value)}
                  className={filterSelectClass}
                >
                  <option value="">Tất cả</option>
                  <option value="BOOKED">Đã đặt</option>
                  <option value="CHECKED_IN">Đang ở</option>
                  <option value="CHECKED_OUT">Đã trả</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </label>
            </DataListFilterPanel>
            <div className="flex-1 min-h-0 bg-background-base rounded-3xl border border-border overflow-y-auto flex flex-col">
              <div className="p-4 flex-1 min-h-0 flex flex-col">
                <CageGrid
                  search={boardSearch}
                  statusFilter={boardStatus}
                  showBookedPanel={showBookedPanel}
                  showCheckedOutPanel={showCheckedOutPanel}
                />
              </div>
            </div>
          </>
        ) : (
          <StayList
            initialSearch={initialSearch}
            focusStayId={focusStayId ?? undefined}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        )}
      </div>
    </DataListShell>
  )
}

export default function HotelWorkspace() {
  return (
    <Suspense fallback={<div className="p-4">Đang tải...</div>}>
      <HotelWorkspaceContent />
    </Suspense>
  )
}
