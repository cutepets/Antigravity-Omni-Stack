'use client'

import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useAuthorization } from '@/hooks/useAuthorization'
import { hotelApi, Cage } from '@/lib/api/hotel.api'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value) + 'd'

const getBreakdownChargeLines = (stay: any) => {
  if (Array.isArray(stay?.chargeLines) && stay.chargeLines.length > 0) {
    return stay.chargeLines
  }

  const snapshot = stay?.breakdownSnapshot as
    | { chargeLines?: Array<Record<string, unknown>> }
    | null
    | undefined

  return Array.isArray(snapshot?.chargeLines) ? snapshot.chargeLines : []
}

const getSnapshotNumber = (source: unknown, key: string) => {
  if (!source || typeof source !== 'object') return null
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : null
}

interface StayDetailsDialogProps {
  cage: Cage | null
  isOpen: boolean
  onClose: () => void
}

export default function StayDetailsDialog({
  cage,
  isOpen,
  onClose,
}: StayDetailsDialogProps) {
  const queryClient = useQueryClient()
  const { hasPermission, hasAnyPermission } = useAuthorization()
  const canCheckout = hasPermission('hotel.checkout')
  const canReadOrders = hasAnyPermission(['order.read.all', 'order.read.assigned'])

  const { data: stays, isLoading } = useQuery({
    queryKey: ['stays'],
    queryFn: hotelApi.getStays,
    enabled: isOpen && !!cage && cage.status === 'OCCUPIED',
  })

  const currentStay = stays?.find(
    (stay) => stay.cageId === cage?.id && stay.status === 'CHECKED_IN',
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
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white p-6 shadow-lg">
            <p className="text-center text-gray-500">Dang tai chi tiet luu tru...</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  const chargeLines = currentStay ? getBreakdownChargeLines(currentStay) : []
  const snapshotTotalDays = currentStay
    ? getSnapshotNumber(currentStay.breakdownSnapshot, 'totalDays')
    : null
  const totalDays =
    snapshotTotalDays ??
    chargeLines.reduce((sum: number, line: any) => sum + Number(line.quantityDays ?? 0), 0)
  const serviceLabel =
    chargeLines.length > 1
      ? 'Hotel tach dong ngay thuong va ngay le'
      : currentStay?.lineType === 'HOLIDAY'
        ? 'Hotel ngay le'
        : 'Hotel ngay thuong'

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid max-h-[90vh] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-white p-6 shadow-lg duration-200 sm:rounded-lg">
          <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
            Chi tiet luu tru - {cage?.name}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500">
            Thong tin stay, bang tinh gia va lien ket POS cua chuong nay.
          </Dialog.Description>

          {!currentStay ? (
            <div className="rounded-lg bg-amber-50 py-6 text-center text-amber-600">
              Khong tim thay du lieu luu tru. Co the da xay ra loi dong bo.
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-gray-500">Ma luu tru:</span>
                  <span className="font-semibold text-gray-900">
                    {currentStay.stayCode || '---'}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-gray-500">Thu cung:</span>
                  <span className="font-semibold text-gray-900">
                    {currentStay.petName || currentStay.pet?.name || '---'}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-gray-500">Dich vu:</span>
                  <span className="font-semibold text-gray-900">{serviceLabel}</span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-gray-500">Hang can:</span>
                  <span className="font-semibold text-gray-900">
                    {currentStay.weightBand?.label || 'Chua xac dinh'}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-gray-500">Check-in luc:</span>
                  <span className="font-semibold text-gray-900">
                    {format(new Date(currentStay.checkIn), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-gray-500">Du kien tra:</span>
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
                      <p className="text-sm font-semibold text-slate-900">
                        Breakdown hotel
                      </p>
                      <p className="text-xs text-slate-500">
                        Tong ngay tinh tien: {totalDays}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Tam tinh hien tai</p>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(currentStay.totalPrice)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {chargeLines.map((line: any, index: number) => (
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
                    <span className="mb-1 block text-gray-500">Phu thu</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(currentStay.surcharge ?? 0)}
                    </span>
                  </div>
                  <div className="rounded-md border border-gray-200 p-3">
                    <span className="mb-1 block text-gray-500">Khuyen mai</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(currentStay.promotion ?? 0)}
                    </span>
                  </div>
                  <div className="rounded-md border border-gray-200 p-3">
                    <span className="mb-1 block text-gray-500">Dat coc</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(currentStay.depositAmount ?? 0)}
                    </span>
                  </div>
                </div>
              ) : null}

              {currentStay.notes ? (
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-blue-700">
                    Ghi chu
                  </span>
                  <p className="text-sm text-blue-900">{currentStay.notes}</p>
                </div>
              ) : null}

              {currentStay.order ? (
                <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3">
                  <span className="block text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Lien ket POS
                  </span>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">
                        {currentStay.order.orderNumber}
                      </p>
                      <p className="text-xs text-emerald-700">
                        Con phai thu:{' '}
                        {(currentStay.order.remainingAmount ?? 0).toLocaleString('vi-VN')}d
                      </p>
                    </div>
                    {canReadOrders ? (
                      <Link
                        href={`/orders/${currentStay.order.id}`}
                        className="inline-flex items-center rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                      >
                        Mo don
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
                  Dong
                </button>
                <button
                  type="button"
                  onClick={() => checkoutMutation.mutate(currentStay.id)}
                  disabled={!canCheckout || checkoutMutation.isPending}
                  className="flex min-w-[120px] items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutMutation.isPending ? 'Dang xu ly...' : 'Checkout ngay'}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
