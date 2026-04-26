export function normalizeSpaPackageCode(value?: string | null) {
  return String(value ?? '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function normalizeSpaSkuText(value?: string | null) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function getSpaWeightBandSkuSuffix(label?: string | null) {
  const numbers = String(label ?? '').match(/\d+(?:[.,]\d+)?/g);
  return numbers?.map((value) => value.replace(/[.,]/g, '')).join('') ?? '';
}

export function getSpaSkuInitials(value?: string | null) {
  return normalizeSpaSkuText(value)
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('');
}

export function getSpaSkuPrefix(packageCode?: string | null, label?: string | null) {
  const code = normalizeSpaSkuText(packageCode).replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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

  return prefixByCode[code] ?? (getSpaSkuInitials(label) || 'SPA');
}

export function getSpaPricingSku(packageCode?: string | null, label?: string | null, weightBandLabel?: string | null) {
  return `${getSpaSkuPrefix(packageCode, label)}${getSpaWeightBandSkuSuffix(weightBandLabel)}`;
}

export function normalizeSpeciesKey(value?: string | null) {
  const normalized = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!normalized) return '';
  if (['meo', 'cat', 'feline'].includes(normalized)) return 'cat';
  if (['cho', 'dog', 'canine'].includes(normalized)) return 'dog';
  return normalized;
}

export function isSpaRuleSpeciesMatch(petSpecies?: string | null, ruleSpecies?: string | null) {
  if (!ruleSpecies) return true;
  if (!petSpecies) return false;
  return normalizeSpeciesKey(petSpecies) === normalizeSpeciesKey(ruleSpecies);
}

export function isWeightInRange(weight: number, minWeight?: number | null, maxWeight?: number | null) {
  if (!Number.isFinite(weight)) return false;
  const safeMin = Number(minWeight ?? 0);
  const safeMax = maxWeight === null || maxWeight === undefined ? Number.POSITIVE_INFINITY : Number(maxWeight);
  return weight >= safeMin && weight < safeMax;
}
