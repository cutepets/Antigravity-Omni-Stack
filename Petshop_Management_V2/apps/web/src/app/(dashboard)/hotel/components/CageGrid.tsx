'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hotelApi, Cage, HotelStay } from '@/lib/api/hotel.api'
import { useState, useCallback, useMemo } from 'react'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useAuthStore } from '@/stores/auth.store'
import { format, isToday, differenceInDays } from 'date-fns'

import CheckInDialog from './CheckInDialog'
import StayDetailsDialog from './StayDetailsDialog'
import ManageCagesDialog from './ManageCagesDialog'

// ---- Utility helpers ----

const formatCurrencyShort = (value: number | null | undefined): string => {
  if (value == null || value === 0) return '—'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}tr`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(value)
}

const getDaysInfo = (stay: HotelStay): { label: string; remaining: number } => {
  const checkIn = new Date(stay.checkIn)
  const estimatedOut = stay.estimatedCheckOut ? new Date(stay.estimatedCheckOut) : null
  const totalDays = estimatedOut ? Math.max(1, differenceInDays(estimatedOut, checkIn)) : 1
  const elapsed = Math.max(0, differenceInDays(new Date(), checkIn))
  const remaining = Math.max(0, totalDays - elapsed)
  return { label: `${totalDays} ngày`, remaining }
}

const isStayCheckedOutToday = (stay: HotelStay): boolean => {
  if (stay.status !== 'CHECKED_OUT') return false
  if (!stay.checkOutActual) return false
  return isToday(new Date(stay.checkOutActual))
}

// ---- Drag data types ----

interface BookedDragData {
  type: 'booked'
  stayId: string
}

interface CageDragData {
  type: 'cage'
  cageId: string
}

type DragData = BookedDragData | CageDragData

// ---- Small pet card for booked / checked-out panels ----

function SmallPetCard({
  stay,
  draggable,
  onDragStart,
  onClick,
  variant = 'booked',
}: {
  stay: HotelStay
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, data: DragData) => void
  onClick?: () => void
  variant?: 'booked' | 'checkedout'
}) {
  const daysInfo = getDaysInfo(stay)
  const isBooked = variant === 'booked'

  return (
    <div
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => onDragStart(e, { type: 'booked', stayId: stay.id }) : undefined}
      onClick={onClick}
      className={`group relative flex flex-col items-center rounded-xl border p-2 transition-all ${isBooked
        ? 'cursor-grab border-border bg-background-base hover:border-primary-500/40 hover:shadow-md active:cursor-grabbing'
        : 'cursor-default border-emerald-500/20 bg-emerald-500/5'
        }`}
    >
      {isBooked && (
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gray-600 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-500"
        >
          ✕
        </button>
      )}

      {/* Price badge */}
      <span className="absolute right-1 top-1 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-gray-900">
        {formatCurrencyShort(stay.totalPrice)}
      </span>

      {/* Pet avatar */}
      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-sm font-black uppercase text-primary-500">
        {stay.petName?.charAt(0) || 'P'}
      </div>

      {/* Pet name */}
      <p className="truncate text-[11px] font-bold text-foreground">{stay.petName || '---'}</p>

      {/* Stay code */}
      {stay.stayCode && (
        <p className="text-[9px] font-mono text-primary-500/70">{stay.stayCode.slice(-6).toUpperCase()}</p>
      )}

      {/* Days */}
      {isBooked && (
        <p className="mt-0.5 text-[9px] text-foreground-muted">{daysInfo.label}</p>
      )}

      {/* Checked-out badge */}
      {!isBooked && (
        <div className="mt-1 flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[9px] font-semibold text-emerald-600">Đã trả</span>
        </div>
      )}
    </div>
  )
}

// ---- Cage cell in main grid ----

function CageCell({
  cage,
  stay,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragTarget,
  isDragging,
  onClick,
}: {
  cage: Cage
  stay?: HotelStay
  onDragStart?: (e: React.DragEvent, data: DragData) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  isDragTarget?: boolean
  isDragging?: boolean
  onClick?: () => void
}) {
  const isOccupied = !!stay
  const daysInfo = stay ? getDaysInfo(stay) : null

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={!isOccupied ? onClick : undefined}
      className={`relative aspect-square rounded-2xl border-2 transition-all duration-150 ${isDragTarget
        ? 'border-primary-500 bg-primary-500/10 scale-[1.03] shadow-lg shadow-primary-500/20'
        : isDragging
          ? 'opacity-30 scale-90'
          : isOccupied
            ? 'border-border hover:border-primary-500/30 hover:shadow-md'
            : 'border-dashed border-border/40 hover:border-primary-500/30 hover:bg-primary-500/5'
        }`}
    >
      {isOccupied && stay ? (
        /* Occupied cage */
        <button
          type="button"
          draggable
          onDragStart={(e) => onDragStart?.(e, { type: 'cage', cageId: cage.id })}
          onClick={onClick}
          className="flex h-full w-full cursor-grab flex-col items-center justify-center rounded-xl bg-background-base p-2 text-center active:cursor-grabbing hover:shadow-lg"
        >
          {/* Days badge */}
          {daysInfo && (
            <span className="absolute left-1.5 top-1.5 text-[9px] font-semibold text-blue-500">
              {daysInfo.label}
            </span>
          )}

          {/* Price badge */}
          <span className="absolute right-1.5 top-1.5 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-gray-900">
            {formatCurrencyShort(stay.totalPrice)}
          </span>

          {/* Pet avatar */}
          <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl border border-primary-500/15 bg-primary-500/10 text-base font-black uppercase text-primary-500">
            {stay.petName?.charAt(0) || 'P'}
          </div>

          {/* Pet name */}
          <p className="truncate text-xs font-bold text-foreground">{stay.petName || '---'}</p>

          {/* Stay code */}
          {stay.stayCode && (
            <p className="text-[9px] font-mono text-primary-500/60">
              {stay.stayCode.slice(-6).toUpperCase()}
            </p>
          )}

          {/* Cage name */}
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">
            <span className="h-1 w-1 rounded-full bg-amber-500" />
            {cage.name}
          </span>
        </button>
      ) : (
        /* Empty cage — drop target for booked stays */
        <div className="flex h-full w-full flex-col items-center justify-center rounded-xl p-2 text-center">
          <span className="text-lg text-foreground-muted/30">+</span>
          <p className="mt-0.5 text-[9px] font-medium text-foreground-muted/50">{cage.name}</p>
        </div>
      )}
    </div>
  )
}

// ---- Main component ----

export default function CageGrid() {
  const queryClient = useQueryClient()
  const { hasAnyPermission } = useAuthorization()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)

  // Drag state
  const [draggedData, setDraggedData] = useState<DragData | null>(null)
  const [dragOverCageId, setDragOverCageId] = useState<string | null>(null)
  const [dragOverCenter, setDragOverCenter] = useState(false)

  // Modal states
  const [selectedCage, setSelectedCage] = useState<Cage | null>(null)
  const [selectedStay, setSelectedStay] = useState<HotelStay | null>(null)
  const [isCheckInOpen, setIsCheckInOpen] = useState(false)
  const [isStayDetailsOpen, setIsStayDetailsOpen] = useState(false)
  const [isManageCagesOpen, setIsManageCagesOpen] = useState(false)

  const canCheckIn = hasAnyPermission(['hotel.create', 'hotel.checkin'])
  const canManageCages = hasAnyPermission(['hotel.create', 'hotel.update', 'hotel.cancel'])

  // ---- Data fetching ----

  const { data: cages = [], isLoading: cagesLoading } = useQuery({
    queryKey: ['cages', activeBranchId],
    queryFn: hotelApi.getCages,
  })

  const { data: stays = [], isLoading: staysLoading } = useQuery({
    queryKey: ['stays', activeBranchId],
    queryFn: hotelApi.getStays,
  })

  // ---- Categorize stays ----

  const { bookedStays, boardingStays, checkedOutToday } = useMemo(() => {
    const booked: HotelStay[] = []
    const boarding: HotelStay[] = []
    const checkedOut: HotelStay[] = []

    for (const stay of stays) {
      // Filter by branch if activeBranchId is set
      if (activeBranchId && stay.branchId && stay.branchId !== activeBranchId) continue

      if (stay.status === 'BOOKED') {
        booked.push(stay)
      } else if (stay.status === 'CHECKED_IN') {
        boarding.push(stay)
      } else if (isStayCheckedOutToday(stay)) {
        checkedOut.push(stay)
      }
    }

    return { bookedStays: booked, boardingStays: boarding, checkedOutToday: checkedOut }
  }, [stays, activeBranchId])

  // Build cage→stay map for boarding stays
  const cageStayMap = useMemo(() => {
    const map = new Map<string, HotelStay>()
    for (const stay of boardingStays) {
      if (stay.cageId) map.set(stay.cageId, stay)
    }
    return map
  }, [boardingStays])

  // Active cages only
  const activeCages = useMemo(() => {
    return cages.filter((c) => c.isActive !== false)
  }, [cages])

  // Sort cages by position
  const sortedCages = useMemo(() => {
    return [...activeCages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  }, [activeCages])

  const isLoading = cagesLoading || staysLoading

  // ---- Mutations ----

  const reorderMutation = useMutation({
    mutationFn: (cageIds: string[]) => hotelApi.reorderCages(cageIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cages', activeBranchId] })
    },
  })

  // ---- Drag-and-Drop handlers ----

  const handleDragStart = useCallback((e: React.DragEvent, data: DragData) => {
    setDraggedData(data)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(data))
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedData(null)
    setDragOverCageId(null)
    setDragOverCenter(false)
  }, [])

  const handleCageDragOver = useCallback((e: React.DragEvent, cageId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCageId(cageId)
  }, [])

  const handleCageDragLeave = useCallback(() => {
    setDragOverCageId(null)
  }, [])

  const handleCenterDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCenter(true)
  }, [])

  const handleCenterDragLeave = useCallback(() => {
    setDragOverCenter(false)
  }, [])

  const handleCageDrop = useCallback(
    (e: React.DragEvent, targetCage: Cage) => {
      e.preventDefault()
      setDragOverCageId(null)
      setDragOverCenter(false)

      if (!draggedData) return

      if (draggedData.type === 'booked') {
        // Check in a booked stay into this cage
        const bookedStay = bookedStays.find((s) => s.id === draggedData.stayId)
        if (!bookedStay) return

        // Update stay: set cageId and status to CHECKED_IN
        // This would need an API call — for now open the check-in dialog
        setSelectedCage(targetCage)
        setSelectedStay(bookedStay)
        setIsCheckInOpen(true)
      } else if (draggedData.type === 'cage') {
        // Reorder cages
        const sourceIndex = sortedCages.findIndex((c) => c.id === draggedData.cageId)
        const targetIndex = sortedCages.findIndex((c) => c.id === targetCage.id)
        if (sourceIndex === -1 || targetIndex === -1) return

        const newOrder = [...sortedCages]
        const [moved] = newOrder.splice(sourceIndex, 1)
        newOrder.splice(targetIndex, 0, moved)
        reorderMutation.mutate(newOrder.map((c) => c.id))
      }

      setDraggedData(null)
    },
    [draggedData, bookedStays, sortedCages, reorderMutation],
  )

  const handleCageClick = useCallback(
    (cage: Cage) => {
      setSelectedCage(cage)
      const stay = cageStayMap.get(cage.id)
      if (stay) {
        setSelectedStay(stay)
        setIsStayDetailsOpen(true)
      } else if (canCheckIn) {
        setSelectedStay(null)
        setIsCheckInOpen(true)
      }
    },
    [cageStayMap, canCheckIn],
  )

  // ---- Loading / empty states ----

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-foreground-muted">Đang tải dữ liệu...</div>
  }

  return (
    <div className="flex h-full gap-3">
      {/* ===== LEFT PANEL: ĐẶT LỊCH ===== */}
      <aside className="flex w-36 shrink-0 flex-col rounded-2xl border border-border bg-background-secondary/50">
        <div className="flex items-center justify-between border-b border-border/50 px-3 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Đặt lịch</h3>
          <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-500">
            {bookedStays.length}
          </span>
        </div>
        <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto p-2">
          {bookedStays.map((stay) => (
            <SmallPetCard
              key={stay.id}
              stay={stay}
              draggable={canCheckIn}
              onDragStart={handleDragStart}
              onClick={() => {
                // Open check-in for this booked stay — pick a cage
                const emptyCage = sortedCages.find((c) => !cageStayMap.has(c.id))
                if (emptyCage) {
                  setSelectedCage(emptyCage)
                  setSelectedStay(stay)
                } else {
                  setSelectedCage(null)
                  setSelectedStay(stay)
                }
                setIsCheckInOpen(true)
              }}
              variant="booked"
            />
          ))}
          {bookedStays.length === 0 && (
            <p className="py-8 text-center text-[10px] text-foreground-muted/50">Không có đặt lịch nào</p>
          )}
          {canCheckIn && (
            <button
              type="button"
              onClick={() => {
                setSelectedCage(null)
                setSelectedStay(null)
                setIsCheckInOpen(true)
              }}
              className="flex h-16 w-full items-center justify-center rounded-xl border-2 border-dashed border-border/50 text-2xl text-foreground-muted/30 transition-colors hover:border-primary-500/30 hover:bg-primary-500/5"
            >
              +
            </button>
          )}
        </div>
      </aside>

      {/* ===== CENTER PANEL: TRÔNG GIỮ ===== */}
      <main
        className="flex min-w-0 flex-1 flex-col"
        onDragOver={handleCenterDragOver}
        onDragLeave={handleCenterDragLeave}
        onDrop={(e) => {
          e.preventDefault()
          setDragOverCenter(false)
          // Dropping booked stay anywhere in center — pick first empty cage
          if (draggedData?.type === 'booked') {
            const emptyCage = sortedCages.find((c) => !cageStayMap.has(c.id))
            if (emptyCage) {
              setSelectedCage(emptyCage)
              const bookedStay = bookedStays.find((s) => s.id === draggedData.stayId)
              if (bookedStay) setSelectedStay(bookedStay)
              setIsCheckInOpen(true)
            }
          }
        }}
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
            Trông giữ
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-foreground-muted">
              {boardingStays.length}/{sortedCages.length}
            </span>
            <button
              onClick={() => canManageCages && setIsManageCagesOpen(true)}
              disabled={!canManageCages}
              className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold text-foreground-muted transition hover:border-primary-500/40 hover:text-foreground disabled:opacity-50"
            >
              + Chuồng
            </button>
          </div>
        </div>

        {/* Cage grid */}
        {sortedCages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="rounded-2xl border-2 border-dashed border-border/50 p-12 text-center">
              <p className="text-3xl mb-3">🏠</p>
              <p className="text-sm font-bold text-foreground">Chưa có chuồng nào</p>
              <p className="mt-1 text-xs text-foreground-muted">Thêm chuồng để bắt đầu trông giữ.</p>
              {canManageCages && (
                <button
                  onClick={() => setIsManageCagesOpen(true)}
                  className="mt-4 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                >
                  Thêm chuồng
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
              {sortedCages.map((cage) => {
                const stay = cageStayMap.get(cage.id)
                const isDragTarget = dragOverCageId === cage.id && draggedData?.type === 'cage' && draggedData.cageId !== cage.id
                const isDragging = draggedData?.type === 'cage' && draggedData.cageId === cage.id

                return (
                  <CageCell
                    key={cage.id}
                    cage={cage}
                    stay={stay}
                    onDragStart={handleDragStart}
                    onDragOver={(e) => handleCageDragOver(e, cage.id)}
                    onDragLeave={handleCageDragLeave}
                    onDrop={(e) => handleCageDrop(e, cage)}
                    isDragTarget={isDragTarget}
                    isDragging={isDragging}
                    onClick={() => handleCageClick(cage)}
                  />
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* ===== RIGHT PANEL: ĐÃ TRẢ HÔM NAY ===== */}
      <aside className="flex w-36 shrink-0 flex-col rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
        <div className="flex items-center justify-between border-b border-emerald-500/20 px-3 py-2.5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600">Đã trả</h3>
            <p className="text-[9px] text-emerald-500/60">Hôm nay</p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
            {checkedOutToday.length}
          </span>
        </div>
        <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto p-2">
          {checkedOutToday.map((stay) => (
            <SmallPetCard key={stay.id} stay={stay} variant="checkedout" />
          ))}
          {checkedOutToday.length === 0 && (
            <p className="py-8 text-center text-[10px] text-emerald-500/30">Chưa có thú nào trả</p>
          )}
        </div>
      </aside>

      {/* ===== MODALS ===== */}
      {canCheckIn && (
        <CheckInDialog
          cage={selectedCage}
          bookedStay={selectedStay}
          isOpen={isCheckInOpen}
          onClose={() => {
            setIsCheckInOpen(false)
            setSelectedCage(null)
            setSelectedStay(null)
          }}
        />
      )}
      <StayDetailsDialog
        cage={selectedCage}
        stay={selectedStay}
        isOpen={isStayDetailsOpen}
        onClose={() => {
          setIsStayDetailsOpen(false)
          setSelectedCage(null)
          setSelectedStay(null)
        }}
      />
      {canManageCages && (
        <ManageCagesDialog
          isOpen={isManageCagesOpen}
          onClose={() => setIsManageCagesOpen(false)}
        />
      )}
    </div>
  )
}
