export type PermissionDefinition = {
  code: string
  label: string
  description?: string
}

export type PermissionGroup = {
  key: string
  label: string
  description?: string
  permissions: PermissionDefinition[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { code: 'dashboard.read', label: 'Xem tổng quan' },
      { code: 'daily_report.read', label: 'Xem báo cáo bán hàng cuối ngày' },
    ],
  },
  {
    key: 'product',
    label: 'Sản phẩm',
    permissions: [
      { code: 'product.read', label: 'Xem sản phẩm' },
      { code: 'product.create', label: 'Tạo sản phẩm' },
      { code: 'product.update', label: 'Sửa sản phẩm' },
      { code: 'product.delete', label: 'Xóa sản phẩm' },
      { code: 'product.export', label: 'Xuất file sản phẩm' },
    ],
  },
  {
    key: 'service',
    label: 'Dịch vụ',
    permissions: [
      { code: 'service.read', label: 'Xem dịch vụ' },
      { code: 'service.create', label: 'Tạo dịch vụ' },
      { code: 'service.update', label: 'Sửa dịch vụ' },
      { code: 'service.delete', label: 'Xóa dịch vụ' },
    ],
  },
  {
    key: 'supplier',
    label: 'Nhà cung cấp',
    permissions: [
      { code: 'supplier.read', label: 'Xem nhà cung cấp' },
      { code: 'supplier.create', label: 'Tạo nhà cung cấp' },
      { code: 'supplier.update', label: 'Sửa nhà cung cấp' },
      { code: 'supplier.delete', label: 'Xóa nhà cung cấp' },
    ],
  },
  {
    key: 'stock_receipt',
    label: 'Nhập hàng',
    permissions: [
      { code: 'stock_receipt.read', label: 'Xem đơn nhập' },
      { code: 'stock_receipt.create', label: 'Tạo đơn nhập' },
      { code: 'stock_receipt.update', label: 'Sửa đơn nhập' },
      { code: 'stock_receipt.pay', label: 'Thanh toán đơn nhập' },
      { code: 'stock_receipt.receive', label: 'Nhận hàng vào kho' },
      { code: 'stock_receipt.complete', label: 'Kết thúc đơn nhập' },
      { code: 'stock_receipt.cancel', label: 'Hủy đơn nhập' },
      { code: 'stock_receipt.return', label: 'Hoàn trả đơn nhập' },
      { code: 'stock_receipt.import', label: 'Nhập file đơn nhập' },
      { code: 'stock_receipt.export', label: 'Xuất file đơn nhập' },
    ],
  },
  {
    key: 'stock_transfer',
    label: 'Chuyển hàng',
    permissions: [
      { code: 'stock_transfer.read', label: 'Xem phiếu chuyển' },
      { code: 'stock_transfer.create', label: 'Tạo phiếu chuyển' },
      { code: 'stock_transfer.update', label: 'Sửa phiếu chuyển' },
      { code: 'stock_transfer.confirm', label: 'Xác nhận chuyển' },
      { code: 'stock_transfer.receive', label: 'Nhận hàng vào kho' },
      { code: 'stock_transfer.cancel', label: 'Hủy phiếu chuyển' },
      { code: 'stock_transfer.import', label: 'Nhập file phiếu chuyển' },
      { code: 'stock_transfer.export', label: 'Xuất file phiếu chuyển' },
    ],
  },
  {
    key: 'stock_audit',
    label: 'Kiểm hàng',
    permissions: [
      { code: 'stock_audit.read', label: 'Xem phiếu kiểm hàng' },
      { code: 'stock_audit.create', label: 'Tạo phiếu kiểm hàng' },
      { code: 'stock_audit.update', label: 'Sửa phiếu kiểm hàng' },
      { code: 'stock_audit.delete', label: 'Xóa phiếu kiểm hàng' },
      { code: 'stock_audit.balance', label: 'Cân bằng kho' },
      { code: 'stock_audit.import', label: 'Nhập file phiếu kiểm hàng' },
      { code: 'stock_audit.export', label: 'Xuất file phiếu kiểm hàng' },
    ],
  },
  {
    key: 'cost_adjustment',
    label: 'Điều chỉnh giá vốn',
    permissions: [
      { code: 'cost_adjustment.read', label: 'Xem phiếu điều chỉnh' },
      { code: 'cost_adjustment.create', label: 'Tạo phiếu điều chỉnh' },
      { code: 'cost_adjustment.update', label: 'Sửa phiếu điều chỉnh' },
      { code: 'cost_adjustment.apply', label: 'Điều chỉnh giá' },
    ],
  },
  {
    key: 'customer',
    label: 'Khách hàng',
    permissions: [
      { code: 'customer.read.assigned', label: 'Xem khách hàng được phụ trách' },
      { code: 'customer.read.all', label: 'Xem tất cả khách hàng' },
      { code: 'customer.create', label: 'Tạo khách hàng' },
      { code: 'customer.update', label: 'Sửa khách hàng' },
      { code: 'customer.delete', label: 'Xóa khách hàng' },
    ],
  },
  {
    key: 'pet',
    label: 'Thú cưng',
    permissions: [
      { code: 'pet.read', label: 'Xem hồ sơ thú cưng' },
      { code: 'pet.create', label: 'Tạo hồ sơ thú cưng' },
      { code: 'pet.update', label: 'Sửa hồ sơ thú cưng' },
      { code: 'pet.delete', label: 'Xóa hồ sơ thú cưng' },
    ],
  },
  {
    key: 'medical_record',
    label: 'Hồ sơ điều trị',
    permissions: [
      { code: 'medical_record.read', label: 'Xem hồ sơ điều trị' },
      { code: 'medical_record.create', label: 'Tạo hồ sơ điều trị' },
      { code: 'medical_record.update', label: 'Sửa hồ sơ điều trị' },
      { code: 'medical_record.delete', label: 'Xóa hồ sơ điều trị' },
    ],
  },
  {
    key: 'grooming',
    label: 'Spa & Grooming',
    permissions: [
      { code: 'grooming.read', label: 'Xem lịch spa' },
      { code: 'grooming.create', label: 'Tạo lịch spa' },
      { code: 'grooming.update', label: 'Sửa lịch spa' },
      { code: 'grooming.start', label: 'Bắt đầu phiên spa' },
      { code: 'grooming.complete', label: 'Hoàn thành phiên spa' },
      { code: 'grooming.cancel', label: 'Hủy phiên spa' },
    ],
  },
  {
    key: 'hotel',
    label: 'Lưu trú',
    permissions: [
      { code: 'hotel.read', label: 'Xem lưu trú' },
      { code: 'hotel.create', label: 'Tạo lưu trú' },
      { code: 'hotel.update', label: 'Sửa lưu trú' },
      { code: 'hotel.checkin', label: 'Check-in lưu trú' },
      { code: 'hotel.checkout', label: 'Check-out lưu trú' },
      { code: 'hotel.cancel', label: 'Hủy lưu trú' },
    ],
  },
  {
    key: 'order',
    label: 'Đơn hàng',
    permissions: [
      { code: 'order.read.assigned', label: 'Xem đơn hàng được phụ trách' },
      { code: 'order.read.all', label: 'Xem tất cả đơn hàng' },
      { code: 'order.create', label: 'Tạo đơn hàng' },
      { code: 'order.update', label: 'Sửa đơn hàng' },
      { code: 'order.approve', label: 'Duyệt đơn hàng' },
      { code: 'order.cancel', label: 'Hủy đơn hàng' },
      { code: 'order.ship', label: 'Đóng gói và giao hàng' },
      { code: 'order.pay', label: 'Thanh toán đơn hàng' },
    ],
  },
  {
    key: 'order_return',
    label: 'Đơn trả hàng',
    permissions: [
      { code: 'order_return.read', label: 'Xem đơn trả hàng' },
      { code: 'order_return.create', label: 'Tạo đơn trả hàng' },
      { code: 'order_return.cancel', label: 'Hủy đơn trả hàng' },
      { code: 'order_return.receive', label: 'Nhận hàng vào kho' },
      { code: 'order_return.pay', label: 'Thanh toán đơn trả' },
    ],
  },
  {
    key: 'shipping_reconciliation',
    label: 'Đối soát vận chuyển',
    permissions: [
      { code: 'shipping_reconciliation.read', label: 'Xem phiếu đối soát' },
      { code: 'shipping_reconciliation.create', label: 'Tạo phiếu đối soát' },
      { code: 'shipping_reconciliation.update', label: 'Sửa phiếu đối soát' },
      { code: 'shipping_reconciliation.confirm', label: 'Xác nhận đối soát' },
      { code: 'shipping_reconciliation.cancel', label: 'Hủy phiếu đối soát' },
      { code: 'shipping_reconciliation.pay', label: 'Thanh toán đối soát' },
      { code: 'shipping_reconciliation.import', label: 'Nhập file phiếu đối soát' },
      { code: 'shipping_reconciliation.export', label: 'Xuất file phiếu đối soát' },
    ],
  },
  {
    key: 'shipping_partner',
    label: 'Đối tác vận chuyển',
    permissions: [
      { code: 'shipping_partner.read', label: 'Xem đối tác vận chuyển' },
      { code: 'shipping_partner.create', label: 'Tạo đối tác vận chuyển' },
      { code: 'shipping_partner.update', label: 'Sửa đối tác vận chuyển' },
      { code: 'shipping_partner.delete', label: 'Xóa đối tác vận chuyển' },
    ],
  },
  {
    key: 'receipt',
    label: 'Phiếu thu',
    permissions: [
      { code: 'receipt.read', label: 'Xem phiếu thu' },
      { code: 'receipt.create', label: 'Tạo phiếu thu' },
      { code: 'receipt.update', label: 'Sửa phiếu thu' },
      { code: 'receipt.cancel', label: 'Hủy phiếu thu' },
    ],
  },
  {
    key: 'receipt_type',
    label: 'Loại phiếu thu',
    permissions: [
      { code: 'receipt_type.read', label: 'Xem loại phiếu thu' },
      { code: 'receipt_type.create', label: 'Tạo loại phiếu thu' },
      { code: 'receipt_type.update', label: 'Sửa loại phiếu thu' },
      { code: 'receipt_type.delete', label: 'Xóa loại phiếu thu' },
    ],
  },
  {
    key: 'payment',
    label: 'Phiếu chi',
    permissions: [
      { code: 'payment.read', label: 'Xem phiếu chi' },
      { code: 'payment.create', label: 'Tạo phiếu chi' },
      { code: 'payment.update', label: 'Sửa phiếu chi' },
      { code: 'payment.cancel', label: 'Hủy phiếu chi' },
    ],
  },
  {
    key: 'payment_type',
    label: 'Loại phiếu chi',
    permissions: [
      { code: 'payment_type.read', label: 'Xem loại phiếu chi' },
      { code: 'payment_type.create', label: 'Tạo loại phiếu chi' },
      { code: 'payment_type.update', label: 'Sửa loại phiếu chi' },
      { code: 'payment_type.delete', label: 'Xóa loại phiếu chi' },
    ],
  },
  {
    key: 'report',
    label: 'Báo cáo',
    permissions: [
      { code: 'report.sales', label: 'Báo cáo bán hàng' },
      { code: 'report.inventory', label: 'Báo cáo kho' },
      { code: 'report.purchase', label: 'Báo cáo nhập hàng' },
      { code: 'report.profit', label: 'Báo cáo lãi lỗ' },
      { code: 'report.customer', label: 'Báo cáo khách hàng' },
      { code: 'report.debt', label: 'Báo cáo công nợ khách hàng/nhà cung cấp' },
      { code: 'report.cashbook', label: 'Sổ quỹ' },
    ],
  },
  {
    key: 'branch',
    label: 'Chi nhánh',
    permissions: [
      { code: 'branch.read', label: 'Xem chi nhánh' },
      { code: 'branch.create', label: 'Tạo chi nhánh' },
      { code: 'branch.update', label: 'Sửa chi nhánh' },
      { code: 'branch.delete', label: 'Xóa chi nhánh' },
      { code: 'branch.access.all', label: 'Toàn quyền tất cả chi nhánh' },
    ],
  },
  {
    key: 'staff',
    label: 'Nhân viên',
    permissions: [
      { code: 'staff.read', label: 'Xem nhân viên' },
      { code: 'staff.create', label: 'Tạo nhân viên' },
      { code: 'staff.update', label: 'Sửa nhân viên' },
      { code: 'staff.deactivate', label: 'Đình chỉ nhân viên' },
    ],
  },
  {
    key: 'role',
    label: 'Vai trò & Phân quyền',
    permissions: [
      { code: 'role.read', label: 'Xem vai trò' },
      { code: 'role.create', label: 'Tạo vai trò' },
      { code: 'role.update', label: 'Sửa vai trò' },
      { code: 'role.delete', label: 'Xóa vai trò' },
    ],
  },
  {
    key: 'settings_app',
    label: 'Cấu hình và ứng dụng',
    permissions: [
      { code: 'settings.app.read', label: 'Xem cấu hình ứng dụng' },
      { code: 'settings.app.update', label: 'Cập nhật cấu hình ứng dụng' },
      { code: 'settings.audit_log.read', label: 'Xem nhật ký hoạt động' },
      { code: 'settings.pricing_policy.manage', label: 'Quản lý chính sách giá' },
      { code: 'settings.payment.manage', label: 'Quản lý cấu hình thanh toán' },
      { code: 'settings.template.manage', label: 'Quản lý mẫu in' },
      { code: 'settings.order_flow.manage', label: 'Quản lý trạng thái xử lý đơn hàng' },
      { code: 'settings.return_reason.manage', label: 'Quản lý lý do hủy trả' },
    ],
  },
  {
    key: 'sales_channel',
    label: 'Kênh bán hàng',
    permissions: [
      { code: 'sales_channel.pos', label: 'Sapo POS - Bán hàng tại quầy' },
      { code: 'sales_channel.web', label: 'Sapo Web - Bán hàng qua website' },
      { code: 'sales_channel.social', label: 'Kênh Social' },
      { code: 'sales_channel.online_order', label: 'Kênh đặt hàng online' },
      { code: 'sales_channel.marketplace', label: 'Sàn thương mại điện tử' },
      { code: 'sales_channel.grabmart', label: 'Kênh GrabMart' },
    ],
  },
  {
    key: 'promotion',
    label: 'Khuyến mại',
    permissions: [
      { code: 'promotion.config', label: 'Cấu hình khuyến mại' },
      { code: 'promotion.read', label: 'Xem chương trình khuyến mại' },
      { code: 'promotion.create', label: 'Tạo chương trình khuyến mại' },
      { code: 'promotion.update', label: 'Sửa chương trình khuyến mại' },
    ],
  },
  {
    key: 'loyalty',
    label: 'Thiết lập Loyalty',
    permissions: [
      { code: 'loyalty.manage', label: 'Thiết lập Loyalty' },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    permissions: [
      { code: 'marketing.manage', label: 'Quản lý marketing' },
    ],
  },
  {
    key: 'warranty_policy',
    label: 'Chính sách bảo hành',
    permissions: [
      { code: 'warranty_policy.read', label: 'Xem chính sách bảo hành' },
      { code: 'warranty_policy.update', label: 'Cập nhật chính sách bảo hành' },
    ],
  },
  {
    key: 'warranty_ticket',
    label: 'Phiếu bảo hành',
    permissions: [
      { code: 'warranty_ticket.read', label: 'Xem phiếu bảo hành' },
      { code: 'warranty_ticket.create', label: 'Tạo phiếu bảo hành' },
      { code: 'warranty_ticket.update', label: 'Sửa phiếu bảo hành' },
      { code: 'warranty_ticket.close', label: 'Kết thúc phiếu bảo hành' },
    ],
  },
  {
    key: 'warranty_request',
    label: 'Phiếu yêu cầu bảo hành',
    permissions: [
      { code: 'warranty_request.read', label: 'Xem yêu cầu bảo hành' },
      { code: 'warranty_request.create', label: 'Tạo yêu cầu bảo hành' },
      { code: 'warranty_request.update', label: 'Sửa yêu cầu bảo hành' },
      { code: 'warranty_request.approve', label: 'Duyệt yêu cầu bảo hành' },
      { code: 'warranty_request.close', label: 'Kết thúc yêu cầu bảo hành' },
    ],
  },
  {
    key: 'invoice',
    label: 'Hóa đơn điện tử',
    permissions: [
      { code: 'invoice.electronic.manage', label: 'Quản lý hóa đơn điện tử' },
    ],
  },
]

