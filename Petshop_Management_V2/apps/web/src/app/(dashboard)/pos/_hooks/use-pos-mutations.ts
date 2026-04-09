'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orderApi, type CreateOrderPayload, type UpdateOrderPayload, type PayOrderPayload, type CompleteOrderPayload, type CancelOrderPayload } from '@/lib/api/order.api';
import { api } from '@/lib/api';
import { customToast as toast } from '@/components/ui/toast-with-copy';

// ─── Order Mutations ──────────────────────────────────────────────────────────

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrderPayload) => orderApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['pos', 'products'] });
      toast.success('Tạo đơn hàng thành công');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Lỗi khi tạo đơn hàng');
    },
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrderPayload }) => orderApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order'] });
      toast.success('Cập nhật đơn hàng thành công');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật đơn hàng');
    },
  });
}

export function usePayOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PayOrderPayload }) =>
      orderApi.pay(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Thanh toán bổ sung thành công');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Lỗi khi thanh toán');
    },
  });
}

export function useCompleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CompleteOrderPayload }) =>
      orderApi.complete(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Hoàn thành đơn hàng');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Lỗi khi hoàn thành đơn');
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CancelOrderPayload }) =>
      orderApi.cancel(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Đã huỷ đơn hàng');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Lỗi khi huỷ đơn');
    },
  });
}

export function useRemoveOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      orderApi.removeItem(orderId, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Lỗi khi xóa item');
    },
  });
}

// ─── Customer Mutations ───────────────────────────────────────────────────────

export function useQuickCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fullName: string; phone: string }) =>
      api.post('/customers', data).then((r) => r.data.data ?? r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Tạo khách hàng thành công');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Lỗi khi tạo khách hàng');
    },
  });
}

export function useQuickCreatePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; species: string; customerId: string; weight?: number }) =>
      api.post('/pets', data).then((r) => r.data.data ?? r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pets', 'customer', vars.customerId] });
      toast.success('Thêm pet thành công');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Lỗi khi thêm pet');
    },
  });
}
