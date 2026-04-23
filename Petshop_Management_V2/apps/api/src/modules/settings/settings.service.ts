import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { StorageProviderKind } from '@prisma/client'
import { DatabaseService } from '../../database/database.service.js'
import { createHash, randomBytes, randomUUID } from 'crypto'
import { isValidBranchCode, normalizeBranchCode, suggestBranchCodeFromName } from '@petshop/shared'
import { encryptSecret } from '../../common/utils/secret-box.util.js'

export interface CreateBranchDto {
  code?: string
  name: string
  address?: string
  phone?: string
  isActive?: boolean
  cashReserveTargetAmount?: number
}

export interface UpdateBranchDto extends Partial<CreateBranchDto> { }

export interface UpdateConfigDto {
  shopName?: string
  shopPhone?: string
  shopAddress?: string
  shopLogo?: string
  email?: string
  website?: string
  taxRate?: number
  currency?: string
  timezone?: string
  loyaltySpendPerPoint?: number
  loyaltyPointValue?: number
  loyaltyPointExpiryMonths?: number
  loyaltyTierRetentionMonths?: number
  loyaltyTierRules?: string
  storageProvider?: StorageProviderKind
  googleAuthEnabled?: boolean
  googleAuthClientId?: string
  googleAuthClientSecret?: string | null
  googleAuthAllowedDomain?: string | null
  googleDriveEnabled?: boolean
  googleDriveServiceAccountJson?: string | null
  googleDriveClientEmail?: string | null
  googleDriveSharedDriveId?: string | null
  googleDriveRootFolderId?: string | null
  googleDriveImageFolderId?: string | null
  googleDriveDocumentFolderId?: string | null
  googleDriveBackupFolderId?: string | null
  petBreedsV2?: string
  petTemperaments?: string
  petVaccineOpts?: string
}

export interface UpdatePrintTemplateDto {
  content: string
  paperSize: string
}

export type CashbookCategoryType = 'INCOME' | 'EXPENSE'

export interface CreateCashbookCategoryDto {
  type: CashbookCategoryType
  name: string
  isActive?: boolean
  sortOrder?: number
}

export interface UpdateCashbookCategoryDto {
  name?: string
  isActive?: boolean
  sortOrder?: number
}

export type PaymentMethodType = 'CASH' | 'BANK' | 'EWALLET' | 'CARD'
export type PaymentMethodColorKey = 'emerald' | 'sky' | 'amber' | 'orange' | 'violet' | 'rose' | 'cyan' | 'slate'
export type PaymentQrProvider = 'VIETQR'

export interface CreatePaymentMethodDto {
  name: string
  type: PaymentMethodType
  colorKey?: PaymentMethodColorKey | null
  isDefault?: boolean
  isActive?: boolean
  sortOrder?: number
  minAmount?: number | null
  maxAmount?: number | null
  timeFrom?: string | null
  timeTo?: string | null
  weekdays?: number[]
  branchIds?: string[]
  notes?: string | null
  bankName?: string | null
  accountNumber?: string | null
  accountHolder?: string | null
  qrEnabled?: boolean
  qrProvider?: PaymentQrProvider | null
  qrBankBin?: string | null
  qrTemplate?: string | null
  transferNotePrefix?: string | null
}

export interface UpdatePaymentMethodDto extends Partial<CreatePaymentMethodDto> { }

export interface UpdatePaymentOptionsDto {
  allowMultiPayment?: boolean
}

export interface CreatePaymentWebhookSecretDto {
  name: string
  provider: string
}

export interface TestPaymentWebhookDto {
  provider: string
  payload: Record<string, unknown>
}

export interface CreateBankTransferAccountDto {
  name: string
  bankName: string
  accountNumber: string
  accountHolder: string
  notes?: string
  isDefault?: boolean
  isActive?: boolean
}

export interface UpdateBankTransferAccountDto {
  name?: string
  bankName?: string
  accountNumber?: string
  accountHolder?: string
  notes?: string | null
  isDefault?: boolean
  isActive?: boolean
}

