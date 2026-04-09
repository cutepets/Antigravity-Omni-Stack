"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidBranchCode = exports.suggestBranchCodeFromName = exports.normalizeBranchCode = void 0;
const BRANCH_CODE_RE = /[^A-Z0-9]/g;
const removeAccents = (value) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
const normalizeBranchCode = (value) => removeAccents(value)
    .toUpperCase()
    .replace(BRANCH_CODE_RE, '')
    .slice(0, 4);
exports.normalizeBranchCode = normalizeBranchCode;
const suggestBranchCodeFromName = (name) => {
    const sanitized = removeAccents(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (sanitized.length === 0)
        return '';
    const initials = sanitized
        .map((part) => part.charAt(0))
        .join('');
    const normalizedInitials = (0, exports.normalizeBranchCode)(initials);
    if (normalizedInitials.length >= 2)
        return normalizedInitials;
    return (0, exports.normalizeBranchCode)(sanitized.join('')).slice(0, 4);
};
exports.suggestBranchCodeFromName = suggestBranchCodeFromName;
const isValidBranchCode = (value) => /^[A-Z0-9]{2,4}$/.test((0, exports.normalizeBranchCode)(value));
exports.isValidBranchCode = isValidBranchCode;