export const LEGACY_PERMISSION_ALIASES: Record<string, string[]> = {
  VIEW_DASHBOARD: ['dashboard.read'],
  MANAGE_STAFF: ['staff.read', 'staff.create', 'staff.update', 'staff.deactivate'],
  MANAGE_USERS: ['staff.read', 'staff.create', 'staff.update', 'staff.deactivate'],
  MANAGE_ROLES: ['role.read', 'role.create', 'role.update', 'role.delete'],
  MANAGE_BRANCHES: ['branch.read', 'branch.create', 'branch.update', 'branch.delete'],
  MANAGE_SETTINGS: [
    'settings.app.read',
    'settings.app.update',
    'settings.audit_log.read',
    'settings.pricing_policy.manage',
    'settings.payment.manage',
    'settings.template.manage',
    'settings.order_flow.manage',
    'settings.return_reason.manage',
  ],
  MANAGE_PRODUCTS: ['product.read', 'product.create', 'product.update', 'product.delete', 'product.export'],
  MANAGE_SERVICES: ['service.read', 'service.create', 'service.update', 'service.delete'],
  MANAGE_VACCINES: ['service.read', 'service.create', 'service.update', 'service.delete'],
  MANAGE_PETS: ['pet.read', 'pet.create', 'pet.update', 'pet.delete'],
  MANAGE_CUSTOMERS: ['customer.read.all', 'customer.create', 'customer.update', 'customer.delete'],
  MANAGE_ORDERS: [
    'order.read.all',
    'order.create',
    'order.update',
    'order.approve',
    'order.cancel',
    'order.ship',
    'order.pay',
    'order_return.read',
    'order_return.create',
    'order_return.cancel',
    'order_return.receive',
    'order_return.pay',
  ],
  MANAGE_BILLS: [
    'receipt.read',
    'receipt.create',
    'receipt.update',
    'receipt.cancel',
    'payment.read',
    'payment.create',
    'payment.update',
    'payment.cancel',
  ],
  MANAGE_MEDICAL_RECORDS: ['medical_record.read', 'medical_record.create', 'medical_record.update', 'medical_record.delete'],
  MANAGE_APPOINTMENTS: ['grooming.read', 'grooming.create', 'grooming.update', 'hotel.read', 'hotel.create', 'hotel.update'],
  VIEW_FINANCIAL_REPORTS: ['report.sales', 'report.inventory', 'report.purchase', 'report.profit', 'report.customer', 'report.debt', 'report.cashbook'],
  FULL_BRANCH_ACCESS: ['branch.access.all'],
}

export const ALL_PERMISSION_CODES = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.code),
)

export const KNOWN_PERMISSION_CODES = [...new Set([...ALL_PERMISSION_CODES, ...Object.keys(LEGACY_PERMISSION_ALIASES)])]

export function isKnownPermission(code: string): boolean {
  return KNOWN_PERMISSION_CODES.includes(code)
}

export function expandPermissionCodes(codes: string[]): string[] {
  const resolved = new Set<string>()
  const visit = (code: string) => {
    if (resolved.has(code)) return
    resolved.add(code)
    for (const child of LEGACY_PERMISSION_ALIASES[code] ?? []) {
      visit(child)
    }
  }

  for (const code of codes) {
    visit(code)
  }

  return [...resolved]
}

