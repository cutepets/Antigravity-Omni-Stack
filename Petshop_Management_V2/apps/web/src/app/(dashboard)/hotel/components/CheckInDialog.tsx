'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { hotelApi, Cage } from '@/lib/api/hotel.api'
import { format } from 'date-fns'

interface CheckInDialogProps {
  cage: Cage | null
  isOpen: boolean
  onClose: () => void
}

export default function CheckInDialog({ cage, isOpen, onClose }: CheckInDialogProps) {
  const queryClient = useQueryClient()
  
  const [petName, setPetName] = useState('')
  const [petId, setPetId] = useState('TEMP_ID') // Usually from a selector
  const [lineType, setLineType] = useState<Cage['type']>('REGULAR')
  const [notes, setNotes] = useState('')
  const [estCheckOut, setEstCheckOut] = useState('')

  const checkInMutation = useMutation({
    mutationFn: hotelApi.createStay,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cages'] })
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      onClose()
      // reset specific state if needed
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cage) return

    checkInMutation.mutate({
      cageId: cage.id,
      petId,
      petName,
      lineType,
      checkIn: new Date().toISOString(),
      estimatedCheckOut: estCheckOut ? new Date(estCheckOut).toISOString() : undefined,
      notes,
    })
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-6 shadow-lg duration-200 sm:rounded-lg">
          <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
            Check-in cho lồng: {cage?.name}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500">
            Điền thông tin thú cưng để bắt đầu gửi tại khách sạn.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="py-4 space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">Tên thú cưng</label>
              <input
                required
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder="Ví dụ: Milu"
                className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">Loại gói lưu trú</label>
              <select
                value={lineType}
                onChange={(e) => setLineType(e.target.value as Cage['type'])}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="REGULAR">Gói Thường</option>
                <option value="HOLIDAY">Gói Lễ/Tết</option>
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">Ngày dự kiến trả (Tùy chọn)</label>
              <input
                type="date"
                value={estCheckOut}
                onChange={(e) => setEstCheckOut(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">Ghi chú thêm</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ví dụ: Ăn hạt nhỏ, sợ tiếng ồn..."
                rows={3}
                className="flex w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={checkInMutation.isPending}
                className="px-4 py-2 bg-indigo-600 rounded-md text-sm font-medium text-white hover:bg-indigo-700 transition flex items-center justify-center min-w-[120px]"
              >
                {checkInMutation.isPending ? 'Đang xử lý...' : 'Xác nhận Check-in'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
