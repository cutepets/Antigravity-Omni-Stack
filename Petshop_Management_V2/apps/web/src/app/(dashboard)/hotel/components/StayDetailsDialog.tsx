'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hotelApi, Cage } from '@/lib/api/hotel.api'
import { format } from 'date-fns'

interface StayDetailsDialogProps {
  cage: Cage | null
  isOpen: boolean
  onClose: () => void
}

export default function StayDetailsDialog({ cage, isOpen, onClose }: StayDetailsDialogProps) {
  const queryClient = useQueryClient()

  // Lấy danh sách stays để tìm stay hiện tại của chuồng này
  const { data: stays, isLoading } = useQuery({
    queryKey: ['stays'],
    queryFn: hotelApi.getStays,
    enabled: isOpen && !!cage && cage.status === 'OCCUPIED'
  })

  const currentStay = stays?.find(s => s.cageId === cage?.id && s.status === 'OCCUPIED')

  const checkOutMutation = useMutation({
    mutationFn: (stayId: string) => hotelApi.updateStay(stayId, { status: 'COMPLETED', checkOut: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cages'] })
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      onClose()
    },
  })

  // Nếu loading
  if (isLoading) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] p-6 bg-white rounded-lg shadow-lg">
            <p className="text-center text-gray-500">Đang tải chi tiết lưu trú...</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-6 shadow-lg duration-200 sm:rounded-lg">
          
          <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
            Chi tiết lưu trú - {cage?.name}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500">
            Thông tin thú cưng đang gửi tại chuồng này.
          </Dialog.Description>

          {!currentStay ? (
            <div className="py-6 text-center text-amber-600 bg-amber-50 rounded-lg">
              Không tìm thấy dữ liệu lưu trú. Có thể đã xảy ra lỗi đồng bộ.
            </div>
          ) : (
            <div className="py-2 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded-md">
                  <span className="text-gray-500 block mb-1">Thú cưng:</span>
                  <span className="font-semibold text-gray-900">{currentStay.petName || currentStay.pet?.name || '---'}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <span className="text-gray-500 block mb-1">Gói dịch vụ:</span>
                  <span className="font-semibold text-gray-900">{currentStay.lineType === 'HOLIDAY' ? 'Gói Lễ/Tết' : 'Gói Thường'}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <span className="text-gray-500 block mb-1">Check-in lúc:</span>
                  <span className="font-semibold text-gray-900">{format(new Date(currentStay.checkIn), 'dd/MM/yyyy HH:mm')}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <span className="text-gray-500 block mb-1">Dự kiến trả:</span>
                  <span className="font-semibold text-gray-900">
                    {currentStay.estimatedCheckOut ? format(new Date(currentStay.estimatedCheckOut), 'dd/MM/yyyy') : '---'}
                  </span>
                </div>
              </div>

              {currentStay.notes && (
                <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                  <span className="text-blue-700 text-xs font-bold uppercase tracking-wider block mb-1">Ghi chú</span>
                  <p className="text-sm text-blue-900">{currentStay.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => checkOutMutation.mutate(currentStay.id)}
                  disabled={checkOutMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 rounded-md text-sm font-medium text-white hover:bg-emerald-700 transition flex items-center justify-center min-w-[120px]"
                >
                  {checkOutMutation.isPending ? 'Đang xử lý...' : 'Check-out ngay'}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
