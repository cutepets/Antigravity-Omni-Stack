'use client'

import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useAuthorization } from '@/hooks/useAuthorization'
import { hotelApi, Cage, HotelStay } from '@/lib/api/hotel.api'
import { formatCurrency } from '@/lib/utils'

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
  cage: Cage | null
  stay?: HotelStay | null
  isOpen: boolean
  onClose: () => void
}

export default function StayDetailsDialog({
  cage,
  stay,
  isOpen,
  onClose,
}: StayDetailsDialogProps) {
  const queryClient = useQueryClient()
  const { hasPermission, hasAnyPermission } = useAuthorization()
  const canCheckout = hasPermission('hotel.checkout')
  const canReadOrders = hasAnyPermission(['order.read.all', 'order.read.assigned'])

  const { data: staysResponse, isLoading } = useQuery({
    queryKey: ['stays'],
    queryFn: () => hotelApi.getStayList(),
    enabled: isOpen && !!cage && cage.status === 'OCCUPIED' && !stay,
  })

  const staysArray = Array.isArray(staysResponse) ? staysResponse : (staysResponse?.items || [])

  const currentStay = stay ?? staysArray.find(
    (s) => s.cageId === cage?.id && s.status === 'CHECKED_IN',
  )

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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid max-h-[90vh] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-background-base p-6 shadow-lg duration-200 sm:rounded-lg">
          <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
            Chi tiết lưu trú – {cage?.name}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-foreground-muted">
            Thông tin lưu trú, bảng tính giá và liên kết POS của chuồng này.
          </Dialog.Description>

          {!currentStay ? (
            <div className="rounded-lg bg-amber-50 py-6 text-center text-amber-600">
              Không tìm thấy dữ liệu lưu trú. Có thể đã xảy ra lỗi đồng bộ.
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-foreground-muted">Mã lưu trú:</span>
                  <span className="font-semibold text-gray-900">
                    {currentStay.stayCode || '---'}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-foreground-muted">Thú cưng:</span>
                  <span className="font-semibold text-gray-900">
                    {currentStay.petName || currentStay.pet?.name || '---'}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-foreground-muted">Dịch vụ:</span>
                  <span className="font-semibold text-gray-900">{serviceLabel}</span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-foreground-muted">Hạng cân:</span>
                  <span className="font-semibold text-gray-900">
                    {currentStay.weightBand?.label || 'Chua xac dinh'}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-foreground-muted">Check-in lúc:</span>
                  <span className="font-semibold text-gray-900">
                    {format(new Date(currentStay.checkIn), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-foreground-muted">Dự kiến trả:</span>
                  <span className="font-semibold text-gray-900">
                    {currentStay.estimatedCheckOut
                      ? format(
                        new Date(currentStay.estimatedCheckOut),
                        'dd/MM/yyyy HH:mm',
                      )
                      : '---'}
                  </span>
                </div>
              </div>

              {chargeLines.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Chi tiết tính giá
                      </p>
                      <p className="text-xs text-foreground-muted">
                        Tổng ngày tính tiền: {totalDays}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-foreground-muted">Tạm tính hiện tại</p>
                      <p className="text-lg font-bold text-foreground">
                        {formatCurrency(currentStay.totalPrice)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {chargeLines.map((line: ChargeLine, index: number) => (
                      <div
                        key={`${line.id ?? line.label}-${index}`}
                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {String(line.label ?? 'Hotel')}
                          </p>
                          <p className="text-xs text-slate-500">
                            {Number(line.quantityDays ?? 0)} ngay x{' '}
                            {formatCurrency(Number(line.unitPrice ?? 0))}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(Number(line.subtotal ?? 0))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {(currentStay.surcharge || currentStay.promotion || currentStay.depositAmount) ? (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md border border-gray-200 p-3">
                    <span className="mb-1 block text-foreground-muted">Phụ thu</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(currentStay.surcharge ?? 0)}
                    </span>
                  </div>
                  <div className="rounded-md border border-gray-200 p-3">
                    <span className="mb-1 block text-foreground-muted">Khuyến mãi</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(currentStay.promotion ?? 0)}
                    </span>
                  </div>
                  <div className="rounded-md border border-gray-200 p-3">
                    <span className="mb-1 block text-foreground-muted">Đặt cọc</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(currentStay.depositAmount ?? 0)}
                    </span>
                  </div>
                </div>
              ) : null}

              {currentStay.notes ? (
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-blue-700">
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
                        className="inline-flex items-center rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                      >
                        Mở đơn
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => checkoutMutation.mutate(currentStay.id)}
                  disabled={!canCheckout || checkoutMutation.isPending}
                  className="flex min-w-[120px] items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutMutation.isPending ? 'Đang xử lý...' : 'Checkout ngay'}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