const DEFAULT_TEMPLATES = [
  {
    type: 'pos_receipt_k80',
    name: 'Mẫu in bán hàng',
    paperSize: 'k80',
    content: `<div class="p-4 text-sm font-mono max-w-[80mm] mx-auto text-black">
  <div class="text-center font-bold text-xl mb-1">{{shopName}}</div>
  <div class="text-center mb-1">Đ/c: {{shopAddress}}</div>
  <div class="text-center mb-3 border-b border-dashed border-gray-400 pb-2">ĐT: {{shopPhone}}</div>
  
  <div class="text-center font-bold text-lg mb-2">HÓA ĐƠN BÁN HÀNG</div>
  <div class="mb-2">Mã HĐ: {{orderCode}}</div>
  <div class="mb-2">Ngày: {{orderDate}}</div>
  
  <table class="w-full mb-3 text-sm">
    <thead>
      <tr class="border-b border-dashed border-gray-400">
        <th class="text-left py-1">SP</th>
        <th class="text-right py-1 w-12">SL</th>
        <th class="text-right py-1 w-20">TTien</th>
      </tr>
    </thead>
    <tbody>
      {{items_html}}
    </tbody>
  </table>
  
  <div class="border-t border-dashed border-gray-400 pt-2 mb-1 flex justify-between">
    <span>Tổng tiền:</span>
    <span class="font-bold">{{totalAmount}}</span>
  </div>
  <div class="flex justify-between">
    <span>Chiết khấu:</span>
    <span>{{discountAmount}}</span>
  </div>
  <div class="border-t border-dashed border-gray-400 mt-2 pt-2 mb-4 flex justify-between font-bold text-lg">
    <span>Thanh toán:</span>
    <span>{{finalAmount}}</span>
  </div>
  
  <div class="text-center mb-1 text-xs">Cảm ơn quý khách và hẹn gặp lại!</div>
  <div class="text-center text-xs text-gray-500 italic">Wifi: Nhap pass wifi</div>
</div>`,
  },
  {
    type: 'inventory_receipt_a4',
    name: 'Mẫu phiếu nhập kho',
    paperSize: 'a4',
    content: `<div class="p-8 font-sans max-w-[210mm] mx-auto text-black">
  <div class="flex justify-between items-start mb-6">
    <div>
      <div class="font-bold text-2xl uppercase">{{shopName}}</div>
      <div>{{shopAddress}}</div>
      <div>{{shopPhone}}</div>
    </div>
    <div class="text-right">
      <div class="font-bold text-2xl text-gray-700">PHIẾU NHẬP KHO</div>
      <div class="text-gray-500">Mã: {{receiptCode}}</div>
      <div class="text-gray-500">Ngày: {{receiptDate}}</div>
    </div>
  </div>
  
  <div class="mb-6 grid grid-cols-2 gap-4">
    <div>
      <div><strong>Nhà cung cấp:</strong> {{supplierName}}</div>
      <div><strong>Người giao:</strong> {{delivererName}}</div>
    </div>
    <div>
      <div><strong>Người nhận:</strong> {{receiverName}}</div>
      <div><strong>Ghi chú:</strong> {{notes}}</div>
    </div>
  </div>
  
  <table class="w-full border-collapse border border-gray-800 mb-6">
    <thead class="bg-gray-100">
      <tr>
        <th class="border border-gray-800 px-3 py-2 text-left w-12">STT</th>
        <th class="border border-gray-800 px-3 py-2 text-left">Sản phẩm</th>
        <th class="border border-gray-800 px-3 py-2 text-right">SL</th>
        <th class="border border-gray-800 px-3 py-2 text-right">Đơn giá</th>
        <th class="border border-gray-800 px-3 py-2 text-right">Thành tiền</th>
      </tr>
    </thead>
    <tbody>
      {{items_html}}
    </tbody>
  </table>
  
  <div class="flex justify-end mb-16">
    <div class="w-64 text-right">
      <div class="flex justify-between mb-2">
        <span class="font-bold">Tổng cộng:</span>
        <span class="font-bold text-lg">{{totalAmount}}</span>
      </div>
    </div>
  </div>
  
  <div class="grid grid-cols-3 text-center">
    <div>
      <div class="font-bold mb-16">Người giao hàng</div>
      <div>(Ký, ghi rõ họ tên)</div>
    </div>
    <div>
      <div class="font-bold mb-16">Người nhận</div>
      <div>(Ký, ghi rõ họ tên)</div>
    </div>
    <div>
      <div class="font-bold mb-16">Thủ kho</div>
      <div>(Ký, ghi rõ họ tên)</div>
    </div>
  </div>
</div>`,
  },
  {
    type: 'grooming',
    name: 'Phiếu Grooming & Spa',
    paperSize: 'a4',
    content: `<div style="font-family:Arial,sans-serif;font-size:12px;color:#111;max-width:210mm;margin:0 auto;padding:20px">
  <div style="text-align:center;padding-bottom:12px;border-bottom:2px solid #667eea;margin-bottom:14px">
    <div style="font-size:20px;font-weight:800;color:#667eea">{{shopName}}</div>
    <div style="font-size:11px;color:#555">{{shopAddress}}</div>
    <div style="font-size:11px;color:#555">ĐT: {{shopPhone}}</div>
  </div>
  <div style="margin-bottom:14px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#667eea;margin-bottom:6px;padding-bottom:2px;border-bottom:1px solid #e5e7eb">Thông tin phiếu</div>
    <div><span style="color:#888;display:inline-block;width:90px">Mã phiếu:</span><span style="font-weight:600">{{sessionCode}}</span></div>
    <div><span style="color:#888;display:inline-block;width:90px">Trạng thái:</span><span style="font-weight:700;color:{{statusColor}}">{{status}}</span></div>
    <div><span style="color:#888;display:inline-block;width:90px">Ngày lập:</span><span style="font-weight:600">{{createdAt}}</span></div>
    <div><span style="color:#888;display:inline-block;width:90px">Bắt đầu:</span><span style="font-weight:600">{{startTime}}</span></div>
    <div><span style="color:#888;display:inline-block;width:90px">Chi nhánh:</span><span style="font-weight:600">{{branchName}}</span></div>
    <div><span style="color:#888;display:inline-block;width:90px">Nhân viên:</span><span style="font-weight:600">{{staffNames}}</span></div>
  </div>
  <div style="margin-bottom:14px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#667eea;margin-bottom:6px;padding-bottom:2px;border-bottom:1px solid #e5e7eb">Thú cưng & Khách hàng</div>
    <div><span style="color:#888;display:inline-block;width:90px">Thú cưng:</span><span style="font-weight:600">{{petName}}</span></div>
    <div><span style="color:#888;display:inline-block;width:90px">Mã thú:</span><span style="font-weight:600">{{petCode}}</span></div>
    <div><span style="color:#888;display:inline-block;width:90px">Khách hàng:</span><span style="font-weight:600">{{customerName}}</span></div>
    <div><span style="color:#888;display:inline-block;width:90px">SĐT:</span><span style="font-weight:600">{{customerPhone}}</span></div>
  </div>
  <div style="margin-bottom:14px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#667eea;margin-bottom:6px;padding-bottom:2px;border-bottom:1px solid #e5e7eb">Dịch vụ</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:5px 8px;text-align:left;font-size:11px;border-bottom:2px solid #d1d5db">Dịch vụ</th>
        <th style="padding:5px 8px;text-align:center;font-size:11px;border-bottom:2px solid #d1d5db">SL</th>
        <th style="padding:5px 8px;text-align:right;font-size:11px;border-bottom:2px solid #d1d5db">Đơn giá</th>
        <th style="padding:5px 8px;text-align:right;font-size:11px;border-bottom:2px solid #d1d5db">Thành tiền</th>
      </tr></thead>
      <tbody>{{extra_items_html}}</tbody>
    </table>
    <div style="margin-left:auto;width:200px">
      <div style="display:flex;justify-content:space-between;padding:2px 4px"><span>Dịch vụ chính:</span><span style="font-weight:600">{{mainPrice}}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 4px"><span>Dịch vụ bổ sung:</span><span style="font-weight:600">{{extraTotal}}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 4px 2px;border-top:2px solid #111;font-size:14px;font-weight:800"><span>Tổng cộng:</span><span>{{totalPrice}}</span></div>
    </div>
  </div>
  <div style="text-align:center;font-size:11px;color:#999;padding-top:10px;border-top:1px dashed #ccc;margin-top:14px">
    <div>Cảm ơn quý khách đã tin tưởng dịch vụ!</div>
    <div>In lúc: {{printTime}}</div>
  </div>
</div>`,
  },
  {
    type: 'spa_receipt_k80',
    name: 'Mẫu SPA & Grooming',
    paperSize: 'k80',
    content: `<div class="p-4 text-sm font-mono max-w-[80mm] mx-auto text-black">
  <div class="text-center font-bold text-xl mb-1">{{shopName}}</div>
  <div class="text-center mb-1">Đ/c: {{shopAddress}}</div>
  <div class="text-center mb-3 border-b border-dashed border-gray-400 pb-2">ĐT: {{shopPhone}}</div>
  
  <div class="text-center font-bold text-lg mb-2">PHIẾU DỊCH VỤ SPA</div>
  <div class="mb-1"><strong>Mã phiếu:</strong> {{receiptCode}}</div>
  <div class="mb-1"><strong>Khách hàng:</strong> {{customerName}}</div>
  <div class="mb-2"><strong>Thú cưng:</strong> {{petName}} ({{petBreed}} - {{petWeight}})</div>
  <div class="mb-2">Ngày thực hiện: {{serviceDate}}</div>
  
  <table class="w-full mb-3 text-sm">
    <thead>
      <tr class="border-b border-dashed border-gray-400">
        <th class="text-left py-1">Dịch vụ</th>
        <th class="text-right py-1 w-20">TTien</th>
      </tr>
    </thead>
    <tbody>
      {{services_html}}
    </tbody>
  </table>
  
  <div class="border-t border-dashed border-gray-400 pt-2 mb-1 flex justify-between">
    <span>Cộng:</span>
    <span class="font-bold">{{totalAmount}}</span>
  </div>
  <div class="flex justify-between">
    <span>Chiết khấu/Voucher:</span>
    <span>{{discountAmount}}</span>
  </div>
  <div class="border-t border-dashed border-gray-400 mt-2 pt-2 mb-4 flex justify-between font-bold text-lg">
    <span>Thanh toán:</span>
    <span>{{finalAmount}}</span>
  </div>
  
  <div class="text-center mb-1 text-xs font-bold">Lưu ý sau khi Spa:</div>
  <div class="text-xs mb-3 text-justify">Vui lòng theo dõi bé trong 24h đầu. Không nên tắm ngay sau khi về hoặc thay đổi thức ăn quá đột ngột.</div>
  
  <div class="text-center mb-1 text-xs">Cảm ơn quý khách và hẹn gặp lại!</div>
</div>`,
  },
  {
    type: 'hotel_receipt_k80',
    name: 'Mẫu Khách sạn',
    paperSize: 'k80',
    content: `<div class="p-4 text-sm font-mono max-w-[80mm] mx-auto text-black">
  <div class="text-center font-bold text-xl mb-1">{{shopName}}</div>
  <div class="text-center mb-1">Đ/c: {{shopAddress}}</div>
  <div class="text-center mb-3 border-b border-dashed border-gray-400 pb-2">ĐT: {{shopPhone}}</div>
  
  <div class="text-center font-bold text-lg mb-2">PHIẾU LƯU CHUỒNG (HOTEL)</div>
  <div class="mb-1"><strong>Mã phiếu:</strong> {{receiptCode}}</div>
  <div class="mb-1"><strong>Khách hàng:</strong> {{customerName}}</div>
  <div class="mb-2"><strong>Thú cưng:</strong> {{petName}} ({{petBreed}})</div>
  
  <div class="border-t border-b border-dashed border-gray-400 py-2 mb-3">
    <div class="flex justify-between mb-1">
      <span>Check-in:</span>
      <span>{{checkInDate}}</span>
    </div>
    <div class="flex justify-between mb-1">
      <span>Check-out:</span>
      <span>{{checkOutDate}}</span>
    </div>
    <div class="flex justify-between font-bold">
      <span>Số ngày/đêm:</span>
      <span>{{totalDuration}}</span>
    </div>
  </div>
  
  <table class="w-full mb-3 text-sm">
    <thead>
      <tr class="border-b border-dashed border-gray-400">
        <th class="text-left py-1">Hạng phong</th>
        <th class="text-right py-1 w-20">TTien</th>
      </tr>
    </thead>
    <tbody>
      {{rooms_html}}
    </tbody>
  </table>
  
  <div class="border-t border-dashed border-gray-400 pt-2 mb-1 flex justify-between">
    <span>Tạm tính:</span>
    <span class="font-bold">{{totalAmount}}</span>
  </div>
  <div class="flex justify-between mb-1">
    <span>Phụ phí:</span>
    <span>{{surchargeAmount}}</span>
  </div>
  <div class="border-t border-dashed border-gray-400 mt-2 pt-2 mb-4 flex justify-between font-bold text-lg">
    <span>Tổng phải thu:</span>
    <span>{{finalAmount}}</span>
  </div>
  
  <div class="text-center mb-1 text-xs">Cảm ơn quý khách và hẹn gặp lại!</div>
</div>`,
  },
  {
    type: 'cashbook_receipt_k80',
    name: 'Mẫu Sổ quỹ',
    paperSize: 'k80',
    content: `<div class="p-4 text-sm font-mono max-w-[80mm] mx-auto text-black">
  <div class="text-center font-bold text-xl mb-1">{{shopName}}</div>
  <div class="text-center mb-1">Đ/c: {{shopAddress}}</div>
  <div class="text-center mb-3 border-b border-dashed border-gray-400 pb-2">ĐT: {{shopPhone}}</div>
  
  <div class="text-center font-bold text-lg mb-2 uppercase">{{invoiceTitle}}</div>
  <div class="mb-1"><strong>Mã phiếu:</strong> {{transactionCode}}</div>
  <div class="mb-1"><strong>Ngày:</strong> {{transactionDate}}</div>
  <div class="mb-2"><strong>Loại chi:</strong> {{transactionType}}</div>
  
  <div class="border-t border-b border-dashed border-gray-400 py-2 mb-3">
    <div class="flex justify-between mb-1">
      <span>Đối tượng:</span>
      <span class="font-bold text-right">{{targetName}}</span>
    </div>
    <div class="flex justify-between mb-1">
      <span>Danh mục:</span>
      <span class="text-right">{{categoryName}}</span>
    </div>
    <div class="flex justify-between mb-1">
      <span>Phương thức:</span>
      <span class="text-right">{{paymentMethod}}</span>
    </div>
  </div>
  
  <div class="mb-3">
    <div class="font-bold mb-1">Nội dung:</div>
    <div>{{notes}}</div>
  </div>
  
  <div class="border-t border-dashed border-gray-400 mt-2 pt-2 mb-4 flex justify-between font-bold text-lg">
    <span>Số tiền:</span>
    <span>{{amount}}</span>
  </div>
  
  <div class="flex justify-between text-center text-xs mt-6 mb-16">
    <div class="w-1/2">
      <div class="font-bold">Người nộp/nhận</div>
      <div class="italic">(Ký, ghi rõ họ tên)</div>
    </div>
    <div class="w-1/2">
      <div class="font-bold">Thủ quỹ</div>
      <div class="italic">(Ký, ghi rõ họ tên)</div>
    </div>
  </div>
</div>`,
  },
]

