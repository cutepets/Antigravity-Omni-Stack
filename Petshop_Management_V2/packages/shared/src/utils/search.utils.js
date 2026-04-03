"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchSearch = exports.normalizeVietnamese = void 0;
/**
 * Normalize Vietnamese string for diacritic-insensitive search
 * "thành" → "thanh", "Hồ Chí Minh" → "ho chi minh"
 */
const normalizeVietnamese = (str) => str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
exports.normalizeVietnamese = normalizeVietnamese;
/**
 * Multi-term AND search — all terms must match target
 * e.g. "tha pho" matches "Thành phố" ✅, "Thanh Long" ❌
 */
const matchSearch = (query, target) => {
    const terms = query.split(' ').filter(Boolean);
    const normalTarget = (0, exports.normalizeVietnamese)(target);
    return terms.every((term) => normalTarget.includes((0, exports.normalizeVietnamese)(term)));
};
exports.matchSearch = matchSearch;
//# sourceMappingURL=search.utils.js.map