'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { parseVariantConversionUnit, resolveProductVariantLabels, matchSearch } from '@petshop/shared'
import { orderApi } from '@/lib/api/order.api'
import { api } from '@/lib/api'
import { resolveCatalogProductPricing } from '@/app/(dashboard)/pos/utils/customer-pricing'

const buildSearchableText = (values: unknown[]): string =>
  values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')

const normalizeSearchTerm = (value?: string) => value?.trim().toLowerCase() ?? ''
const getMonthlySoldCount = (entry: any) => Number(entry?.salesMetrics?.monthQuantitySold ?? 0)

const compareProductEntries = (search?: string) => {
  const normalizedSearch = normalizeSearchTerm(search)

  return (left: any, right: any) => {
    const leftCodes = [
      left.sku, left.barcode,
      ...(Array.isArray(left.conversionSkus) ? left.conversionSkus : []),
    ].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase())
    const rightCodes = [
      right.sku, right.barcode,
      ...(Array.isArray(right.conversionSkus) ? right.conversionSkus : []),
    ].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase())

    const leftExactCode = normalizedSearch ? leftCodes.some((value) => value === normalizedSearch) : false
    const rightExactCode = normalizedSearch ? rightCodes.some((value) => value === normalizedSearch) : false
    if (leftExactCode !== rightExactCode) return rightExactCode ? 1 : -1

    const leftPrefixCode = normalizedSearch ? leftCodes.some((value) => value.startsWith(normalizedSearch)) : false
    const rightPrefixCode = normalizedSearch ? rightCodes.some((value) => value.startsWith(normalizedSearch)) : false
    if (leftPrefixCode !== rightPrefixCode) return rightPrefixCode ? 1 : -1

    const leftNameStarts = normalizedSearch
      ? [left.displayName, left.productName, left.variantLabel, left.unitLabel, left.name].filter(Boolean).some((value: string) => value.toLowerCase().startsWith(normalizedSearch))
      : false
    const rightNameStarts = normalizedSearch
      ? [right.displayName, right.productName, right.variantLabel, right.unitLabel, right.name].filter(Boolean).some((value: string) => value.toLowerCase().startsWith(normalizedSearch))
      : false
    if (leftNameStarts !== rightNameStarts) return rightNameStarts ? 1 : -1

    const monthlyDiff = getMonthlySoldCount(right) - getMonthlySoldCount(left)
    if (monthlyDiff !== 0) return monthlyDiff

    return String(left.name ?? '').localeCompare(String(right.name ?? ''), 'vi')
  }
}

const isConversionVariant = (variant: any) => {
  return Boolean(parseVariantConversionUnit(variant?.conversions))
}

const hasMeaningfulVariantIdentity = (product: any, variant: any) => {
  const { variantLabel, unitLabel } = resolveProductVariantLabels(product.name, variant)
  const normalizedProductName = `${product.name ?? ''}`.trim().toLowerCase()
  const normalizedVariantLabel = `${variantLabel ?? ''}`.trim().toLowerCase()

  return Boolean(
    unitLabel ||
    (variantLabel && normalizedVariantLabel !== normalizedProductName),
  )
}