@Injectable()
export class SettingsService {
  constructor(private readonly db: DatabaseService) { }

  private normalizeCashbookCategoryType(type?: string | null): CashbookCategoryType {
    const normalized = String(type ?? '').trim().toUpperCase()

    if (normalized === 'INCOME' || normalized === 'EXPENSE') {
      return normalized
    }

    throw new BadRequestException('Loai danh muc so quy khong hop le')
  }

  private normalizeCashbookCategoryName(name?: string | null) {
    const normalized = String(name ?? '').trim()
    if (!normalized) {
      throw new BadRequestException('Ten danh muc khong duoc de trong')
    }

    return normalized
  }

  private normalizeBankTransferText(value: string | null | undefined, label: string) {
    const normalized = String(value ?? '').trim()
    if (!normalized) {
      throw new BadRequestException(`${label} khong duoc de trong`)
    }

    return normalized
  }

  private normalizeBankTransferAccountNumber(value: string | null | undefined) {
    const normalized = String(value ?? '').replace(/\s+/g, '')
    if (!/^\d{6,25}$/.test(normalized)) {
      throw new BadRequestException('So tai khoan khong hop le')
    }

    return normalized
  }

  private normalizeBankTransferNotes(value?: string | null) {
    const normalized = String(value ?? '').trim()
    return normalized ? normalized : null
  }

  private normalizeBranchCashReserveTargetAmount(value?: number | null) {
    if (value === undefined || value === null) return undefined
    const normalized = Math.round(Number(value))
    if (!Number.isFinite(normalized) || normalized < 0) {
      throw new BadRequestException('Muc ton ket khong hop le')
    }

    return normalized
  }

  private normalizePaymentMethodType(type?: string | null): PaymentMethodType {
    const normalized = String(type ?? '').trim().toUpperCase()
    if (normalized === 'CASH' || normalized === 'BANK' || normalized === 'EWALLET' || normalized === 'CARD') {
      return normalized
    }

    throw new BadRequestException('Loai thanh toan khong hop le')
  }

  private normalizePaymentMethodName(name?: string | null) {
    const normalized = String(name ?? '').trim()
    if (!normalized) {
      throw new BadRequestException('Ten phuong thuc thanh toan khong duoc de trong')
    }

    return normalized
  }

  private getDefaultPaymentMethodColor(type: PaymentMethodType): PaymentMethodColorKey {
    if (type === 'CASH') return 'emerald'
    if (type === 'BANK') return 'sky'
    if (type === 'EWALLET') return 'orange'
    return 'violet'
  }

  private normalizePaymentMethodColorKey(type: PaymentMethodType, value?: string | null): PaymentMethodColorKey {
    const normalized = String(value ?? '').trim().toLowerCase()
    const allowed: PaymentMethodColorKey[] = ['emerald', 'sky', 'amber', 'orange', 'violet', 'rose', 'cyan', 'slate']
    if (!normalized) {
      return this.getDefaultPaymentMethodColor(type)
    }

    if ((allowed as string[]).includes(normalized)) {
      return normalized as PaymentMethodColorKey
    }

    throw new BadRequestException('Mau phuong thuc thanh toan khong hop le')
  }

  private normalizeOptionalAmount(value?: number | null) {
    if (value === undefined || value === null) return null
    const normalized = Number(value)
    if (!Number.isFinite(normalized) || normalized < 0) {
      throw new BadRequestException('Dieu kien so tien khong hop le')
    }

    return normalized
  }

