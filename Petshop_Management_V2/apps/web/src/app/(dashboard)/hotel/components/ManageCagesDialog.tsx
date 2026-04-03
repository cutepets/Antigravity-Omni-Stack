'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { hotelApi, Cage } from '@/lib/api/hotel.api'

interface ManageCagesDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function ManageCagesDialog({ isOpen, onClose }: ManageCagesDialogProps) {
  const queryClient = useQueryClient()
  
  const [name, setName] = useState('')
  const [lineType, setLineType] = useState<Cage['type']>('REGULAR')
  const [description, setDescription] = useState('')

  const createCageMutation = useMutation({
    mutationFn: hotelApi.createCage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cages'] })
      setName('')
      setDescription('')
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createCageMutation.mutate({
      name,
      type: lineType,
      description,
    })
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-6 shadow-lg duration-200 sm:rounded-lg">
          <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
            Thêm chuồng mới
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500">
            Khởi tạo một chuồng (lồng/phòng) mới để nuôi gửi thú cưng.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="py-4 space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">Tên chuồng (Số phòng)</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: P-01, V-02..."
                className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">Phân loại</label>
              <select
                value={lineType}
                onChange={(e) => setLineType(e.target.value as Cage['type'])}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="REGULAR">Chuồng Thường</option>
                <option value="HOLIDAY">Chuồng VIP - Lễ/Tết</option>
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">Mô tả (Tùy chọn)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kích thước, vị trí..."
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
                disabled={createCageMutation.isPending}
                className="px-4 py-2 bg-indigo-600 rounded-md text-sm font-medium text-white hover:bg-indigo-700 transition flex items-center justify-center min-w-[120px]"
              >
                {createCageMutation.isPending ? 'Đang tạo...' : 'Lưu thông tin'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
