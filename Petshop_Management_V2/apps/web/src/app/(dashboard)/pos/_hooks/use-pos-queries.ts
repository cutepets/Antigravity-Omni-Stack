'use client';

import { useQuery } from '@tanstack/react-query';
import { orderApi } from '@/lib/api/order.api';
import {
  pricingApi,
  type HotelDaycarePriceRule,
  type HotelExtraService,
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

const hasCustomSpaWeightRange = (rule: { minWeight?: number | null; maxWeight?: number | null }) =>
  rule.minWeight !== null && rule.minWeight !== undefined;

const isWeightInSpaRule = (weight: number, rule: { minWeight?: number | null; maxWeight?: number | null }) => {
  if (!hasCustomSpaWeightRange(rule)) return false;
  const minWeight = Number(rule.minWeight ?? 0);
  const maxWeight = rule.maxWeight === null || rule.maxWeight === undefined ? Number.POSITIVE_INFINITY : Number(rule.maxWeight);
  return weight >= minWeight && weight < maxWeight;
};

const getSpaRuleWeightLabel = (rule: { minWeight?: number | null; maxWeight?: number | null }) => {
  if (!hasCustomSpaWeightRange(rule)) return undefined;
  const minWeight = Number(rule.minWeight ?? 0);
  const maxWeight = rule.maxWeight === null || rule.maxWeight === undefined ? '∞' : String(rule.maxWeight);
  return `${minWeight}-${maxWeight}kg`;
};

const getSpaExtraRuleKey = (rule: {
  packageCode: string;
  minWeight?: number | null;
  maxWeight?: number | null;
}) => `${normalizeSkuText(rule.packageCode)}:${rule.minWeight ?? 'NULL'}:${rule.maxWeight ?? 'INF'}`;

const scoreSpaExtraRule = (
  rule: { species?: string | null; weightBand?: { species?: string | null } },
  petSpecies?: string,
) => {
  const ruleSpecies = getRuleSpecies(rule);
  if (!ruleSpecies) return 2;
  return isSpeciesMatch(petSpecies, ruleSpecies) ? 1 : 0;
};

const pickPreferredSpaExtraRules = <TRule extends {
  packageCode: string;
  minWeight?: number | null;
  maxWeight?: number | null;
  species?: string | null;
  weightBand?: { species?: string | null };
}>(
  rules: TRule[],
  petSpecies?: string,
) => {
  const dedupedRules = new Map<string, TRule>();

  for (const rule of rules) {
    const ruleKey = getSpaExtraRuleKey(rule);
    const currentRule = dedupedRules.get(ruleKey);

    if (!currentRule || scoreSpaExtraRule(rule, petSpecies) > scoreSpaExtraRule(currentRule, petSpecies)) {
      dedupedRules.set(ruleKey, rule);
    }
  }

  return Array.from(dedupedRules.values());
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
    // Fetch for all pets — needed to show flat-rate services (no weight band)
    enabled: Boolean(pet?.id),
    staleTime: 30_000,
  });

  const hotelRulesQuery = useQuery({
    queryKey: ['pos', 'pricing-suggestions', 'hotel', currentYear, 'all-active'],
    queryFn: () => pricingApi.getHotelRules({ year: currentYear, isActive: true }),
    // Fetch for all pets — needed to show flat-rate hotel services
    enabled: Boolean(pet?.id),
    staleTime: 30_000,
  });

  const hotelDaycareRulesQuery = useQuery({
    queryKey: ['pos', 'pricing-suggestions', 'hotel-daycare', 10, 'all-active'],
    queryFn: () => pricingApi.getHotelDaycareRules({ packageDays: 10, isActive: true }),
    enabled: Boolean(pet?.id),
    staleTime: 30_000,
  });

  const hotelExtraServicesQuery = useQuery({
    queryKey: ['pos', 'pricing-suggestions', 'hotel-extra-services'],
    queryFn: () => pricingApi.getHotelExtraServices(),
    enabled: Boolean(pet?.id),
    staleTime: 60_000,
  });

  const suggestions = buildPricingSuggestions({
    pet,
    weight,
    hasPricingProfile,
    species,
    spaRules: spaRulesQuery.data ?? [],
    hotelRules: hotelRulesQuery.data ?? [],
    hotelDaycareRules: hotelDaycareRulesQuery.data ?? [],
    hotelExtraServices: hotelExtraServicesQuery.data ?? [],
  });

  return {
    data: suggestions,
    isLoading: spaRulesQuery.isLoading || hotelRulesQuery.isLoading || hotelDaycareRulesQuery.isLoading,
    isError: spaRulesQuery.isError || hotelRulesQuery.isError || hotelDaycareRulesQuery.isError,
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
  hotelDaycareRules,
  hotelExtraServices,
}: {
  pet: any;
  weight: number;
  hasPricingProfile: boolean;
  species?: string;
  spaRules: SpaPriceRule[];
  hotelRules: HotelPriceRule[];
  hotelDaycareRules: HotelDaycarePriceRule[];
  hotelExtraServices: HotelExtraService[];
}) {
  if (!pet) return [];

  const extraSpaRules = spaRules.filter((rule) => !rule.weightBand && !rule.weightBandId);

  // ── Weight-matched spa suggestions (score 90) ─────────────────────────────
  const weightMatchedSpaSuggestions = hasPricingProfile
    ? spaRules
      .filter((rule) => rule.weightBand && isSpeciesMatch(species, getRuleSpecies(rule)) && isWeightInBand(weight, rule.weightBand))
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
        suggestionKind: 'SPA' as const,
        suggestionGroup: 'PRIMARY' as const,
        serviceRole: 'MAIN' as const,
        isSpaExtraService: false,
        pricingSnapshot: {
          source: 'SPA_PRICE_RULE',
          serviceRole: 'MAIN',
          pricingRuleId: rule.id,
          packageCode: rule.packageCode,
          weightBandId: rule.weightBandId ?? null,
          weightBandLabel: rule.weightBand?.label ?? null,
          price: rule.price,
          serviceName: packageLabel(rule.packageCode),
          sku: getPricingSku('SPA', packageLabel(rule.packageCode), rule.weightBand?.label, rule.packageCode),
          durationMinutes: rule.durationMinutes ?? null,
        },
        suggestionScore: 90,
        isWeightMatched: true,
        reason: `Giá từ bảng giá grooming cho hạng ${rule.weightBand?.label ?? 'phù hợp'}.`,
      }))
    : [];

  // ── Flat-rate spa suggestions (no weightBand, score 60) ───────────────────
  // Common rules without weightBand are extra SPA services, selectable separately from main packages.
  const customRangeSpaSuggestions = hasPricingProfile
    ? pickPreferredSpaExtraRules(
      extraSpaRules.filter(
        (rule) =>
          hasCustomSpaWeightRange(rule) &&
          isWeightInSpaRule(weight, rule),
      ),
      species,
    )
      .map((rule) => ({
        id: `pricing:grooming:custom:${rule.id}`,
        entryType: 'pricing-grooming',
        pricingKind: 'GROOMING',
        type: 'grooming',
        name: packageLabel(rule.packageCode),
        description: undefined,
        sku: getPricingSku('SPA', packageLabel(rule.packageCode), getSpaRuleWeightLabel(rule), rule.packageCode),
        price: rule.price,
        sellingPrice: rule.price,
        duration: rule.durationMinutes ?? undefined,
        packageCode: rule.packageCode,
        weightBandId: undefined,
        weightBandLabel: getSpaRuleWeightLabel(rule),
        pricingRuleId: rule.id,
        petSnapshot: pet,
        suggestionKind: 'SPA' as const,
        suggestionGroup: 'OTHER' as const,
        serviceRole: 'EXTRA' as const,
        isSpaExtraService: true,
        pricingSnapshot: {
          source: 'SPA_EXTRA_PRICE_RULE',
          serviceRole: 'EXTRA',
          pricingRuleId: rule.id,
          packageCode: rule.packageCode,
          weightBandId: null,
          weightBandLabel: getSpaRuleWeightLabel(rule) ?? null,
          price: rule.price,
          serviceName: packageLabel(rule.packageCode),
          sku: getPricingSku('SPA', packageLabel(rule.packageCode), getSpaRuleWeightLabel(rule), rule.packageCode),
          durationMinutes: rule.durationMinutes ?? null,
          minWeight: rule.minWeight ?? null,
          maxWeight: rule.maxWeight ?? null,
        },
        suggestionScore: 85,
        isWeightMatched: true,
        reason: `Giá grooming theo khoảng cân ${getSpaRuleWeightLabel(rule) ?? 'phù hợp'}.`,
      }))
    : [];
  const flatRateSpaSuggestions = pickPreferredSpaExtraRules(
    extraSpaRules.filter((rule) => !hasCustomSpaWeightRange(rule)),
    species,
  )
    .map((rule) => ({
      id: `pricing:grooming:flat:${rule.id}`,
      entryType: 'pricing-grooming',
      pricingKind: 'GROOMING',
      type: 'grooming',
      name: packageLabel(rule.packageCode),
      description: undefined,
      sku: getPricingSku('SPA', packageLabel(rule.packageCode), undefined, rule.packageCode),
      price: rule.price,
      sellingPrice: rule.price,
      duration: rule.durationMinutes ?? undefined,
      packageCode: rule.packageCode,
      weightBandId: undefined,
      weightBandLabel: undefined,
      pricingRuleId: rule.id,
      petSnapshot: pet,
      suggestionKind: 'SPA' as const,
      suggestionGroup: 'OTHER' as const,
      serviceRole: 'EXTRA' as const,
      isSpaExtraService: true,
      pricingSnapshot: {
        source: 'SPA_EXTRA_PRICE_RULE',
        serviceRole: 'EXTRA',
        pricingRuleId: rule.id,
        packageCode: rule.packageCode,
        weightBandId: null,
        weightBandLabel: null,
        price: rule.price,
        serviceName: packageLabel(rule.packageCode),
        sku: getPricingSku('SPA', packageLabel(rule.packageCode), undefined, rule.packageCode),
        durationMinutes: rule.durationMinutes ?? null,
      },
      suggestionScore: 60,
      isWeightMatched: false,
      reason: 'Dịch vụ giá cố định (không phân loại theo cân nặng).',
    }));

  // ── Weight-matched hotel suggestions (score 85 REGULAR, 80 HOLIDAY) ────────
  const matchingHotelRules = hasPricingProfile
    ? hotelRules.filter((rule) => isSpeciesMatch(species, getRuleSpecies(rule)) && isWeightInBand(weight, rule.weightBand))
    : [];
  const weightMatchedHotelSuggestions = matchingHotelRules.map((rule) => ({
    id: `pricing:hotel:${rule.id}`,
    entryType: 'pricing-hotel',
    pricingKind: 'HOTEL',
    type: 'hotel',
    name: rule.dayType === 'HOLIDAY' ? 'Hotel lưu trú (Ngày lễ)' : 'Hotel lưu trú',
    description: rule.dayType === 'HOLIDAY' ? 'Áp dụng cho ngày lễ/Tết' : 'Chọn ngày để tính lễ/ngày thường',
    sku: getPricingSku('HOTEL', rule.dayType === 'HOLIDAY' ? 'Hotel lưu trú Ngày lễ' : 'Hotel lưu trú', rule.weightBand?.label),
    price: rule.fullDayPrice,
    sellingPrice: rule.fullDayPrice,
    duration: undefined,
    weightBandId: rule.weightBandId,
    weightBandLabel: rule.weightBand?.label,
    pricingRuleId: rule.id,
    dayType: rule.dayType,
    petSnapshot: pet,
    suggestionKind: 'HOTEL' as const,
    suggestionGroup: 'PRIMARY' as const,
    suggestionScore: rule.dayType === 'REGULAR' ? 85 : 80,
    isWeightMatched: true,
    reason: rule.dayType === 'HOLIDAY'
      ? 'Giá hotel ngày lễ theo hạng cân.'
      : 'Tính giá hotel theo ngày nhận/trả, tự tách ngày lễ và ngày thường.',
  }));

  // ── Flat-rate hotel suggestions (no weightBand, score 55) ────────────────
  const matchingHotelDaycareRules = hasPricingProfile
    ? hotelDaycareRules.filter((rule) => isSpeciesMatch(species, getRuleSpecies(rule)) && isWeightInBand(weight, rule.weightBand))
    : [];
  const hotelDaycareSuggestions = matchingHotelDaycareRules.map((rule) => ({
    id: `pricing:hotel:daycare:${rule.id}`,
    entryType: 'pricing-hotel',
    pricingKind: 'HOTEL',
    type: 'hotel',
    name: 'Hotel nha tre combo 10 ngay',
    description: 'Goi giu ban ngay, tu dong ket thuc sau 10 ngay lich.',
    sku: rule.sku ?? `${getPricingSku('HOTEL', 'Hotel nha tre', rule.weightBand?.label)}-NT`,
    price: rule.price,
    sellingPrice: rule.price,
    duration: undefined,
    weightBandId: rule.weightBandId,
    weightBandLabel: rule.weightBand?.label ?? rule.weightBandLabel ?? undefined,
    pricingRuleId: rule.id,
    petSnapshot: pet,
    suggestionKind: 'HOTEL' as const,
    suggestionGroup: 'PRIMARY' as const,
    suggestionScore: 88,
    isWeightMatched: true,
    careMode: 'DAYCARE' as const,
    packageKind: 'COMBO_10_DAYS' as const,
    packageTotalDays: rule.packageDays ?? 10,
    pricingSnapshot: {
      source: 'DAYCARE_COMBO_10',
      careMode: 'DAYCARE',
      packageKind: 'COMBO_10_DAYS',
      packageDays: rule.packageDays ?? 10,
      weightBandId: rule.weightBandId,
      weightBandLabel: rule.weightBand?.label ?? rule.weightBandLabel ?? null,
      price: rule.price,
      sku: rule.sku ?? null,
    },
    reason: 'Gia nha tre combo 10 ngay theo hang can.',
  }));

  const hasWeightMatchedHotel = weightMatchedHotelSuggestions.length > 0;
  const flatRateHotelRules = !hasWeightMatchedHotel
    ? hotelRules.filter(
      (rule) =>
        !rule.weightBand &&
        !rule.weightBandId &&
        isSpeciesMatch(species, getRuleSpecies(rule)),
    )
    : [];
  const flatRateHotelSuggestions = flatRateHotelRules.map((rule) => ({
    id: `pricing:hotel:flat:${rule.id}`,
    entryType: 'pricing-hotel',
    pricingKind: 'HOTEL',
    type: 'hotel',
    name: rule.dayType === 'HOLIDAY' ? 'Hotel lưu trú (Ngày lễ)' : 'Hotel lưu trú',
    description: 'Chọn ngày để tính giá',
    sku: getPricingSku('HOTEL', rule.dayType === 'HOLIDAY' ? 'Hotel lưu trú Ngày lễ' : 'Hotel lưu trú', undefined),
    price: rule.fullDayPrice,
    sellingPrice: rule.fullDayPrice,
    duration: undefined,
    weightBandId: undefined,
    weightBandLabel: undefined,
    pricingRuleId: rule.id,
    dayType: rule.dayType,
    petSnapshot: pet,
    suggestionKind: 'HOTEL' as const,
    suggestionGroup: 'PRIMARY' as const,
    suggestionScore: rule.dayType === 'REGULAR' ? 55 : 50,
    isWeightMatched: false,
    reason: 'Dịch vụ khách sạn giá cố định.',
  }));

  // ── Hotel extra services (score 70) ─────────────────────────────────────
  const matchingHotelExtraServices = hotelExtraServices.filter((svc) => {
    if (!svc.minWeight && !svc.maxWeight) return true; // flat-rate, always show
    if (!Number.isFinite(weight)) return false;
    const min = Number(svc.minWeight ?? 0);
    const max = svc.maxWeight === null || svc.maxWeight === undefined ? Number.POSITIVE_INFINITY : Number(svc.maxWeight);
    return weight >= min && weight < max;
  });
  const hotelExtraServiceSuggestions = matchingHotelExtraServices.map((svc) => ({
    id: `pricing:hotel:extra:${svc.sku ?? svc.name}`,
    entryType: 'pricing-hotel-extra',
    pricingKind: 'HOTEL',
    type: 'hotel',
    name: svc.name,
    description: undefined,
    sku: svc.sku ?? undefined,
    price: svc.price,
    sellingPrice: svc.price,
    duration: undefined,
    weightBandId: undefined,
    weightBandLabel: (svc.minWeight != null)
      ? `${svc.minWeight}-${svc.maxWeight ?? '∞'}kg`
      : undefined,
    pricingRuleId: undefined,
    petSnapshot: pet,
    suggestionKind: 'HOTEL' as const,
    suggestionGroup: 'OTHER' as const,
    serviceRole: 'EXTRA' as const,
    isSpaExtraService: false,
    suggestionScore: 70,
    isWeightMatched: svc.minWeight != null,
    reason: 'Dịch vụ bổ sung của hotel.',
  }));

  return [
    ...weightMatchedSpaSuggestions,
    ...customRangeSpaSuggestions,
    ...hotelDaycareSuggestions,
    ...weightMatchedHotelSuggestions,
    ...flatRateSpaSuggestions,
    ...flatRateHotelSuggestions,
    ...hotelExtraServiceSuggestions,
  ].sort((left, right) => right.suggestionScore - left.suggestionScore);
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
