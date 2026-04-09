'use client'

import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useAuthorization } from '@/hooks/useAuthorization'
import { hotelApi, Cage } from '@/lib/api/hotel.api'

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

  // Lấy danh sách stays để tìm stay hiện tại của chuồng này.
  const { data: stays, isLoading } = useQuery({
    queryKey: ['stays'],
    queryFn: hotelApi.getStays,
    enabled: isOpen && !!cage && cage.status === 'OCCUPIED',
  })

  const currentStay = stays?.find(
    (stay) => stay.cageId === cage?.id && stay.status === 'CHECKED_IN',
  )

  const checkOutMutation = useMutation({
    mutationFn: (stayId: string) =>
      hotelApi.updateStay(stayId, {
        status: 'CHECKED_OUT',
        checkOut: new Date().toISOString(),
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
            <p className="text-center text-gray-500">Đang tải chi tiết lưu trú...</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-6 shadow-lg duration-200 sm:rounded-lg">
          <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
            Chi tiết lưu trú - {cage?.name}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500">
            Thông tin thú cưng đang gửi tại chuồng này.
          </Dialog.Description>

          {!currentStay ? (
            <div className="rounded-lg bg-amber-50 py-6 text-center text-amber-600">
              Không tìm thấy dữ liệu lưu trú. Có thể đã xảy ra lỗi đồng bộ.
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-gray-500">Mã lưu trú:</span>
                  <span className="font-semibold text-gray-900">
                    {currentStay.stayCode || '---'}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-gray-500">Thú cưng:</span>
                  <span className="font-semibold text-gray-900">
                    {currentStay.petName || currentStay.pet?.name || '---'}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-gray-500">Gói dịch vụ:</span>
                  <span className="font-semibold text-gray-900">
                    {currentStay.lineType === 'HOLIDAY'
                      ? 'Gói Lễ/Tết'
                      : 'Gói Thường'}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-gray-500">Check-in lúc:</span>
                  <span className="font-semibold text-gray-900">
                    {format(new Date(currentStay.checkIn), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <span className="mb-1 block text-gray-500">Dự kiến trả:</span>
                  <span className="font-semibold text-gray-900">
                    {currentStay.estimatedCheckOut
                      ? format(
                          new Date(currentStay.estimatedCheckOut),
                          'dd/MM/yyyy',
                        )
                      : '---'}
                  </span>
                </div>
              </div>

              {currentStay.notes && (
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-blue-700">
                    Ghi chú
                  </span>
                  <p className="text-sm text-blue-900">{currentStay.notes}</p>
                </div>
              )}

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
                        {(currentStay.order.remainingAmount ?? 0).toLocaleString(
                          'vi-VN',
                        )}
                        đ
                      </p>
                    </div>
                    <Link
                      href={`/orders/${currentStay.order.id}`}
                      className="inline-flex items-center rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Mở đơn
                    </Link>
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
                  onClick={() => checkOutMutation.mutate(currentStay.id)}
                  disabled={!canCheckout || checkOutMutation.isPending}
                  className="flex min-w-[120px] items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  {checkOutMutation.isPending
                    ? 'Đang xử lý...'
                    : 'Check-out ngay'}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
