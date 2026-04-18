'use client'

import { startTransition, type Dispatch, type SetStateAction } from 'react'
import { useMutation, type QueryClient } from '@tanstack/react-query'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import {
  orderApi,
  type CompleteOrderPayload,
  type CreateOrderPayload,
  type CreateReturnRequestPayload,
  type RefundOrderPayload,
  type UpdateOrderPayload,
} from '@/lib/api/order.api'
import { buildDraftFromOrder, buildOrderPayload } from './order.utils'
import type { OrderDraft } from './order.types'

type OrderWorkspaceRouter = {
  replace: (href: string) => void
  push: (href: string) => void
}

interface UseOrderWorkspaceMutationsParams {
  orderId?: string
  draft: OrderDraft
  router: OrderWorkspaceRouter
  queryClient: QueryClient
  initializedOrderVersionRef: { current: string | null }
  setDraft: Dispatch<SetStateAction<OrderDraft>>
  setIsEditing: Dispatch<SetStateAction<boolean>>
  setShowPayModal: Dispatch<SetStateAction<boolean>>
  setShowExportStockModal: Dispatch<SetStateAction<boolean>>
  setShowSettleModal: Dispatch<SetStateAction<boolean>>
  setShowRefundModal: Dispatch<SetStateAction<boolean>>
  setShowReturnModal: Dispatch<SetStateAction<boolean>>
}

export function useOrderWorkspaceMutations({
  orderId,
  draft,
  router,
  queryClient,
  initializedOrderVersionRef,
  setDraft,
  setIsEditing,
  setShowPayModal,
  setShowExportStockModal,
  setShowSettleModal,
  setShowRefundModal,
  setShowReturnModal,
}: UseOrderWorkspaceMutationsParams) {
  const invalidateOrderQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] })
    if (orderId) {
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      void queryClient.invalidateQueries({ queryKey: ['order-timeline', orderId] })
      void queryClient.invalidateQueries({ queryKey: ['order-payment-intents', orderId] })
    }
  }

  const createOrderMutation = useMutation({
    mutationFn: () => orderApi.create(buildOrderPayload(draft) as CreateOrderPayload),
    onSuccess: (createdOrder) => {
      toast.success('Đã tạo đơn hàng thành công')
      invalidateOrderQueries()
      startTransition(() => router.replace(`/orders/${createdOrder.id}`))
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể tạo đơn hàng'),
  })

  const updateOrderMutation = useMutation({
    mutationFn: () => orderApi.update(orderId!, buildOrderPayload(draft) as UpdateOrderPayload),
    onSuccess: (updatedOrder) => {
      toast.success('Đã cập nhật đơn hàng')
      invalidateOrderQueries()
      setDraft(buildDraftFromOrder(updatedOrder))
      setIsEditing(false)
      initializedOrderVersionRef.current = `${updatedOrder.id}:${updatedOrder.updatedAt ?? updatedOrder.createdAt ?? ''}`
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể cập nhật đơn hàng'),
  })

  const payOrderMutation = useMutation({
    mutationFn: (payload: { payments: Array<{ method: string; amount: number; paymentAccountId?: string; paymentAccountLabel?: string }> }) =>
      orderApi.pay(orderId!, payload),
    onSuccess: () => {
      toast.success('Đã ghi nhận thanh toán')
      setShowPayModal(false)
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể thanh toán đơn'),
  })

  const exportStockMutation = useMutation({
    mutationFn: (payload: { note?: string }) => orderApi.exportStock(orderId!, payload),
    onSuccess: () => {
      toast.success('Đã xuất kho đơn hàng')
      setShowExportStockModal(false)
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể xuất kho'),
  })

  const settleOrderMutation = useMutation({
    mutationFn: (payload: CompleteOrderPayload) => orderApi.complete(orderId!, payload),
    onSuccess: () => {
      toast.success('Đã quyết toán đơn hàng')
      setShowSettleModal(false)
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể quyết toán'),
  })

  const cancelOrderMutation = useMutation({
    mutationFn: () => orderApi.cancel(orderId!, { reason: 'Hủy từ Order Workspace' }),
    onSuccess: () => {
      toast.success('Đã hủy đơn hàng')
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể hủy đơn'),
  })

  const refundOrderMutation = useMutation({
    mutationFn: (payload: RefundOrderPayload) => orderApi.refund(orderId!, payload),
    onSuccess: () => {
      toast.success('Đã cập nhật trạng thái hoàn tiền')
      setShowRefundModal(false)
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể hoàn tiền đơn'),
  })

  const createReturnRequestMutation = useMutation({
    mutationFn: (payload: CreateReturnRequestPayload) => orderApi.createReturnRequest(orderId!, payload),
    onSuccess: (data: any) => {
      setShowReturnModal(false)
      invalidateOrderQueries()
      if (data?.exchangeOrderId) {
        toast.success(`Đã tạo đổi trả. Đơn đổi #${data.exchangeOrderNumber} đã sẵn sàng (credit: ${(data.totalCredit ?? 0).toLocaleString('vi-VN')}đ)`)
        router.push(`/orders/${data.exchangeOrderId}`)
      } else {
        const refundAmount = data?.refundAmount ?? 0
        toast.success(
          refundAmount > 0
            ? `Đã ghi nhận trả hàng. Cần hoàn ${refundAmount.toLocaleString('vi-VN')}đ cho khách.`
            : 'Đã ghi nhận đổi/trả hàng.',
        )
      }
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể tạo yêu cầu đổi trả'),
  })

  const pendingAction =
    createOrderMutation.isPending ||
    updateOrderMutation.isPending ||
    payOrderMutation.isPending ||
    exportStockMutation.isPending ||
    settleOrderMutation.isPending ||
    cancelOrderMutation.isPending ||
    refundOrderMutation.isPending

  return {
    pendingAction,
    createOrderMutation,
    updateOrderMutation,
    payOrderMutation,
    exportStockMutation,
    settleOrderMutation,
    cancelOrderMutation,
    refundOrderMutation,
    createReturnRequestMutation,
  }
}
