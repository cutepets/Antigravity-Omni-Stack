"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVoucherNumber = exports.generateOrderNumber = exports.generateStaffCode = exports.generatePetCode = void 0;
/**
 * Generate pet code: P1B2C3 (P + 6 hex chars)
 */
const generatePetCode = () => {
    const chars = '0123456789ABCDEF';
    let res = 'P';
    for (let i = 0; i < 6; i++)
        res += chars[Math.floor(Math.random() * 16)];
    return res;
};
exports.generatePetCode = generatePetCode;
/**
 * Generate staff code: NV00001
 */
const generateStaffCode = (sequence) => `NV${String(sequence).padStart(5, '0')}`;
exports.generateStaffCode = generateStaffCode;
/**
 * Generate order number: DH260303S0001 (DHYYMMDDSXXXX, reset per day)
 */
const generateOrderNumber = (date, sequence) => {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const seq = String(sequence).padStart(4, '0');
    return `DH${yy}${mm}${dd}S${seq}`;
};
exports.generateOrderNumber = generateOrderNumber;
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