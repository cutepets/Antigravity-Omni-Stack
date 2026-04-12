'use client';

import { useQuery } from '@tanstack/react-query';
import { matchSearch } from '@petshop/shared';
import { orderApi } from '@/lib/api/order.api';
import { api } from '@/lib/api';
import {
  pricingApi,
  type HotelPriceRule,
  type SpaPriceRule,
} from '@/lib/api/pricing.api';

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

const normalizeSpecies = (value?: string | null) => value?.trim() || undefined;

const normalizeSpeciesKey = (value?: string | null) => {
  const normalized = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!normalized) return '';
  if (['meo', 'cat', 'feline'].includes(normalized)) return 'cat';
  if (['cho', 'dog', 'canine'].includes(normalized)) return 'dog';
  return normalized;
};

const getRuleSpecies = (rule: { species?: string | null; weightBand?: { species?: string | null } }) =>
  rule.species ?? rule.weightBand?.species ?? null;

const isSpeciesMatch = (petSpecies?: string, ruleSpecies?: string | null) => {
  if (!ruleSpecies) return true;
  if (!petSpecies) return false;
  return normalizeSpeciesKey(petSpecies) === normalizeSpeciesKey(ruleSpecies);
};

const isWeightInBand = (
  weight: number,
  band?: { minWeight?: number | null; maxWeight?: number | null } | null,
) => {
  if (!Number.isFinite(weight) || !band) return false;
  const minWeight = Number(band.minWeight ?? 0);
  const maxWeight = band.maxWeight === null || band.maxWeight === undefined ? Number.POSITIVE_INFINITY : Number(band.maxWeight);
  return weight >= minWeight && weight < maxWeight;
};

const packageLabel = (code?: string | null) =>
  String(code ?? '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();

const normalizeSkuText = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const getWeightBandSkuSuffix = (label?: string | null) => {
  const numbers = String(label ?? '').match(/\d+(?:[.,]\d+)?/g);
  return numbers?.map((value) => value.replace(/[.,]/g, '')).join('') ?? '';
};

const getSkuInitials = (value?: string | null) =>
  normalizeSkuText(value)
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('');

const getSpaSkuPrefix = (packageCode?: string | null, label?: string | null) => {
  const code = normalizeSkuText(packageCode).replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const prefixByCode: Record<string, string> = {
    BATH: 'T',
    TAM: 'T',
    HYGIENE: 'VS',
    VE_SINH: 'VS',
    CLIP: 'CL',
    CUT: 'CL',
    SHAVE: 'CL',
    CAO_LONG: 'CL',
    BATH_HYGIENE: 'TVS',
    BATH_CLEAN: 'TVS',
    BATH_CLIP: 'TCL',
    BATH_SHAVE: 'TCL',
    BATH_CLIP_HYGIENE: 'TCLVS',
    BATH_SHAVE_HYGIENE: 'TCLVS',
    SPA: 'SPA',
  };

  return prefixByCode[code] ?? (getSkuInitials(label) || 'SPA');
};

const getPricingSku = (
  kind: 'HOTEL' | 'SPA',
  label: string,
  weightBandLabel?: string | null,
  packageCode?: string | null,
) => {
  const prefix = kind === 'HOTEL' ? 'HLT' : getSpaSkuPrefix(packageCode, label);
  return `${prefix}${getWeightBandSkuSuffix(weightBandLabel)}`;
};

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

export function usePetPricingSuggestions(pet: any) {
  const species = normalizeSpecies(pet?.species);
  const weight = Number(pet?.weight);
  const hasPricingProfile = Boolean(species) && Number.isFinite(weight);
  const currentYear = new Date().getFullYear();

  const spaRulesQuery = useQuery({
    queryKey: ['pos', 'pricing-suggestions', 'spa', 'all-active'],
    queryFn: () => pricingApi.getSpaRules({ isActive: true }),
    enabled: Boolean(pet?.id) && hasPricingProfile,
    staleTime: 30_000,
  });

  const hotelRulesQuery = useQuery({
    queryKey: ['pos', 'pricing-suggestions', 'hotel', currentYear, 'all-active'],
    queryFn: () => pricingApi.getHotelRules({ year: currentYear, isActive: true }),
    enabled: Boolean(pet?.id) && hasPricingProfile,
    staleTime: 30_000,
  });

  const suggestions = buildPricingSuggestions({
    pet,
    weight,
    hasPricingProfile,
    species,
    spaRules: spaRulesQuery.data ?? [],
    hotelRules: hotelRulesQuery.data ?? [],
  });

  return {
    data: suggestions,
    isLoading: spaRulesQuery.isLoading || hotelRulesQuery.isLoading,
    isError: spaRulesQuery.isError || hotelRulesQuery.isError,
    hasPricingProfile,
  };
}

function buildPricingSuggestions({
  pet,
  weight,
  hasPricingProfile,
  species,
  spaRules,
  hotelRules,
}: {
  pet: any;
  weight: number;
  hasPricingProfile: boolean;
  species?: string;
  spaRules: SpaPriceRule[];
  hotelRules: HotelPriceRule[];
}) {
  if (!pet || !hasPricingProfile) return [];

  const spaSuggestions = spaRules
    .filter((rule) => isSpeciesMatch(species, getRuleSpecies(rule)) && isWeightInBand(weight, rule.weightBand))
    .map((rule) => ({
      id: `pricing:grooming:${rule.id}`,
      entryType: 'pricing-grooming',
      pricingKind: 'GROOMING',
      type: 'grooming',
      name: packageLabel(rule.packageCode),
      description: undefined,
      sku: getPricingSku('SPA', packageLabel(rule.packageCode), rule.weightBand?.label, rule.packageCode),
      price: rule.price,
      sellingPrice: rule.price,
      duration: rule.durationMinutes ?? undefined,
      packageCode: rule.packageCode,
      weightBandId: rule.weightBandId,
      weightBandLabel: rule.weightBand?.label,
      pricingRuleId: rule.id,
      petSnapshot: pet,
      suggestionKind: 'SPA',
      suggestionScore: 90,
      reason: `Giá từ bảng giá grooming cho hạng ${rule.weightBand?.label ?? 'phù hợp'}.`,
    }));

  const matchingHotelRules = hotelRules.filter((rule) => isSpeciesMatch(species, getRuleSpecies(rule)) && isWeightInBand(weight, rule.weightBand));
  const regularHotelRule = matchingHotelRules.find((rule) => rule.dayType === 'REGULAR') ?? matchingHotelRules[0];
  const hotelSuggestions = regularHotelRule
    ? [{
      id: `pricing:hotel:${regularHotelRule.weightBandId}`,
      entryType: 'pricing-hotel',
      pricingKind: 'HOTEL',
      type: 'hotel',
      name: 'Hotel lưu trú',
      description: `Chọn ngày để tính lễ/ngày thường`,
      sku: getPricingSku('HOTEL', 'Hotel lưu trú', regularHotelRule.weightBand?.label),
      price: regularHotelRule.fullDayPrice,
      sellingPrice: regularHotelRule.fullDayPrice,
      duration: undefined,
      weightBandId: regularHotelRule.weightBandId,
      weightBandLabel: regularHotelRule.weightBand?.label,
      pricingRuleId: regularHotelRule.id,
      petSnapshot: pet,
      suggestionKind: 'HOTEL',
      suggestionScore: 85,
      reason: 'Tính giá hotel theo ngày nhận/trả, tự tách ngày lễ và ngày thường.',
    }]
    : [];

  return [...spaSuggestions, ...hotelSuggestions].sort((left, right) => right.suggestionScore - left.suggestionScore);
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
