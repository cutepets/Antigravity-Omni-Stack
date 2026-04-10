"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVoucherNumber = exports.generateGroomingSessionCode = exports.generateHotelStayCode = exports.generateOrderNumber = exports.generateStaffCode = exports.generatePetCode = exports.generateCustomerCode = exports.formatDatedSequenceCode = exports.formatSequentialCode = void 0;
/**
 * Generate customer/pet sequential codes
 */
const formatSequentialCode = (prefix, sequence, padLength = 6) => `${prefix}${String(sequence).padStart(padLength, '0')}`;
exports.formatSequentialCode = formatSequentialCode;
const formatCompactDate = (date, mode) => {
    const year = mode === 'yyyyMMdd'
        ? String(date.getFullYear())
        : String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};
const formatDatedSequenceCode = (prefix, date, sequence, options) => {
    const dateMode = options?.dateMode ?? 'yyMMdd';
    const sequencePadLength = options?.sequencePadLength ?? 3;
    return `${prefix}${formatCompactDate(date, dateMode)}${String(sequence).padStart(sequencePadLength, '0')}`;
};
exports.formatDatedSequenceCode = formatDatedSequenceCode;
/**
 * Generate customer code: KH000001
 */
const generateCustomerCode = (sequence) => (0, exports.formatSequentialCode)('KH', sequence);
exports.generateCustomerCode = generateCustomerCode;
/**
 * Generate pet code: PET000001
 */
const generatePetCode = (sequence) => (0, exports.formatSequentialCode)('PET', sequence);
exports.generatePetCode = generatePetCode;
/**
 * Generate staff code: NV00001
 */
const generateStaffCode = (sequence) => `NV${String(sequence).padStart(5, '0')}`;
exports.generateStaffCode = generateStaffCode;
/**
 * Generate order number: DH260406001
 */
const generateOrderNumber = (date, sequence) => (0, exports.formatDatedSequenceCode)('DH', date, sequence, {
    dateMode: 'yyMMdd',
    sequencePadLength: 3,
});
exports.generateOrderNumber = generateOrderNumber;
/**
 * Generate hotel stay code: H2604TH001
 */
const generateHotelStayCode = (date, branchCode, sequence) => {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `H${yy}${mm}${branchCode}${String(sequence).padStart(3, '0')}`;
};
exports.generateHotelStayCode = generateHotelStayCode;
/**
 * Generate grooming session code: S2604TH001
 */
const generateGroomingSessionCode = (date, branchCode, sequence) => {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `S${yy}${mm}${branchCode}${String(sequence).padStart(3, '0')}`;
};
exports.generateGroomingSessionCode = generateGroomingSessionCode;
/**
 * Generate voucher number for transactions
 */
const generateVoucherNumber = (type, date, seq) => {
    const prefix = type === 'INCOME' ? 'PT' : 'PC';
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return `${prefix}${dateStr}${String(seq).padStart(4, '0')}`;
};
exports.generateVoucherNumber = generateVoucherNumber;
//# sourceMappingURL=id.utils.js.map
