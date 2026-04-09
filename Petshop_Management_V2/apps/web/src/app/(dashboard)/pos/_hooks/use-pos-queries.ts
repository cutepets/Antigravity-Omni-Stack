'use client';

import { useQuery } from '@tanstack/react-query';
import { matchSearch } from '@petshop/shared';
import { orderApi } from '@/lib/api/order.api';
import { api } from '@/lib/api';

// ─── POS Catalog ──────────────────────────────────────────────────────────────
export function usePosProducts(search?: string) {
  return useQuery({
    queryKey: ['pos', 'products', search],
    queryFn: async () => {
      const data = await orderApi.getCatalog();
      const products = data.products ?? [];
      if (!search) return products;
      return products.filter(
        (p: any) =>
          matchSearch(search, p.name) ||
          matchSearch(search, p.sku) ||
          matchSearch(search, p.barcode)
      );
    },
    staleTime: 30_000,
  });
}

export function usePosServices(search?: string) {
  return useQuery({
    queryKey: ['pos', 'services', search],
    queryFn: async () => {
      const data = await orderApi.getCatalog();
      const services = data.services ?? [];
      if (!search) return services;
      return services.filter((s: any) => matchSearch(search, s.name));
    },
    staleTime: 30_000,
  });
}

// ─── Customer Search ──────────────────────────────────────────────────────────
export function useCustomerSearch(query: string) {
  return useQuery({
    queryKey: ['customers', 'search', query],
    queryFn: () =>
      api.get('/customers', { params: { search: query, limit: 10 } }).then((r) => r.data.data ?? r.data),
    enabled: query.length >= 2,
    staleTime: 10_000,
  });
}

export function useCustomerDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => api.get(`/customers/${id}`).then((r) => r.data.data ?? r.data),
    enabled: !!id,
  });
}

// ─── Pets ────────────────────────────────────────────────────────────────────
export function useCustomerPets(customerId: string | undefined) {
  return useQuery({
    queryKey: ['pets', 'customer', customerId],
    queryFn: () =>
      api.get('/pets', { params: { customerId } }).then((r) => r.data.data ?? r.data),
    enabled: !!customerId,
  });
}

// ─── Branches ────────────────────────────────────────────────────────────────
export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/settings/branches').then((r) => r.data.data ?? r.data),
    staleTime: 60_000,
  });
}

// ─── Pending Orders ──────────────────────────────────────────────────────────
export function usePendingOrders(customerId?: string) {
  return useQuery({
    queryKey: ['orders', 'pending', customerId],
    queryFn: () =>
      orderApi.list({
        paymentStatus: 'UNPAID,PARTIAL',
        customerId,
        limit: 10,
      }),
    enabled: !!customerId,
    staleTime: 15_000,
  });
}

// ─── Single Order ─────────────────────────────────────────────────────────────
export function useOrderDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => orderApi.get(id!),
    enabled: !!id,
  });
}
