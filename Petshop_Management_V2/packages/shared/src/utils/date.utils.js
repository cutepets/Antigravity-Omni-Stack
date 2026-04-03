"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffDays = exports.msUntilMidnight = exports.formatDateOnly = exports.formatDate = void 0;
/**
 * Format date to Vietnamese display format: dd/MM/yyyy HH:mm
 */
const formatDate = (date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
    }).format(d);
};
exports.formatDate = formatDate;
/**
 * Format date only: dd/MM/yyyy
 */
const formatDateOnly = (date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
    }).format(d);
};
exports.formatDateOnly = formatDateOnly;
/**
 * Get ms until midnight (for daily job scheduling)
 */
const msUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime() - now.getTime();
};
exports.msUntilMidnight = msUntilMidnight;
/**
 * Calculate difference in days between two dates
 */
const diffDays = (from, to) => {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((to.getTime() - from.getTime()) / msPerDay);
};
exports.diffDays = diffDays;
//# sourceMappingURL=date.utils.js.map