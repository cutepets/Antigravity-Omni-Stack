'use client';

import { useQuery } from '@tanstack/react-query';
import { matchSearch } from '@petshop/shared';
import { orderApi } from '@/lib/api/order.api';
import { api } from '@/lib/api';

const buildSearchableText = (values: unknown[]): string =>
  values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');

const getVariantLabel = (productName: string, variantName?: string | null) => {
  if (!variantName) return undefined;

  const normalizedProductName = productName.trim();
  const normalizedVariantName = variantName.trim();
  if (!normalizedVariantName || normalizedVariantName === normalizedProductName) {
    return undefined;
  }

  const prefix = `${normalizedProductName} - `;
  return normalizedVariantName.startsWith(prefix)
    ? normalizedVariantName.slice(prefix.length)
    : normalizedVariantName;
};

const normalizeSearchTerm = (value?: string) => value?.trim().toLowerCase() ?? '';
const getMonthlySoldCount = (entry: any) => Number(entry?.salesMetrics?.monthQuantitySold ?? 0);

const compareProductEntries = (search?: string) => {
  const normalizedSearch = normalizeSearchTerm(search);

  return (left: any, right: any) => {
    const leftCodes = [left.sku, left.barcode].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase());
    const rightCodes = [right.sku, right.barcode].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase());

    const leftExactCode = normalizedSearch ? leftCodes.some((value) => value === normalizedSearch) : false;
    const rightExactCode = normalizedSearch ? rightCodes.some((value) => value === normalizedSearch) : false;
    if (leftExactCode !== rightExactCode) return rightExactCode ? 1 : -1;

    const leftPrefixCode = normalizedSearch ? leftCodes.some((value) => value.startsWith(normalizedSearch)) : false;
    const rightPrefixCode = normalizedSearch ? rightCodes.some((value) => value.startsWith(normalizedSearch)) : false;
    if (leftPrefixCode !== rightPrefixCode) return rightPrefixCode ? 1 : -1;

    const leftNameStarts = normalizedSearch
      ? [left.productName, left.variantLabel, left.name].filter(Boolean).some((value: string) => value.toLowerCase().startsWith(normalizedSearch))
      : false;
    const rightNameStarts = normalizedSearch
      ? [right.productName, right.variantLabel, right.name].filter(Boolean).some((value: string) => value.toLowerCase().startsWith(normalizedSearch))
      : false;
    if (leftNameStarts !== rightNameStarts) return rightNameStarts ? 1 : -1;

    const monthlyDiff = getMonthlySoldCount(right) - getMonthlySoldCount(left);
    if (monthlyDiff !== 0) return monthlyDiff;

    return String(left.name ?? '').localeCompare(String(right.name ?? ''), 'vi');
  };
};

const createProductEntry = (product: any, variant?: any) => {
  const variantLabel = getVariantLabel(product.name, variant?.name);
  const resolvedPrice = variant?.sellingPrice ?? variant?.price ?? product.sellingPrice ?? product.price ?? 0;

  return {
    ...product,
    id: `product:${product.id}:${variant?.id ?? 'base'}`,
    entryId: `product:${product.id}:${variant?.id ?? 'base'}`,
    entryType: variant ? 'product-variant' : 'product',
    productId: product.id,
    productVariantId: variant?.id ?? undefined,
    productName: product.name,
    name: product.name,
    variantLabel,
    sku: variant?.sku ?? product.sku,
    barcode: variant?.barcode ?? product.barcode,
    image: variant?.image ?? product.image,
    price: resolvedPrice,
    sellingPrice: resolvedPrice,
    unit: product.unit,
    stock: variant?.stock ?? product.stock,
    availableStock: variant?.availableStock ?? product.availableStock,
    trading: variant?.trading ?? product.trading,
    reserved: variant?.reserved ?? product.reserved,
    branchStocks: variant?.branchStocks?.length ? variant.branchStocks : product.branchStocks,
    soldCount: variant?.soldCount ?? product.soldCount ?? 0,
    salesMetrics: variant?.salesMetrics ?? product.salesMetrics,
    variants: product.variants,
  };
};

const flattenProductEntries = (products: any[]) =>
  products.flatMap((product: any) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length === 0) return [createProductEntry(product)];
    return variants.map((variant: any) => createProductEntry(product, variant));
  });

// ─── POS Catalog ──────────────────────────────────────────────────────────────
export function usePosProducts(search?: string) {
  return useQuery({
    queryKey: ['pos', 'products', search],
    queryFn: async () => {
      const data = await orderApi.getCatalog();
      const entries = flattenProductEntries(data.products ?? []).toSorted(compareProductEntries(search));
      if (!search) return entries;

      return entries.filter((product: any) => {
        const searchableText = buildSearchableText([
          product.productName,
          product.name,
          product.variantLabel,
          product.sku,
          product.barcode,
        ]);

        return searchableText ? matchSearch(search, searchableText) : false;
      });
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
