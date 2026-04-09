"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCurrency = exports.formatVND = void 0;
/**
 * Format number as Vietnamese currency: 150000 → "150.000 ₫"
 */
const formatVND = (amount) => new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
}).format(amount);
exports.formatVND = formatVND;
/**
 * Parse Vietnamese currency string to number: "150.000" → 150000
 */
const parseCurrency = (str) => Number(str.replace(/[^\d-]/g, '')) || 0;
exports.parseCurrency = parseCurrency;
