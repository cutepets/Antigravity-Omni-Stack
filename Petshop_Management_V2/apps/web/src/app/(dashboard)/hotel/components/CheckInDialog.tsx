'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthorization } from '@/hooks/useAuthorization'
import { hotelApi, Cage, HotelStay } from '@/lib/api/hotel.api'
import { format } from 'date-fns'

interface CheckInDialogProps {
  slotIndex?: number | null
  bookedStay?: HotelStay | null
  isOpen: boolean
  onClose: () => void
}

export default function CheckInDialog({ slotIndex, bookedStay, isOpen, onClose }: CheckInDialogProps) {
  const queryClient = useQueryClient()
  const { hasAnyPermission } = useAuthorization()

  const [petName, setPetName] = useState('')
  const petId = bookedStay?.petId || 'TEMP_ID'
  const [lineType, setLineType] = useState<Cage['type']>('REGULAR')
  const [notes, setNotes] = useState('')
  const [estCheckOut, setEstCheckOut] = useState('')
  const canCheckIn = hasAnyPermission(['hotel.create', 'hotel.checkin'])

  // Pre-fill from booked stay
  useEffect(() => {
    if (bookedStay) {
      setPetName(bookedStay.petName || '')
      setLineType(bookedStay.lineType || 'REGULAR')
      setNotes(bookedStay.notes || '')
      if (bookedStay.estimatedCheckOut) {
        setEstCheckOut(format(new Date(bookedStay.estimatedCheckOut), 'yyyy-MM-dd'))
      }
    } else {
      setPetName('')
      setLineType('REGULAR')
      setNotes('')
      setEstCheckOut('')
    }
  }, [bookedStay, isOpen])

  const checkInMutation = useMutation({
    mutationFn: (data: any) =>
      bookedStay
        ? hotelApi.updateStay(bookedStay.id, { status: 'CHECKED_IN', slotIndex: data.slotIndex, notes: data.notes, estimatedCheckOut: data.estimatedCheckOut })
        : hotelApi.createStay(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cages'] })
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      // Reset form state
      setNotes('')
      setEstCheckOut('')
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCheckIn) return

    checkInMutation.mutate({
      slotIndex: slotIndex ?? null,
      petId,
      petName: bookedStay?.petName || '',
      lineType: 'REGULAR',
      checkIn: new Date().toISOString(),
      estimatedCheckOut: estCheckOut ? new Date(estCheckOut).toISOString() : undefined,
      notes,
    })
  }

  if (!isOpen || !canCheckIn) return null

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 app-modal-overlay z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background-base p-6 shadow-lg duration-200 sm:rounded-lg"
        >
          <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
            Xác nhận Check-in
          </Dialog.Title>
          <Dialog.Description className="text-sm text-foreground-muted">
            Điền thông tin thú cưng để bắt đầu gửi tại khách sạn.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="py-4 space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none text-foreground">Tên thú cưng</label>
              <div className="flex h-10 w-full items-center rounded-md border border-border bg-background-secondary px-3 py-2 text-sm text-foreground-muted">
                {bookedStay?.petName || 'Chưa chọn'}
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none text-foreground">Ngày dự kiến trả (Tùy chọn)</label>
              <input
                type="date"
                value={estCheckOut}
                disabled={!canCheckIn}
                onChange={(e) => setEstCheckOut(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none text-foreground">Ghi chú thêm</label>
              <textarea
                value={notes}
                disabled={!canCheckIn}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ví dụ: Ăn hạt nhỏ, sợ tiếng ồn..."
                rows={3}
                className="flex w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-background-secondary transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!canCheckIn || checkInMutation.isPending}
                className="px-4 py-2 bg-primary-500 rounded-md text-sm font-medium text-white hover:opacity-90 transition flex items-center justify-center min-w-[120px] disabled:cursor-not-allowed disabled:opacity-50"
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
