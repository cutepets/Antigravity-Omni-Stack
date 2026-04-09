"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOYALTY_POINTS_RATE = exports.LOW_STOCK_THRESHOLD_DEFAULT = exports.SERVICE_TYPE_LABELS = exports.STAFF_ROLE_LABELS = exports.CUSTOMER_TIER_LABELS = exports.PAYMENT_STATUS_LABELS = exports.ORDER_STATUS_LABELS = exports.PAYMENT_METHODS = void 0;
exports.PAYMENT_METHODS = [
    { key: 'CASH', label: 'Tiền mặt' },
    { key: 'BANK', label: 'Chuyển khoản' },
    { key: 'MOMO', label: 'MoMo' },
    { key: 'VNPAY', label: 'VNPay' },
    { key: 'CARD', label: 'Thẻ' },
    { key: 'POINTS', label: 'Điểm' },
];
exports.ORDER_STATUS_LABELS = {
    PENDING: 'Chờ xử lý',
    CONFIRMED: 'Đã xác nhận',
    PROCESSING: 'Đang xử lý',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    REFUNDED: 'Đã hoàn tiền',
};
exports.PAYMENT_STATUS_LABELS = {
    UNPAID: 'Chưa thanh toán',
    PARTIAL: 'Thanh toán một phần',
    PAID: 'Đã thanh toán',
    COMPLETED: 'Hoàn tất',
    REFUNDED: 'Đã hoàn tiền',
};
exports.CUSTOMER_TIER_LABELS = {
    BRONZE: 'Đồng',
    SILVER: 'Bạc',
    GOLD: 'Vàng',
    PLATINUM: 'Bạch kim',
    DIAMOND: 'Kim cương',
};
exports.STAFF_ROLE_LABELS = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Quản trị viên',
    MANAGER: 'Quản lý',
    STAFF: 'Nhân viên',
    VIEWER: 'Xem',
};
exports.SERVICE_TYPE_LABELS = {
    GROOMING: 'Grooming',
    HOTEL: 'Khách sạn',
    MEDICAL: 'Y tế',
    TRAINING: 'Đào tạo',
    DAYCARE: 'Giữ ban ngày',
    OTHER: 'Khác',
};
exports.LOW_STOCK_THRESHOLD_DEFAULT = 5;
exports.LOYALTY_POINTS_RATE = 0.01; // 1% of order total = points