const createProductEntry = (product: any, variant?: any) => {
  const { variantLabel: resolvedVariantLabel, unitLabel, displayName: resolvedDisplayName } = resolveProductVariantLabels(product.name, variant)
  const resolvedPrice = variant?.sellingPrice ?? variant?.price ?? product.sellingPrice ?? product.price ?? 0

  const rawVariants = Array.isArray(product.variants) ? product.variants : []
  const conversionVariants = rawVariants.filter(isConversionVariant)
  const nonConversionVariants = rawVariants.filter((v: any) => !isConversionVariant(v))
  const hasVariants = nonConversionVariants.length > 0

  // Nếu variantLabel giống tên gốc → sản phẩm đơn hoặc dữ liệu legacy lỗi, bỏ qua để không hiển thị trùng
  const productNameNorm = (product.name ?? '').trim().toLowerCase()
  const variantLabel = resolvedVariantLabel && resolvedVariantLabel.trim().toLowerCase() !== productNameNorm
    ? resolvedVariantLabel
    : null

  // SKUs của conversion variants để tìm kiếm (không hiển thị riêng nhưng searchable)
  const conversionSkus = (rawVariants as any[])
    .filter(isConversionVariant)
    .map((v: any) => v.sku)
    .filter((sku: any): sku is string => Boolean(sku))

  return {
    ...product,
    id: `product:${product.id}:${variant?.id ?? 'base'}`,
    entryId: `product:${product.id}:${variant?.id ?? 'base'}`,
    entryType: variant ? 'product-variant' : 'product',
    productId: product.id,
    productVariantId: variant?.id ?? undefined,
    productName: product.name,
    name: product.name,
    // displayName luôn là tên gốc; variantLabel hiển thị riêng bên cạnh
    displayName: product.name,
    variantLabel,
    unitLabel,
    sku: variant?.sku ?? product.sku,
    barcode: variant?.barcode ?? product.barcode,
    conversionSkus,
    image: variant?.image ?? product.image,
    price: resolvedPrice,
    sellingPrice: resolvedPrice,
    baseProductPrice: product.sellingPrice ?? product.price ?? 0,
    baseProductPriceBookPrices: product.priceBookPrices,
    priceBookPrices: variant?.priceBookPrices ?? product.priceBookPrices,
    unit: product.unit,
    stock: variant?.stock ?? product.stock,
    availableStock: variant?.availableStock ?? product.availableStock,
    trading: variant?.trading ?? product.trading,
    reserved: variant?.reserved ?? product.reserved,
    branchStocks: variant?.branchStocks?.length ? variant.branchStocks : product.branchStocks,
    soldCount: variant?.soldCount ?? product.soldCount ?? 0,
    salesMetrics: variant?.salesMetrics ?? product.salesMetrics,
    variants: product.variants,
    hasVariants,
    isConversion: variant ? isConversionVariant(variant) : false,
  }
}

const flattenProductEntries = (products: any[]) =>
  products.flatMap((product: any) => {
    const rawVariants = Array.isArray(product.variants) ? product.variants : []
    const nonConversionVariants = rawVariants.filter((v: any) => !isConversionVariant(v))
    const hasVariants = nonConversionVariants.length > 0

    if (!hasVariants) {
      return [createProductEntry(product)]
    }

    if (
      nonConversionVariants.length === 1 &&
      !hasMeaningfulVariantIdentity(product, nonConversionVariants[0])
    ) {
      return [createProductEntry(product)]
    }

    return nonConversionVariants.map((variant: any) => createProductEntry(product, variant))
  })

export function useCatalogProducts(search?: string, priceBookId?: string) {
  const catalogQuery = useQuery({
    queryKey: ['pos', 'catalog'],
    queryFn: async () => {
      const data = await orderApi.getCatalog()
      return flattenProductEntries(data.products ?? [])
    },
    staleTime: 5 * 60_000, // 5 phút, catalog không đổi thường xuyên
  })

  const sortedAndFiltered = useMemo(() => {
    const entries = (catalogQuery.data ?? []).map((entry: any) => resolveCatalogProductPricing(entry, priceBookId))
    if (!search) return entries.toSorted(compareProductEntries())

    return entries
      .filter((product: any) => {
        const searchableText = buildSearchableText([
          product.productName,
          product.displayName,
          product.name,
          product.variantLabel,
          product.unitLabel,
          product.sku,
          product.barcode,
          ...(Array.isArray(product.conversionSkus) ? product.conversionSkus : []),
        ])

        return searchableText ? matchSearch(search, searchableText) : false
      })
      .toSorted(compareProductEntries(search))
  }, [catalogQuery.data, priceBookId, search])

  return {
    data: sortedAndFiltered,
    isLoading: catalogQuery.isLoading,
    isError: catalogQuery.isError,
    refetch: catalogQuery.refetch,
  }
}

export function useCatalogServices(search?: string) {
  return useQuery({
    queryKey: ['pos', 'services', search],
    queryFn: async () => {
      const data = await orderApi.getCatalog()
      const services = data.services ?? []
      if (!search) return services
      return services.filter((service: any) => matchSearch(search, service.name))
    },
    staleTime: 30_000,
  })
}

export function useCustomerSearch(query: string) {
  return useQuery({
    queryKey: ['customers', 'search', query],
    queryFn: () =>
      api.get('/customers', { params: { search: query, limit: 10 } }).then((response) => response.data.data ?? response.data),
    enabled: query.length >= 2,
    staleTime: 10_000,
  })
}

export function useCustomerDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => api.get(`/customers/${id}`).then((response) => response.data.data ?? response.data),
    enabled: !!id,
  })
}

export { useCatalogProducts as usePosProducts, useCatalogServices as usePosServices }
