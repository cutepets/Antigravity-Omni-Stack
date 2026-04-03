/**
 * Generate customer code: KH-000001
 */
export declare const generateCustomerCode: (sequence: number) => string;
/**
 * Generate pet code: P1B2C3 (P + 5 hex chars)
 */
export declare const generatePetCode: () => string;
/**
 * Generate staff code: NV00001
 */
export declare const generateStaffCode: (sequence: number) => string;
/**
 * Generate order number: DH260303S0001 (DHYYMMDDSXXXX, reset per day)
 */
export declare const generateOrderNumber: (date: Date, sequence: number) => string;
/**
 * Generate voucher number for transactions
 */
export declare const generateVoucherNumber: (type: "INCOME" | "EXPENSE", date: Date, seq: number) => string;
//# sourceMappingURL=id.utils.d.ts.map