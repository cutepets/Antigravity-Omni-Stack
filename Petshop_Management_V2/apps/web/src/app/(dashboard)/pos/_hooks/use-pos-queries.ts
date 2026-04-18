'use client';

import { useQuery } from '@tanstack/react-query';
import { orderApi } from '@/lib/api/order.api';
import {
  pricingApi,
  type HotelPriceRule,
  type SpaPriceRule,
} from '@/lib/api/pricing.api';
export { useBranches } from '@/app/(dashboard)/_shared/branches/use-branches';
export {
  useCustomerDetail,
  useCustomerSearch,
  usePosProducts,
  usePosServices,
} from '@/components/search/use-commerce-search';
export { useCustomerPets } from '@/app/(dashboard)/_shared/customer/use-customer-pets';

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

// ─── POS Catalog ──────────────────────────────────────────────────────────────
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
// ─── Pets ────────────────────────────────────────────────────────────────────
// ─── Branches ────────────────────────────────────────────────────────────────
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
