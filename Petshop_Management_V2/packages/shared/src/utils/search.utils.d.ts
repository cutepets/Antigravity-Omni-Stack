/**
 * Normalize Vietnamese string for diacritic-insensitive search
 * "thành" → "thanh", "Hồ Chí Minh" → "ho chi minh"
 */
export declare const normalizeVietnamese: (str: string) => string;
/**
 * Multi-term AND search — all terms must match target
 * e.g. "tha pho" matches "Thành phố" ✅, "Thanh Long" ❌
 */
export declare const matchSearch: (query: string, target: string) => boolean;
//# sourceMappingURL=search.utils.d.ts.map