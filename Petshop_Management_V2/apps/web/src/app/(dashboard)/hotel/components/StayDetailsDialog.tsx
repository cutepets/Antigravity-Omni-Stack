'use client'

import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Tag, UserRound } from 'lucide-react'
import { useAuthorization } from '@/hooks/useAuthorization'
import { hotelApi, Cage, HotelStay } from '@/lib/api/hotel.api'
import { formatCurrency, formatDateTime } from '@/lib/utils'

function buildHistorySummary(entry: any) {
  const actorName =
    entry.performedByUser?.fullName ?? entry.performedByUser?.staffCode ?? 'Chưa xác định'
  const statusLabel =
    entry.fromStatus || entry.toStatus
      ? [
        entry.fromStatus ? entry.fromStatus : null,
        entry.toStatus ? `→ ${entry.toStatus}` : null,
      ]
        .filter(Boolean)
        .join(' ')
      : null

  return [actorName, statusLabel, entry.note].filter(Boolean).join(' • ')
}

function HistorySection({ timeline }: { timeline: any[] }) {
  return (
    <div className="py-2">
      <div className="rounded-2xl border border-border/60 bg-background-secondary/30 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
            Lịch sử thao tác
          </div>
        </div>

        {timeline && timeline.length > 0 ? (
          <div className="mt-4 space-y-4">
            {timeline.map((entry: any, index: number) => (
              <div key={entry.id} className="grid grid-cols-[16px_1fr] gap-4">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary-500 ring-4 ring-primary-500/10" />
                  {index < timeline.length - 1 ? <span className="mt-2 h-full w-px bg-border/60" /> : null}
                </div>
                <div className="rounded-xl border border-border/40 bg-background-base px-3.5 py-3 transition-colors duration-150 hover:bg-primary-500/4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-semibold text-primary-400">
                      {entry.action}
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-[11px] text-foreground-muted">
                      {formatDateTime(entry.createdAt)}
                    </div>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-foreground-muted">
                    {buildHistorySummary(entry) || 'Không có thêm thông tin'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-foreground-muted">
            Chưa có lịch sử thao tác cho lưu trú này.
          </div>
        )}
      </div>
    </div>
  )
}


interface ChargeLine {
  id?: string
  label?: string
  quantityDays?: number
  unitPrice?: number
  subtotal?: number
}

interface BreakdownSnapshot {
  chargeLines?: ChargeLine[]
  totalDays?: number
}

const getBreakdownChargeLines = (stay: { chargeLines?: ChargeLine[]; breakdownSnapshot?: BreakdownSnapshot | null }): ChargeLine[] => {
  if (Array.isArray(stay?.chargeLines) && stay.chargeLines.length > 0) {
    return stay.chargeLines
  }
  const snapshot = stay?.breakdownSnapshot
  return Array.isArray(snapshot?.chargeLines) ? snapshot.chargeLines : []
}

const getSnapshotNumber = (source: BreakdownSnapshot | null | undefined, key: keyof BreakdownSnapshot): number | null => {
  if (!source) return null
  const value = source[key]
  return typeof value === 'number' ? value : null
}

interface StayDetailsDialogProps {
  stay?: HotelStay | null
  actionSlotIndex?: number | null
  isOpen: boolean
  onClose: () => void
}

export default function StayDetailsDialog({
  stay: currentStay,
  actionSlotIndex,
  isOpen,
  onClose,
}: StayDetailsDialogProps) {
  const queryClient = useQueryClient()
  const { hasPermission, hasAnyPermission } = useAuthorization()
  const canCheckout = hasPermission('hotel.checkout')
  const canCheckIn = hasAnyPermission(['hotel.create', 'hotel.checkin'])
  const canReadOrders = hasAnyPermission(['order.read.all', 'order.read.assigned'])

  const { data: staysResponse, isLoading } = useQuery({
    queryKey: ['stays'],
    queryFn: () => hotelApi.getStayList(),
    enabled: false, // We no longer fetch based on slot index for this dialog
  })

  const checkoutMutation = useMutation({
    mutationFn: (stayId: string) =>
      hotelApi.checkoutStay(stayId, {
        checkOutActual: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cages'] })
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      onClose()
    },
  })

  const checkinMutation = useMutation({
    mutationFn: (stayId: string) =>
      hotelApi.updateStay(stayId, {
        status: 'CHECKED_IN',
        slotIndex: actionSlotIndex ?? currentStay?.slotIndex ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cages'] })
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      onClose()
    },
  })

  if (isLoading) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-lg bg-background-base p-6 shadow-lg">
            <p className="text-center text-foreground-muted">Đang tải chi tiết lưu trú...</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  const chargeLines = currentStay ? getBreakdownChargeLines(currentStay) : []
  const snapshotTotalDays = currentStay
    ? getSnapshotNumber(currentStay.breakdownSnapshot as BreakdownSnapshot | null, 'totalDays')
    : null
  const totalDays =
    snapshotTotalDays ??
    chargeLines.reduce((sum: number, line: ChargeLine) => sum + Number(line.quantityDays ?? 0), 0)
  const serviceLabel =
    chargeLines.length > 1
      ? 'Hotel (ngày thường + ngày lễ)'
      : currentStay?.lineType === 'HOLIDAY'
        ? 'Hotel ngày lễ'
        : 'Hotel ngày thường'

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border border-border bg-background-base p-6 shadow-lg duration-200 sm:rounded-lg">
          <Tabs.Root defaultValue="info" className="flex flex-col h-full">
            <div className="flex items-center justify-between">
              <div>
                <Dialog.Title className="text-lg font-semibold leading-none tracking-tight text-foreground">
                  Chi tiết lưu trú
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  Thông tin lưu trú, bảng tính giá và liên kết POS của thú cưng.
                </Dialog.Description>
              </div>
              <Tabs.List className="flex items-center gap-1 rounded-xl bg-background-secondary/50 p-1">
                <Tabs.Trigger
                  value="info"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground-muted transition-all duration-150 hover:text-foreground data-[state=active]:bg-background-base data-[state=active]:text-primary-600 data-[state=active]:shadow-sm outline-none"
                >
                  Thông tin
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="history"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground-muted transition-all duration-150 hover:text-foreground data-[state=active]:bg-background-base data-[state=active]:text-primary-600 data-[state=active]:shadow-sm outline-none"
                >
                  Lịch sử
                </Tabs.Trigger>
              </Tabs.List>
            </div>

            <Tabs.Content value="info" className="mt-4 outline-none">
              {!currentStay ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center">
                  <span className="mb-2 text-3xl">⚠️</span>
                  <p className="text-sm font-medium text-foreground">Không tìm thấy dữ liệu</p>
                  <p className="text-xs text-foreground-muted">Có thể đã xảy ra lỗi đồng bộ.</p>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="grid gap-3 sm:grid-cols-2 mb-4">
                    <div className="rounded-2xl border border-border bg-card/80 p-4 relative group">
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                        <span className="flex items-center gap-2"><UserRound size={14} /> Khách hàng</span>
                        {(currentStay.customerId || currentStay.pet?.customer?.id) && (
                          <Link href={`/customers/${currentStay.customerId || currentStay.pet?.customer?.id}`} target="_blank" className="hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            Chi tiết
                          </Link>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {currentStay.customer?.fullName || currentStay.pet?.customer?.fullName || "Khách lẻ (Khách vãng lai)"}
                      </p>
                      <p className="mt-1 text-sm text-foreground-muted">
                        {currentStay.customer?.phone || currentStay.pet?.customer?.phone || "Không có SĐT"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-card/80 p-4 relative group">
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                        <span className="flex items-center gap-2"><Tag size={14} /> Thú cưng</span>
                        {currentStay.petId && (
                          <Link href={`/pets/${currentStay.petId}`} target="_blank" className="hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            Chi tiết
                          </Link>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {currentStay.petName || currentStay.pet?.name || '---'}
                      </p>
                      <div className="mt-1 flex flex-col gap-1">
                        <p className="text-xs text-foreground-muted">
                          Mã: <span className="font-medium text-foreground">{currentStay.pet?.petCode || currentStay.pet?.id || currentStay.petId || '---'}</span>
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-foreground-muted">
                            Lưu lúc: {formatDateTime(currentStay.createdAt)}
                          </p>
                          {currentStay.branch && (
                            <p className="text-xs text-foreground-muted">
                              CN: <span className="font-medium text-foreground">{currentStay.branch.name}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border border-border bg-background-secondary px-3 py-2">
                      <span className="mb-1 block text-xs font-medium text-foreground-muted">Mã lưu trú</span>
                      <span className="text-sm font-medium text-foreground">
                        {currentStay.stayCode || '---'}
                      </span>
                    </div>
                    <div className="rounded-md border border-border bg-background-secondary px-3 py-2">
                      <span className="mb-1 block text-xs font-medium text-foreground-muted">Dự kiến trả</span>
                      <span className="text-sm font-medium text-foreground">
                        {currentStay.estimatedCheckOut
                          ? format(
                            new Date(currentStay.estimatedCheckOut),
                            'dd/MM/yyyy HH:mm',
                          )
                          : '---'}
                      </span>
                    </div>
                    <div className="rounded-md border border-border bg-background-secondary px-3 py-2">
                      <span className="mb-1 block text-xs font-medium text-foreground-muted">Dịch vụ</span>
                      <span className="text-sm font-medium text-foreground">{serviceLabel}</span>
                    </div>
                    <div className="rounded-md border border-border bg-background-secondary px-3 py-2">
                      <span className="mb-1 block text-xs font-medium text-foreground-muted">Hạng cân</span>
                      <span className="text-sm font-medium text-foreground">
                        {currentStay.weightBand?.label || 'Chưa xác định'}
                      </span>
                    </div>
                    <div className="rounded-md border border-border bg-background-secondary px-3 py-2">
                      <span className="mb-1 block text-xs font-medium text-foreground-muted">Check-in lúc</span>
                      <span className="text-sm font-medium text-foreground">
                        {currentStay.checkIn ? format(new Date(currentStay.checkIn), 'dd/MM/yyyy HH:mm') : '---'}
                      </span>
                    </div>
                    {currentStay.checkOutActual && (
                      <div className="rounded-md border border-border bg-background-secondary px-3 py-2">
                        <span className="mb-1 block text-xs font-medium text-foreground-muted">Check-out lúc</span>
                        <span className="text-sm font-medium text-foreground">
                          {format(new Date(currentStay.checkOutActual), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                    )}
                  </div>

                  {chargeLines.length > 0 ? (
                    <div className="rounded-md border border-border bg-background-secondary p-4">
                      <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
                        <p className="text-sm font-medium text-foreground-muted">
                          Tổng ngày tính tiền: {totalDays}
                        </p>
                        <p className="text-sm font-medium text-foreground-muted">Tạm tính hiện tại</p>
                      </div>

                      <div className="space-y-3">
                        {chargeLines.map((line: ChargeLine, index: number) => (
                          <div
                            key={`${line.id ?? line.label}-${index}`}
                            className="flex items-center justify-between"
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {String(line.label ?? 'Hotel')}
                              </p>
                              <p className="text-xs text-foreground-muted">
                                {Number(line.quantityDays ?? 0)} ngày x{' '}
                                {formatCurrency(Number(line.unitPrice ?? 0))}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-foreground">
                              {formatCurrency(Number(line.subtotal ?? 0))}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {(currentStay.surcharge || currentStay.promotion || currentStay.depositAmount) ? (
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded-md border border-border bg-background-secondary p-3">
                        <span className="block text-xs font-medium text-foreground-muted mb-1">Phụ thu</span>
                        <span className="text-sm font-medium text-foreground">
                          {formatCurrency(currentStay.surcharge ?? 0)}
                        </span>
                      </div>
                      <div className="rounded-md border border-border bg-background-secondary p-3">
                        <span className="block text-xs font-medium text-foreground-muted mb-1">Khuyến mãi</span>
                        <span className="text-sm font-medium text-foreground">
                          {formatCurrency(currentStay.promotion ?? 0)}
                        </span>
                      </div>
                      <div className="rounded-md border border-border bg-background-secondary p-3">
                        <span className="block text-xs font-medium text-foreground-muted mb-1">Đặt cọc</span>
                        <span className="text-sm font-medium text-foreground">
                          {formatCurrency(currentStay.depositAmount ?? 0)}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {currentStay.notes ? (
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-blue-700">
                        Ghi chú
                      </span>
                      <p className="text-sm text-blue-900">{currentStay.notes}</p>
                    </div>
                  ) : null}

                  {currentStay.order ? (
                    <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3">
                      <span className="block text-xs font-bold uppercase tracking-wider text-emerald-700">
                        Liên kết POS
                      </span>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">
                            {currentStay.order.orderNumber}
                          </p>
                          <p className="text-xs text-emerald-700">
                            Còn phải thu:{' '}
                            {formatCurrency(currentStay.order.remainingAmount ?? 0)}
                          </p>
                        </div>
                        {canReadOrders ? (
                          <Link
                            href={`/orders/${currentStay.order.id}`}
                            className="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                          >
                            Mở đơn
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-3 pt-4 sm:pt-6">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-background-secondary transition"
                    >
                      Đóng
                    </button>
                    {currentStay.status === 'BOOKED' ? (
                      <button
                        type="button"
                        onClick={() => checkinMutation.mutate(currentStay.id)}
                        disabled={!canCheckIn || checkinMutation.isPending}
                        className="flex min-w-[140px] items-center justify-center rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {checkinMutation.isPending ? 'Đang xử lý...' : 'Check-in ngay'}
                      </button>
                    ) : currentStay.status === 'CHECKED_IN' ? (
                      <button
                        type="button"
                        onClick={() => checkoutMutation.mutate(currentStay.id)}
                        disabled={!canCheckout || checkoutMutation.isPending}
                        className="flex min-w-[140px] items-center justify-center rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {checkoutMutation.isPending ? 'Đang xử lý...' : 'Checkout ngay'}
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </Tabs.Content>

            {currentStay ? (
              <Tabs.Content value="history" className="mt-4 outline-none">
                <HistorySection timeline={(currentStay as any).timeline || []} />
              </Tabs.Content>
            ) : null}
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