  private normalizeOptionalTime(value?: string | null, label = 'Khung gio') {
    const normalized = String(value ?? '').trim()
    if (!normalized) return null
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized)) {
      throw new BadRequestException(`${label} khong hop le`)
    }

    return normalized
  }

  private normalizeWeekdays(values?: number[] | null) {
    const normalized = Array.from(
      new Set(
        (values ?? [])
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
      ),
    ).sort((left, right) => left - right)

    if ((values ?? []).length > 0 && normalized.length === 0) {
      throw new BadRequestException('Ngay ap dung khong hop le')
    }

    return normalized
  }

  private normalizeBranchIds(values?: string[] | null) {
    return Array.from(
      new Set(
        (values ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    )
  }

  private normalizeOptionalText(value?: string | null) {
    const normalized = String(value ?? '').trim()
    return normalized ? normalized : null
  }

  private normalizePaymentQrProvider(value?: string | null): PaymentQrProvider {
    const normalized = String(value ?? '').trim().toUpperCase()
    if (!normalized || normalized === 'VIETQR') {
      return 'VIETQR'
    }

    throw new BadRequestException('Nha cung cap QR khong hop le')
  }

  private normalizePaymentQrBankBin(value?: string | null) {
    const normalized = String(value ?? '').trim()
    if (!/^\d{6}$/.test(normalized)) {
      throw new BadRequestException('Ma BIN ngan hang phai gom 6 chu so')
    }

    return normalized
  }

  private normalizePaymentQrTemplate(value?: string | null) {
    const normalized = String(value ?? '').trim()
    if (!normalized) return 'compact2'
    if (normalized.length > 40) {
      throw new BadRequestException('Mau QR khong hop le')
    }

    return normalized
  }

  private normalizeTransferNotePrefix(value?: string | null) {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '-')

    if (!/^[A-Z0-9_-]{2,24}$/.test(normalized)) {
      throw new BadRequestException('Tien to noi dung chuyen khoan phai tu 2-24 ky tu A-Z, 0-9, gach ngang hoac gach duoi')
    }

    return normalized
  }

  private normalizeWebhookSecretName(value?: string | null) {
    const normalized = String(value ?? '').trim()
    if (normalized.length < 2 || normalized.length > 80) {
      throw new BadRequestException('Ten key webhook phai tu 2-80 ky tu')
    }

    return normalized
  }

  private normalizeWebhookProvider(value?: string | null) {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')

    if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(normalized)) {
      throw new BadRequestException('Provider webhook phai tu 2-40 ky tu a-z, 0-9, gach ngang hoac gach duoi')
    }

    return normalized
  }

  private generateWebhookSecret() {
    return `whk_${randomBytes(24).toString('base64url')}`
  }

  private hashWebhookSecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex')
  }

  private maskWebhookSecret(secret: string) {
    if (secret.length <= 10) return `${secret.slice(0, 3)}***`
    return `${secret.slice(0, 7)}...${secret.slice(-4)}`
  }

  private normalizePaymentMethodPayload(
    dto: CreatePaymentMethodDto | UpdatePaymentMethodDto,
    current?: Record<string, any> | null,
  ) {
    const type = dto.type !== undefined ? this.normalizePaymentMethodType(dto.type) : this.normalizePaymentMethodType(current?.type)
    const name = dto.name !== undefined ? this.normalizePaymentMethodName(dto.name) : this.normalizePaymentMethodName(current?.name)
    const colorKey =
      dto.colorKey !== undefined
        ? this.normalizePaymentMethodColorKey(type, dto.colorKey)
        : this.normalizePaymentMethodColorKey(type, current?.colorKey)
    const minAmount = dto.minAmount !== undefined ? this.normalizeOptionalAmount(dto.minAmount) : (current?.minAmount ?? null)
    const maxAmount = dto.maxAmount !== undefined ? this.normalizeOptionalAmount(dto.maxAmount) : (current?.maxAmount ?? null)
    const timeFrom = dto.timeFrom !== undefined ? this.normalizeOptionalTime(dto.timeFrom, 'Gio bat dau') : (current?.timeFrom ?? null)
    const timeTo = dto.timeTo !== undefined ? this.normalizeOptionalTime(dto.timeTo, 'Gio ket thuc') : (current?.timeTo ?? null)
    const weekdays = dto.weekdays !== undefined ? this.normalizeWeekdays(dto.weekdays) : Array.isArray(current?.weekdays) ? current.weekdays : []
    const branchIds = dto.branchIds !== undefined ? this.normalizeBranchIds(dto.branchIds) : Array.isArray(current?.branchIds) ? current.branchIds : []
    const notes = dto.notes !== undefined ? this.normalizeOptionalText(dto.notes) : (current?.notes ?? null)
    const sortOrder = dto.sortOrder !== undefined ? Math.max(0, Math.floor(Number(dto.sortOrder) || 0)) : Number(current?.sortOrder ?? 0)
    const isDefault = dto.isDefault !== undefined ? Boolean(dto.isDefault) : Boolean(current?.isDefault)
    const isActive = dto.isActive !== undefined ? Boolean(dto.isActive) : current?.isActive !== undefined ? Boolean(current.isActive) : true
    const isSystem = Boolean(current?.isSystem)

    if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
      throw new BadRequestException('So tien toi thieu khong duoc lon hon so tien toi da')
    }

    const bankName = type === 'BANK'
      ? (dto.bankName !== undefined ? this.normalizeBankTransferText(dto.bankName, 'Ten ngan hang') : this.normalizeBankTransferText(current?.bankName, 'Ten ngan hang'))
      : null
    const accountNumber = type === 'BANK'
      ? (dto.accountNumber !== undefined
        ? this.normalizeBankTransferAccountNumber(dto.accountNumber)
        : this.normalizeBankTransferAccountNumber(current?.accountNumber))
      : null
    const accountHolder = type === 'BANK'
      ? (dto.accountHolder !== undefined
        ? this.normalizeBankTransferText(dto.accountHolder, 'Ten thu huong')
        : this.normalizeBankTransferText(current?.accountHolder, 'Ten thu huong'))
      : null
    const qrEnabled = type === 'BANK'
      ? (dto.qrEnabled !== undefined ? Boolean(dto.qrEnabled) : Boolean(current?.qrEnabled))
      : false
    const qrProvider = type === 'BANK' && qrEnabled
      ? this.normalizePaymentQrProvider(dto.qrProvider !== undefined ? dto.qrProvider : current?.qrProvider)
      : null
    const qrBankBin = type === 'BANK' && qrEnabled
      ? this.normalizePaymentQrBankBin(dto.qrBankBin !== undefined ? dto.qrBankBin : current?.qrBankBin)
      : null
    const qrTemplate = type === 'BANK' && qrEnabled
      ? this.normalizePaymentQrTemplate(dto.qrTemplate !== undefined ? dto.qrTemplate : current?.qrTemplate)
      : null
    const transferNotePrefix = type === 'BANK' && qrEnabled
      ? this.normalizeTransferNotePrefix(
        dto.transferNotePrefix !== undefined ? dto.transferNotePrefix : current?.transferNotePrefix,
      )
      : null

    if (qrEnabled && accountNumber && accountNumber.length > 19) {
      throw new BadRequestException('So tai khoan bat QR noi bo khong duoc vuot qua 19 chu so theo chuan VietQR')
    }

    if (isSystem && type !== 'CASH') {
      throw new BadRequestException('Phuong thuc he thong khong duoc doi loai')
    }

    return {
      name,
      type,
      colorKey,
      isDefault,
      isActive: isSystem ? true : isActive,
      isSystem,
      sortOrder,
      minAmount,
      maxAmount,
      timeFrom,
      timeTo,
      weekdays,
      branchIds,
      notes,
      bankName,
      accountNumber,
      accountHolder,
      qrEnabled,
      qrProvider,
      qrBankBin,
      qrTemplate,
      transferNotePrefix,
    }
  }

  private async ensureSystemCashPaymentMethod() {
    const current = await this.db.paymentMethod.findFirst({
      where: { code: 'SYS_CASH' },
    })

    if (current) {
      if (!current.isSystem || current.type !== 'CASH' || !current.isActive) {
        await this.db.paymentMethod.update({
          where: { id: current.id },
          data: {
            code: 'SYS_CASH',
            type: 'CASH',
            colorKey: 'emerald',
            isSystem: true,
            isActive: true,
          },
        })
      }

      return
    }

    const hasDefault = await this.db.paymentMethod.findFirst({
      where: { isDefault: true },
      select: { id: true },
    })

    await this.db.paymentMethod.create({
      data: {
        id: 'pm_sys_cash',
        code: 'SYS_CASH',
        name: 'Tien mat',
        type: 'CASH',
        colorKey: 'emerald',
        isSystem: true,
        isDefault: !hasDefault,
        isActive: true,
        sortOrder: 0,
        weekdays: [],
        branchIds: [],
      },
    })
  }

  private async ensureUniquePaymentMethodName(name: string, excludeId?: string) {
    const duplicated = await this.db.paymentMethod.findFirst({
      where: {
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    })

    if (duplicated) {
      throw new ConflictException('Ten phuong thuc thanh toan da ton tai')
    }
  }

  private async ensureUniqueBankAccountNumber(accountNumber: string | null, excludeId?: string) {
    if (!accountNumber) return

    const duplicated = await this.db.paymentMethod.findFirst({
      where: {
        type: 'BANK',
        accountNumber,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })

    if (duplicated) {
      throw new ConflictException('So tai khoan da ton tai')
    }
  }

  private async ensureUniqueTransferNotePrefix(prefix: string | null, excludeId?: string) {
    if (!prefix) return

    const duplicated = await this.db.paymentMethod.findFirst({
      where: {
        type: 'BANK',
        qrEnabled: true,
        transferNotePrefix: prefix,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })

    if (duplicated) {
      throw new ConflictException('Tien to noi dung chuyen khoan da ton tai')
    }
  }

  private async normalizePaymentMethodResult(method: any) {
    return {
      ...method,
      colorKey: this.normalizePaymentMethodColorKey(method.type, method.colorKey),
      weekdays: Array.isArray(method.weekdays) ? method.weekdays.map((value: any) => Number(value)).filter((value: number) => Number.isInteger(value)) : [],
      branchIds: Array.isArray(method.branchIds) ? method.branchIds.map((value: any) => String(value)) : [],
    }
  }

  private async ensureUniqueBranchCode(code: string, excludeId?: string): Promise<string> {
    const normalized = normalizeBranchCode(code)
    if (!isValidBranchCode(normalized)) {
      throw new BadRequestException('ID chi nhánh phải gồm 2-4 ký tự A-Z hoặc số')
    }

    const existing = await this.db.branch.findFirst({
      where: {
        code: normalized,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      } as any,
    })

    if (existing) {
      throw new ConflictException(`ID chi nhánh "${normalized}" đã tồn tại`)
    }

    return normalized
  }

  private async suggestUniqueBranchCode(name: string, excludeId?: string): Promise<string> {
    const suggested = suggestBranchCodeFromName(name)
    const baseCode = suggested.length >= 2 ? suggested : 'CN'

    for (let suffix = 0; suffix <= 99; suffix += 1) {
      const candidate = suffix === 0
        ? baseCode
        : normalizeBranchCode(`${baseCode.slice(0, Math.max(0, 4 - String(suffix).length))}${suffix}`)

      if (!isValidBranchCode(candidate)) continue

      const existing = await this.db.branch.findFirst({
        where: {
          code: candidate,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        } as any,
      })

      if (!existing) return candidate
    }

    throw new ConflictException('Không thể tự sinh ID chi nhánh duy nhất, vui lòng nhập thủ công')
  }

  // ─── System Configs ───────────────────────────────────────────────────────

  private sanitizeSystemConfig(config: Record<string, any> | null | undefined) {
    if (!config) {
      return {}
    }

    const {
      googleAuthClientSecretEnc: _googleAuthClientSecretEnc,
      googleDriveServiceAccountEnc: _googleDriveServiceAccountEnc,
      ...rest
    } = config

    return {
      ...rest,
      storageProvider: rest.storageProvider ?? StorageProviderKind.LOCAL,
      googleAuthEnabled: rest.googleAuthEnabled ?? false,
      googleDriveEnabled: rest.googleDriveEnabled ?? false,
      googleAuthClientSecretConfigured: Boolean(config.googleAuthClientSecretEnc),
      googleDriveServiceAccountConfigured: Boolean(config.googleDriveServiceAccountEnc),
    }
  }

  private parseJsonField(value: string | undefined): string | null {
    if (value === undefined) return undefined as any
    if (!value) return null
    try {
      JSON.parse(value)
      return value
    } catch {
      throw new BadRequestException('Du lieu JSON khong hop le')
    }
  }

  private normalizeStorageProvider(value: StorageProviderKind | undefined) {
    if (value === undefined) return undefined
    if (!Object.values(StorageProviderKind).includes(value)) {
      throw new BadRequestException('Storage provider khong hop le')
    }
    return value
  }

  private normalizeServiceAccountJson(value: string | null | undefined) {
    if (value === undefined) {
      return undefined
    }

    if (value === null || value.trim() === '') {
      return null
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new BadRequestException('Google Drive service account JSON khong hop le')
    }

    const clientEmail = String(parsed['client_email'] ?? '').trim()
    const privateKey = String(parsed['private_key'] ?? '').trim()

    if (!clientEmail || !privateKey) {
      throw new BadRequestException('Google Drive service account JSON thieu client_email hoac private_key')
    }

    return {
      encrypted: encryptSecret(value),
      clientEmail,
    }
  }

  async getConfigs() {
    try {
      const config = await (this.db as any).systemConfig.findFirst({})
      return { success: true, data: this.sanitizeSystemConfig(config) }
    } catch {
      return { success: true, data: {} }
    }
  }

  async updateConfigs(dto: UpdateConfigDto) {
    const existing = await (this.db as any).systemConfig.findFirst({
      select: { id: true },
    })

    const data: any = {}
    if (dto.shopName !== undefined) data.shopName = dto.shopName
    if (dto.shopPhone !== undefined) data.shopPhone = dto.shopPhone
    if (dto.shopAddress !== undefined) data.shopAddress = dto.shopAddress
    if (dto.shopLogo !== undefined) data.shopLogo = dto.shopLogo
    if (dto.email !== undefined) data.email = dto.email
    if (dto.website !== undefined) data.website = dto.website
    if (dto.taxRate !== undefined) data.taxRate = dto.taxRate
    if (dto.currency !== undefined) data.currency = dto.currency
    if (dto.timezone !== undefined) data.timezone = dto.timezone
    if (dto.loyaltySpendPerPoint !== undefined) data.loyaltySpendPerPoint = dto.loyaltySpendPerPoint
    if (dto.loyaltyPointValue !== undefined) data.loyaltyPointValue = dto.loyaltyPointValue
    if (dto.loyaltyPointExpiryMonths !== undefined) data.loyaltyPointExpiryMonths = dto.loyaltyPointExpiryMonths
    if (dto.loyaltyTierRetentionMonths !== undefined) data.loyaltyTierRetentionMonths = dto.loyaltyTierRetentionMonths
    if (dto.loyaltyTierRules !== undefined) data.loyaltyTierRules = dto.loyaltyTierRules
    if (dto.storageProvider !== undefined) data.storageProvider = this.normalizeStorageProvider(dto.storageProvider)
    if (dto.googleAuthEnabled !== undefined) data.googleAuthEnabled = Boolean(dto.googleAuthEnabled)
    if (dto.googleAuthClientId !== undefined) data.googleAuthClientId = dto.googleAuthClientId?.trim() || null
    if (dto.googleAuthAllowedDomain !== undefined) data.googleAuthAllowedDomain = dto.googleAuthAllowedDomain?.trim() || null
    if (dto.googleAuthClientSecret !== undefined) {
      data.googleAuthClientSecretEnc = dto.googleAuthClientSecret ? encryptSecret(dto.googleAuthClientSecret) : null
    }
    if (dto.googleDriveEnabled !== undefined) data.googleDriveEnabled = Boolean(dto.googleDriveEnabled)
    if (dto.googleDriveClientEmail !== undefined) data.googleDriveClientEmail = dto.googleDriveClientEmail?.trim() || null
    if (dto.googleDriveSharedDriveId !== undefined) data.googleDriveSharedDriveId = dto.googleDriveSharedDriveId?.trim() || null
    if (dto.googleDriveRootFolderId !== undefined) data.googleDriveRootFolderId = dto.googleDriveRootFolderId?.trim() || null
    if (dto.googleDriveImageFolderId !== undefined) data.googleDriveImageFolderId = dto.googleDriveImageFolderId?.trim() || null
    if (dto.googleDriveDocumentFolderId !== undefined) data.googleDriveDocumentFolderId = dto.googleDriveDocumentFolderId?.trim() || null
    if (dto.googleDriveBackupFolderId !== undefined) data.googleDriveBackupFolderId = dto.googleDriveBackupFolderId?.trim() || null
    if (dto.googleDriveServiceAccountJson !== undefined) {
      const normalizedServiceAccount = this.normalizeServiceAccountJson(dto.googleDriveServiceAccountJson)
      data.googleDriveServiceAccountEnc = normalizedServiceAccount?.encrypted ?? null
      if (normalizedServiceAccount?.clientEmail) {
        data.googleDriveClientEmail = normalizedServiceAccount.clientEmail
      }
    }
    if (dto.petBreedsV2 !== undefined) data.petBreedsV2 = this.parseJsonField(dto.petBreedsV2)
    if (dto.petTemperaments !== undefined) data.petTemperaments = this.parseJsonField(dto.petTemperaments)
    if (dto.petVaccineOpts !== undefined) data.petVaccineOpts = this.parseJsonField(dto.petVaccineOpts)

    if (existing) {
      const updated = await (this.db as any).systemConfig.update({
        where: { id: existing.id },
        data,
      })
      return { success: true, data: this.sanitizeSystemConfig(updated) }
    } else {
      const created = await (this.db as any).systemConfig.create({
        data,
      })
      return { success: true, data: this.sanitizeSystemConfig(created) }
    }
  }

  // ─── Print Templates ───────────────────────────────────────────────────────

  async findAllPrintTemplates() {
    const templates = await this.db.printTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    })

    // Auto-seed if empty
    if (templates.length === 0) {
      const seeded = await Promise.all(
        DEFAULT_TEMPLATES.map((t) =>
          this.db.printTemplate.create({
            data: {
              ...t,
              isSystem: true,
            },
          })
        )
      )
      return { success: true, data: seeded }
    }

    // Ensure missing default templates are added
    const existingTypes = new Set(templates.map((t) => t.type))
    const missingTemplates = DEFAULT_TEMPLATES.filter((t) => !existingTypes.has(t.type))

    if (missingTemplates.length > 0) {
      const added = await Promise.all(
        missingTemplates.map((t) =>
          this.db.printTemplate.create({
            data: {
              ...t,
              isSystem: true,
            },
          })
        )
      )
      return { success: true, data: [...templates, ...added] }
    }

    return { success: true, data: templates }
  }

  async getPrintTemplate(type: string) {
    let template = await this.db.printTemplate.findUnique({
      where: { type },
    })

    if (!template) {
      const defaultValue = DEFAULT_TEMPLATES.find((t) => t.type === type)
      if (defaultValue) {
        template = await this.db.printTemplate.create({
          data: {
            ...defaultValue,
            isSystem: true,
          },
        })
      } else {
        throw new NotFoundException('Template not found')
      }
    }

    return { success: true, data: template }
  }

  async updatePrintTemplate(type: string, dto: UpdatePrintTemplateDto) {
    const template = await this.db.printTemplate.findUnique({
      where: { type },
    })

    if (!template) {
      throw new NotFoundException('Template not found')
    }

    const updated = await this.db.printTemplate.update({
      where: { type },
      data: {
        content: dto.content,
        paperSize: dto.paperSize,
      },
    })

    return { success: true, data: updated }
  }

  async getPaymentOptions() {
    try {
      const config = await (this.db as any).systemConfig.findFirst({
        select: { allowMultiPayment: true, loyaltyPointValue: true },
      })
      return {
        success: true,
        data: {
          allowMultiPayment: config?.allowMultiPayment ?? true,
          loyaltyPointValue: Number(config?.loyaltyPointValue ?? 1) || 1,
        },
      }
    } catch {
      return {
        success: true,
        data: {
          allowMultiPayment: true,
          loyaltyPointValue: 1,
        },
      }
    }
  }

  async updatePaymentOptions(dto: UpdatePaymentOptionsDto) {
    const allowMultiPayment = Boolean(dto.allowMultiPayment)
    const existing = await (this.db as any).systemConfig.findFirst({
      select: { id: true },
    })

    if (existing) {
      await (this.db as any).systemConfig.update({
        where: { id: existing.id },
        data: {
          allowMultiPayment,
        },
      })
    } else {
      await (this.db as any).systemConfig.create({
        data: {
          allowMultiPayment,
        },
      })
    }

    return {
      success: true,
      data: {
        allowMultiPayment,
      },
    }
  }

  async findAllPaymentWebhookSecrets() {
    const records = await (this.db as any).paymentWebhookSecret.findMany({
      orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
    })

    return {
      success: true,
      data: records.map((record: any) => ({
        id: record.id,
        name: record.name,
        provider: record.provider,
        secretPreview: record.secretPreview,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        lastUsedAt: record.lastUsedAt,
      })),
    }
  }

  async createPaymentWebhookSecret(dto: CreatePaymentWebhookSecretDto) {
    const name = this.normalizeWebhookSecretName(dto.name)
    const provider = this.normalizeWebhookProvider(dto.provider)
    const existing = await (this.db as any).paymentWebhookSecret.findFirst({
      where: {
        provider,
        name,
      },
      select: { id: true },
    })

    if (existing) {
      throw new ConflictException('Ten key webhook da ton tai trong provider nay')
    }

    const secret = this.generateWebhookSecret()
    const created = await (this.db as any).paymentWebhookSecret.create({
      data: {
        id: randomUUID(),
        provider,
        name,
        secretHash: this.hashWebhookSecret(secret),
        secretPreview: this.maskWebhookSecret(secret),
      },
    })

    return {
      success: true,
      data: {
        id: created.id,
        name: created.name,
        provider: created.provider,
        secretPreview: created.secretPreview,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        lastUsedAt: created.lastUsedAt,
        secret,
      },
    }
  }

  async removePaymentWebhookSecret(id: string) {
    const current = await (this.db as any).paymentWebhookSecret.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!current) {
      throw new NotFoundException('Khong tim thay key webhook')
    }

    await (this.db as any).paymentWebhookSecret.delete({
      where: { id },
    })

    return { success: true, message: 'Da thu hoi key webhook' }
  }

  async findAllCashbookCategories(type?: string) {
    const normalizedType = type ? this.normalizeCashbookCategoryType(type) : null
    const data = normalizedType
      ? await this.db.$queryRaw<any[]>`
          SELECT *
          FROM cashbook_categories
          WHERE "type"::text = ${normalizedType} AND "isActive" = true
          ORDER BY "sortOrder" ASC, "createdAt" ASC
        `
      : await this.db.$queryRaw<any[]>`
          SELECT *
          FROM cashbook_categories
          WHERE "isActive" = true
          ORDER BY "type" ASC, "sortOrder" ASC, "createdAt" ASC
        `

    return { success: true, data }
  }

  async createCashbookCategory(dto: CreateCashbookCategoryDto) {
    const type = this.normalizeCashbookCategoryType(dto.type)
    const name = this.normalizeCashbookCategoryName(dto.name)
    const id = randomUUID()

    const existing = await this.db.$queryRaw<any[]>`
      SELECT id
      FROM cashbook_categories
      WHERE "type"::text = ${type} AND LOWER(name) = LOWER(${name})
      LIMIT 1
    `

    if (existing.length > 0) {
      throw new ConflictException('Danh muc so quy da ton tai')
    }

    const lastItem = await this.db.$queryRaw<Array<{ sortOrder: number }>>`
      SELECT "sortOrder"
      FROM cashbook_categories
      WHERE "type"::text = ${type}
      ORDER BY "sortOrder" DESC, "createdAt" DESC
      LIMIT 1
    `
    const sortOrder = dto.sortOrder ?? ((lastItem[0]?.sortOrder ?? -1) + 1)

    const [category] = await this.db.$queryRaw<any[]>`
      INSERT INTO cashbook_categories ("id", "type", "name", "isActive", "sortOrder", "createdAt", "updatedAt")
      VALUES (${id}, CAST(${type} AS "CashbookCategoryType"), ${name}, ${dto.isActive ?? true}, ${sortOrder}, NOW(), NOW())
      RETURNING *
    `

    return { success: true, data: category }
  }

  async updateCashbookCategory(id: string, dto: UpdateCashbookCategoryDto) {
    const [current] = await this.db.$queryRaw<any[]>`
      SELECT *
      FROM cashbook_categories
      WHERE id = ${id}
      LIMIT 1
    `
    if (!current) throw new NotFoundException('Khong tim thay danh muc so quy')

    const nextName = dto.name !== undefined ? this.normalizeCashbookCategoryName(dto.name) : current.name

    if (dto.name !== undefined) {
      const duplicated = await this.db.$queryRaw<any[]>`
        SELECT id
        FROM cashbook_categories
        WHERE "type"::text = ${current.type}
          AND id <> ${id}
          AND LOWER(name) = LOWER(${nextName})
        LIMIT 1
      `

      if (duplicated.length > 0) {
        throw new ConflictException('Danh muc so quy da ton tai')
      }
    }

    const [updated] = await this.db.$queryRaw<any[]>`
      UPDATE cashbook_categories
      SET
        "name" = ${dto.name !== undefined ? nextName : current.name},
        "isActive" = ${dto.isActive ?? current.isActive},
        "sortOrder" = ${dto.sortOrder ?? current.sortOrder},
        "updatedAt" = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    return { success: true, data: updated }
  }

  async removeCashbookCategory(id: string) {
    const [current] = await this.db.$queryRaw<any[]>`
      SELECT id
      FROM cashbook_categories
      WHERE id = ${id}
      LIMIT 1
    `
    if (!current) throw new NotFoundException('Khong tim thay danh muc so quy')

    await this.db.$executeRaw`
      DELETE FROM cashbook_categories
      WHERE id = ${id}
    `
    return { success: true, message: 'Xoa danh muc so quy thanh cong' }
  }

  async findAllPaymentMethods() {
    await this.ensureSystemCashPaymentMethod()

    const methods = await this.db.paymentMethod.findMany({
      orderBy: [{ sortOrder: 'asc' }, { isDefault: 'desc' }, { createdAt: 'asc' }],
    })

    return {
      success: true,
      data: await Promise.all(methods.map((method) => this.normalizePaymentMethodResult(method))),
    }
  }

  async createPaymentMethod(dto: CreatePaymentMethodDto) {
    await this.ensureSystemCashPaymentMethod()

    const payload = this.normalizePaymentMethodPayload(dto)
    await this.ensureUniquePaymentMethodName(payload.name)
    await this.ensureUniqueBankAccountNumber(payload.accountNumber)
    await this.ensureUniqueTransferNotePrefix(payload.transferNotePrefix)

    if (payload.isDefault) {
      await this.db.paymentMethod.updateMany({
        data: { isDefault: false },
        where: { isDefault: true },
      })
    }

    const created = await this.db.paymentMethod.create({
      data: {
        id: randomUUID(),
        name: payload.name,
        type: payload.type,
        colorKey: payload.colorKey,
        isSystem: false,
        isDefault: payload.isDefault,
        isActive: payload.isActive,
        sortOrder: payload.sortOrder,
        minAmount: payload.minAmount,
        maxAmount: payload.maxAmount,
        timeFrom: payload.timeFrom,
        timeTo: payload.timeTo,
        weekdays: payload.weekdays,
        branchIds: payload.branchIds,
        notes: payload.notes,
        bankName: payload.bankName,
        accountNumber: payload.accountNumber,
        accountHolder: payload.accountHolder,
        qrEnabled: payload.qrEnabled,
        qrProvider: payload.qrProvider,
        qrBankBin: payload.qrBankBin,
        qrTemplate: payload.qrTemplate,
        transferNotePrefix: payload.transferNotePrefix,
      },
    })

    return { success: true, data: await this.normalizePaymentMethodResult(created) }
  }

  async updatePaymentMethod(id: string, dto: UpdatePaymentMethodDto) {
    await this.ensureSystemCashPaymentMethod()

    const current = await this.db.paymentMethod.findUnique({ where: { id } })
    if (!current) {
      throw new NotFoundException('Khong tim thay phuong thuc thanh toan')
    }

    const payload = this.normalizePaymentMethodPayload(dto, current)
    await this.ensureUniquePaymentMethodName(payload.name, id)
    await this.ensureUniqueBankAccountNumber(payload.accountNumber, id)
    await this.ensureUniqueTransferNotePrefix(payload.transferNotePrefix, id)

    if (payload.isDefault) {
      await this.db.paymentMethod.updateMany({
        data: { isDefault: false },
        where: { NOT: { id }, isDefault: true },
      })
    }

    const updated = await this.db.paymentMethod.update({
      where: { id },
      data: {
        name: payload.name,
        type: payload.type,
        colorKey: payload.colorKey,
        isDefault: payload.isDefault,
        isActive: payload.isActive,
        sortOrder: payload.sortOrder,
        minAmount: payload.minAmount,
        maxAmount: payload.maxAmount,
        timeFrom: payload.timeFrom,
        timeTo: payload.timeTo,
        weekdays: payload.weekdays,
        branchIds: payload.branchIds,
        notes: payload.notes,
        bankName: payload.bankName,
        accountNumber: payload.accountNumber,
        accountHolder: payload.accountHolder,
        qrEnabled: payload.qrEnabled,
        qrProvider: payload.qrProvider,
        qrBankBin: payload.qrBankBin,
        qrTemplate: payload.qrTemplate,
        transferNotePrefix: payload.transferNotePrefix,
      },
    })

    return { success: true, data: await this.normalizePaymentMethodResult(updated) }
  }

  async removePaymentMethod(id: string) {
    await this.ensureSystemCashPaymentMethod()

    const current = await this.db.paymentMethod.findUnique({ where: { id } })
    if (!current) {
      throw new NotFoundException('Khong tim thay phuong thuc thanh toan')
    }

    if (current.isSystem) {
      throw new BadRequestException('Khong the xoa phuong thuc he thong')
    }

    await this.db.paymentMethod.delete({ where: { id } })

    if (current.isDefault) {
      const nextDefault = await this.db.paymentMethod.findFirst({
        where: { isActive: true },
        orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      })

      if (nextDefault) {
        await this.db.paymentMethod.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        })
      }
    }

    return { success: true, message: 'Xoa phuong thuc thanh toan thanh cong' }
  }

  async findAllBankTransferAccounts() {
    await this.ensureSystemCashPaymentMethod()

    const methods = await this.db.paymentMethod.findMany({
      where: { type: 'BANK' },
      orderBy: [{ isDefault: 'desc' }, { isActive: 'desc' }, { createdAt: 'desc' }],
    })

    return {
      success: true,
      data: methods.map((method) => ({
        id: method.id,
        name: method.name,
        bankName: method.bankName ?? '',
        accountNumber: method.accountNumber ?? '',
        accountHolder: method.accountHolder ?? '',
        notes: method.notes ?? null,
        isDefault: method.isDefault,
        isActive: method.isActive,
        createdAt: method.createdAt,
        updatedAt: method.updatedAt,
      })),
    }
  }

  async createBankTransferAccount(dto: CreateBankTransferAccountDto) {
    const result = await this.createPaymentMethod({
      name: dto.name,
      type: 'BANK',
      bankName: dto.bankName,
      accountNumber: dto.accountNumber,
      accountHolder: dto.accountHolder,
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    })

    return {
      success: true,
      data: {
        id: result.data.id,
        name: result.data.name,
        bankName: result.data.bankName ?? '',
        accountNumber: result.data.accountNumber ?? '',
        accountHolder: result.data.accountHolder ?? '',
        notes: result.data.notes ?? null,
        isDefault: result.data.isDefault,
        isActive: result.data.isActive,
        createdAt: result.data.createdAt,
        updatedAt: result.data.updatedAt,
      },
    }
  }

  async updateBankTransferAccount(id: string, dto: UpdateBankTransferAccountDto) {
    const result = await this.updatePaymentMethod(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      type: 'BANK',
      ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
      ...(dto.accountNumber !== undefined ? { accountNumber: dto.accountNumber } : {}),
      ...(dto.accountHolder !== undefined ? { accountHolder: dto.accountHolder } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    })

    return {
      success: true,
      data: {
        id: result.data.id,
        name: result.data.name,
        bankName: result.data.bankName ?? '',
        accountNumber: result.data.accountNumber ?? '',
        accountHolder: result.data.accountHolder ?? '',
        notes: result.data.notes ?? null,
        isDefault: result.data.isDefault,
        isActive: result.data.isActive,
        createdAt: result.data.createdAt,
        updatedAt: result.data.updatedAt,
      },
    }
  }

  async removeBankTransferAccount(id: string) {
    return this.removePaymentMethod(id)
  }

  // ─── Branches ─────────────────────────────────────────────────────────────

  async findAllBranches() {
    const branches = await this.db.branch.findMany({ orderBy: { createdAt: 'desc' } })
    return { success: true, data: branches }
  }

  async createBranch(dto: CreateBranchDto) {
    const code = dto.code
      ? await this.ensureUniqueBranchCode(dto.code)
      : await this.suggestUniqueBranchCode(dto.name)
    const cashReserveTargetAmount = this.normalizeBranchCashReserveTargetAmount(dto.cashReserveTargetAmount)

    const branch = await this.db.branch.create({
      data: {
        ...dto,
        code,
        ...(cashReserveTargetAmount !== undefined ? { cashReserveTargetAmount } : {}),
      } as any,
    })
    return { success: true, data: branch }
  }

  async updateBranch(id: string, dto: UpdateBranchDto) {
    const branch = await this.db.branch.findUnique({ where: { id } })
    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh')
    const cashReserveTargetAmount = this.normalizeBranchCashReserveTargetAmount(dto.cashReserveTargetAmount)
    const updated = await this.db.branch.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.code ? { code: await this.ensureUniqueBranchCode(dto.code, id) } : {}),
        ...(cashReserveTargetAmount !== undefined ? { cashReserveTargetAmount } : {}),
      } as any,
    })
    return { success: true, data: updated }
  }

  async removeBranch(id: string) {
    const branch = await this.db.branch.findUnique({ where: { id } })
    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh')
    await this.db.branch.delete({ where: { id } })
    return { success: true, message: 'Xóa chi nhánh thành công' }
  }

  // ─── Customer Groups ──────────────────────────────────────────────────────

  async findAllCustomerGroups() {
    const groups = await this.db.customerGroup.findMany({
      orderBy: { createdAt: 'desc' },
      include: { priceBook: { select: { id: true, name: true } } },
    })
    return { success: true, data: groups }
  }

  async createCustomerGroup(dto: { name: string; color?: string; pricePolicy?: string; priceBookId?: string; discount?: number; description?: string }) {
    const group = await this.db.customerGroup.create({ data: dto as any })
    const withBook = await this.db.customerGroup.findUnique({
      where: { id: group.id },
      include: { priceBook: { select: { id: true, name: true } } },
    })
    return { success: true, data: withBook }
  }

  async updateCustomerGroup(id: string, dto: any) {
    const group = await this.db.customerGroup.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!group) throw new NotFoundException('Không tìm thấy nhóm khách hàng')

    if (dto.name && dto.name !== group.name) {
      const existing = await this.db.customerGroup.findFirst({
        where: { name: { equals: dto.name, mode: 'insensitive' }, id: { not: id } }
      })
      if (existing) {
        throw new BadRequestException('Tên nhóm khách hàng đã tồn tại')
      }
    }

    const { name, color, pricePolicy, priceBookId, discount, description, isActive, isDefault } = dto;
    const updated = await this.db.customerGroup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(pricePolicy !== undefined && { pricePolicy }),
        ...('priceBookId' in dto && { priceBookId: priceBookId ?? null }),
        ...(discount !== undefined && { discount }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(isDefault !== undefined && { isDefault }),
      },
      include: { priceBook: { select: { id: true, name: true } } },
    })
    return { success: true, data: updated }
  }

  async removeCustomerGroup(id: string) {
    const group = await this.db.customerGroup.findUnique({
      where: { id },
      include: { _count: { select: { customers: true } } }
    })
    if (!group) throw new NotFoundException('Không tìm thấy nhóm khách hàng')

    if (group.isDefault) {
      throw new BadRequestException('Không thể xóa nhóm khách hàng mặc định')
    }

    // Nếu nhóm đang có khách → chuyển về nhóm mặc định trước khi xóa
    if (group._count.customers > 0) {
      const defaultGroup = await this.db.customerGroup.findFirst({
        where: { isDefault: true, id: { not: id } },
      })
      if (!defaultGroup) {
        throw new BadRequestException('Không tìm thấy nhóm mặc định để chuyển khách hàng sang')
      }
      await this.db.customer.updateMany({
        where: { groupId: id },
        data: { groupId: defaultGroup.id },
      })
    }

    await this.db.customerGroup.delete({ where: { id } })
    return { success: true, message: 'Xóa nhóm khách hàng thành công' }
  }

  // ─── Activity Logs ────────────────────────────────────────────────────────

  async findActivityLogs(query: {
    userId?: string; action?: string; target?: string
    dateFrom?: string; dateTo?: string; search?: string; page?: number; limit?: number
  }): Promise<any> {
    const { userId, action, target, dateFrom, dateTo, search, page = 1, limit = 20 } = query
    const skip = (Number(page) - 1) * Number(limit)
    const where: any = {}

    if (userId) where.userId = userId
    if (action) where.action = { contains: action, mode: 'insensitive' }
    if (target) where.target = { contains: target, mode: 'insensitive' }
    if (search) where.description = { contains: search, mode: 'insensitive' }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const [data, total] = await Promise.all([
      this.db.activityLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, staffCode: true } } },
      }),
      this.db.activityLog.count({ where }),
    ])

    return { success: true, data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
  }

  async getActivityLogStats(): Promise<any> {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const [todayCount, totalCount] = await Promise.all([
      this.db.activityLog.count({ where: { createdAt: { gte: startOfDay } } }),
      this.db.activityLog.count(),
    ])
    return { success: true, data: { todayCount, totalCount } }
  }

  // ─── Module Config ──────────────────────────────────────────────────────────

  async getModules() {
    const db = this.db as any
    const modules = await db.moduleConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return { success: true, data: modules }
  }

  async toggleModule(key: string, isActive: boolean) {
    const db = this.db as any
    const module = await db.moduleConfig.findUnique({ where: { key } })
    if (!module) throw new NotFoundException(`Module "${key}" không tồn tại`)
    if (module.isCore) throw new BadRequestException(`Module "${key}" là module cốt lõi, không thể tắt`)

    const updated = await db.moduleConfig.update({
      where: { key },
      data: { isActive },
    })
    return { success: true, data: updated }
  }

  async isModuleActive(key: string): Promise<boolean> {
    const db = this.db as any
    const module = await db.moduleConfig.findUnique({
      where: { key },
      select: { isActive: true, isCore: true },
    })
    // Module không tồn tại trong DB → coi như chưa cài, cho phép access
    if (!module) return true
    if (module.isCore) return true
    return Boolean(module.isActive)
  }
}
