'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hotelApi, HotelStay } from '@/lib/api/hotel.api'
import { useState, useCallback, useMemo } from 'react'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useAuthStore } from '@/stores/auth.store'
import { format, isToday, differenceInDays } from 'date-fns'
import { toast } from 'sonner'

import CheckInDialog from './CheckInDialog'
import StayDetailsDialog from './StayDetailsDialog'

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

interface SlotDragData {
  type: 'slot'
  slotIndex: number
}

type DragData = BookedDragData | SlotDragData

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
  slotIndex,
  stay,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragTarget,
  isDragging,
  onClick,
}: {
  slotIndex: number
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
          onDragStart={(e) => onDragStart?.(e, { type: 'slot', slotIndex })}
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
        </button>
      ) : (
        /* Empty slot — drop target for booked stays */
        <div className="flex h-full w-full flex-col items-center justify-center rounded-xl p-2 text-center">
          <span className="text-lg text-foreground-muted/30">+</span>
        </div>
      )}
    </div>
  )
}

const GRID_SIZE = 50;
const SLOTS = Array.from({ length: GRID_SIZE }, (_, i) => i);

// ---- Main component ----

export default function CageGrid() {
  const queryClient = useQueryClient()
  const { hasAnyPermission } = useAuthorization()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)

  // Drag state
  const [draggedData, setDraggedData] = useState<DragData | null>(null)
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null)
  const [dragOverCenter, setDragOverCenter] = useState(false)

  // Modal states
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [selectedStay, setSelectedStay] = useState<HotelStay | null>(null)
  const [isStayDetailsOpen, setIsStayDetailsOpen] = useState(false)
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false)

  const canCheckIn = hasAnyPermission(['hotel.create', 'hotel.checkin'])

  // ---- Data fetching ----

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

  // Build slot→stay map for boarding stays
  const slotStayMap = useMemo(() => {
    const map = new Map<number, HotelStay>()
    for (const stay of boardingStays) {
      if (stay.slotIndex != null) map.set(stay.slotIndex, stay)
    }
    return map
  }, [boardingStays])

  const isLoading = staysLoading

  // ---- Mutations ----

  const updateStayMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => hotelApi.updateStay(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stays'] })
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
    setDragOverSlotIndex(null)
    setDragOverCenter(false)
  }, [])

  const handleSlotDragOver = useCallback((e: React.DragEvent, slotIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverSlotIndex(slotIndex)
  }, [])

  const handleSlotDragLeave = useCallback(() => {
    setDragOverSlotIndex(null)
  }, [])

  const handleCenterDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCenter(true)
  }, [])

  const handleCenterDragLeave = useCallback(() => {
    setDragOverCenter(false)
  }, [])

  const handleSlotDrop = useCallback(
    (e: React.DragEvent, targetSlotIndex: number) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOverSlotIndex(null)
      setDragOverCenter(false)

      if (!draggedData) return

      if (draggedData.type === 'booked') {
        const bookedStay = bookedStays.find((s) => s.id === draggedData.stayId)
        if (!bookedStay) return
        if (slotStayMap.has(targetSlotIndex)) {
          toast.error('Chuồng đang có lưu trú, không thể check-in vào ô này')
          setDraggedData(null)
          return
        }

        setSelectedSlot(targetSlotIndex)
        setSelectedStay(bookedStay)
        setIsCheckInDialogOpen(true)
      } else if (draggedData.type === 'slot') {
        // Move an existing stay to a new slot
        const sourceStay = boardingStays.find(s => s.slotIndex === draggedData.slotIndex)
        if (sourceStay && !slotStayMap.has(targetSlotIndex)) {
          updateStayMutation.mutate({ id: sourceStay.id, data: { slotIndex: targetSlotIndex } })
        } else if (sourceStay) {
          toast.error('Chuồng đang có lưu trú, không thể chuyển vào ô này')
        }
      }

      setDraggedData(null)
    },
    [draggedData, bookedStays, boardingStays, slotStayMap, updateStayMutation],
  )

  const handleSlotClick = useCallback(
    (slotIndex: number) => {
      setSelectedSlot(slotIndex)
      const stay = slotStayMap.get(slotIndex)
      if (stay) {
        setSelectedStay(stay)
        setIsStayDetailsOpen(true)
        // CheckIn dialog removed, wait for user to select a pet or create new order in POS
      }
    },
    [slotStayMap],
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
                setSelectedSlot(null)
                setSelectedStay(stay)
                setIsStayDetailsOpen(true)
              }}
              variant="booked"
            />
          ))}
          {bookedStays.length === 0 && (
            <p className="py-8 text-center text-[10px] text-foreground-muted/50">Không có đặt lịch nào</p>
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
          // Dropping booked stay anywhere in center — pick first empty slot
          if (draggedData?.type === 'booked') {
            const emptySlot = SLOTS.find((i) => !slotStayMap.has(i))
            if (emptySlot !== undefined) {
              setSelectedSlot(emptySlot)
              const bookedStay = bookedStays.find((s) => s.id === draggedData.stayId)
              if (bookedStay) setSelectedStay(bookedStay)
              setIsCheckInDialogOpen(true)
            } else {
              toast.error('Không còn chuồng trống để check-in')
            }
          }
          setDraggedData(null)
        }}
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
            Trông giữ
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-foreground-muted">
              {boardingStays.length}/{SLOTS.length}
            </span>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto w-full max-w-full">
          {/* Responsive grid up to 10 cols for largest screens to accomplish '10x5' */}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 2xl:grid-cols-10 gap-2">
            {SLOTS.map((slotIndex) => {
              const stay = slotStayMap.get(slotIndex)
              const isDragTarget = dragOverSlotIndex === slotIndex && draggedData?.type === 'slot' && draggedData.slotIndex !== slotIndex
              const isDragging = draggedData?.type === 'slot' && draggedData.slotIndex === slotIndex

              return (
                <CageCell
                  key={slotIndex}
                  slotIndex={slotIndex}
                  stay={stay}
                  onDragStart={handleDragStart}
                  onDragOver={(e) => handleSlotDragOver(e, slotIndex)}
                  onDragLeave={handleSlotDragLeave}
                  onDrop={(e) => handleSlotDrop(e, slotIndex)}
                  isDragTarget={isDragTarget}
                  isDragging={isDragging}
                  onClick={() => handleSlotClick(slotIndex)}
                />
              )
            })}
          </div>
        </div>
      </main>

      {/* ===== RIGHT PANEL: ĐÃ TRẢ HÔM NAY ===== */}
      <aside
        className="flex w-36 shrink-0 flex-col rounded-2xl border border-emerald-500/20 bg-emerald-500/10"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDrop={(e) => {
          e.preventDefault()
          if (draggedData?.type === 'slot') {
            const stay = boardingStays.find(s => s.slotIndex === draggedData.slotIndex)
            if (stay) {
              setSelectedStay(stay)
              setIsStayDetailsOpen(true)
            }
          }
        }}
      >
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
      <StayDetailsDialog
        stay={selectedStay}
        actionSlotIndex={selectedSlot}
        isOpen={isStayDetailsOpen}
        onClose={() => {
          setIsStayDetailsOpen(false)
          setSelectedSlot(null)
          setSelectedStay(null)
        }}
      />
      <CheckInDialog
        slotIndex={selectedSlot}
        bookedStay={selectedStay?.status === 'BOOKED' ? selectedStay : null}
        isOpen={isCheckInDialogOpen}
        onClose={() => {
          setIsCheckInDialogOpen(false)
          setSelectedSlot(null)
          setSelectedStay(null)
        }}
      />
    </div>
  )
}
