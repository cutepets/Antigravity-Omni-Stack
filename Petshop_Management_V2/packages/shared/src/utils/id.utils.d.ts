export declare const formatSequentialCode: (prefix: string, sequence: number, padLength?: number) => string;
export declare const formatDatedSequenceCode: (prefix: string, date: Date, sequence: number, options?: {
    dateMode?: 'yyMMdd' | 'yyyyMMdd';
    sequencePadLength?: number;
}) => string;
/**
 * Generate customer code: KH000001
 */
export declare const generateCustomerCode: (sequence: number) => string;
/**
 * Generate pet code: PET000001
 */
export declare const generatePetCode: (sequence: number) => string;
/**
 * Generate staff code: NV00001
 */
export declare const generateStaffCode: (sequence: number) => string;
/**
 * Generate order number: DH202604060001
 */
export declare const generateOrderNumber: (date: Date, sequence: number) => string;
/**
 * Generate hotel stay code: H2604TH001
 */
export declare const generateHotelStayCode: (date: Date, branchCode: string, sequence: number) => string;
/**
 * Generate grooming session code: S2604TH001
 */
export declare const generateGroomingSessionCode: (date: Date, branchCode: string, sequence: number) => string;
/**
 * Generate voucher number for transactions
 */
export declare const generateVoucherNumber: (type: "INCOME" | "EXPENSE", date: Date, seq: number) => string;
//# sourceMappingURL=id.utils.d.ts.map
