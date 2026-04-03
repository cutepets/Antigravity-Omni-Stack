/**
 * Format date to Vietnamese display format: dd/MM/yyyy HH:mm
 */
export declare const formatDate: (date: Date | string) => string;
/**
 * Format date only: dd/MM/yyyy
 */
export declare const formatDateOnly: (date: Date | string) => string;
/**
 * Get ms until midnight (for daily job scheduling)
 */
export declare const msUntilMidnight: () => number;
/**
 * Calculate difference in days between two dates
 */
export declare const diffDays: (from: Date, to: Date) => number;
//# sourceMappingURL=date.utils.d.ts.map