import type {
  ServiceType,
  GroomingStatus,
  HotelStatus,
  HotelLineType,
  StaffRole,
  StaffStatus,
  EmploymentType,
  TransactionType,
  TransactionSource,
  TransactionReferenceType,
} from './core.types.js'

// ---- Grooming ----
export interface GroomingSession {
  id: string
  petId: string
  petName: string
  customerId?: string | null
  staffId?: string | null
  serviceId?: string | null
  orderId?: string | null
  status: GroomingStatus
  startTime?: Date | null
  endTime?: Date | null
  notes?: string | null
  price?: number | null
  createdAt: Date
  updatedAt: Date
}

// ---- Hotel ----
export interface HotelStay {
  id: string
  petId: string
  petName: string
  customerId?: string | null
  checkIn: Date
  checkOut?: Date | null
  estimatedCheckOut?: Date | null
  status: HotelStatus
  lineType: HotelLineType
  price?: number | null
  paymentStatus: string
  notes?: string | null
  rateTableId?: string | null
  orderId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface HotelRateTable {
  id: string
  name: string
  year: number
  species?: string | null
  minWeight?: number | null
  maxWeight?: number | null
  lineType: HotelLineType
  ratePerNight: number
  createdAt: Date
  updatedAt: Date
}

// ---- Staff ----
export interface Staff {
  id: string
  staffCode: string
  username: string
  fullName: string
  role: StaffRole
  status: StaffStatus
  employmentType: EmploymentType
  phone?: string | null
  email?: string | null
  address?: string | null
  avatar?: string | null
  branchId?: string | null
  joinDate?: Date | null
  createdAt: Date
  updatedAt: Date
}

// ---- Finance ----
export interface Transaction {
  id: string
  voucherNumber: string
  type: TransactionType
  amount: number
  description: string
  category?: string | null
  paymentMethod?: string | null
  branchId?: string | null
  branchName?: string | null
  refType?: TransactionReferenceType | null
  refId?: string | null
  refNumber?: string | null
  payerId?: string | null
  payerName?: string | null
  notes?: string | null
  tags?: string | null
  source: TransactionSource | string
  isManual: boolean
  orderId?: string | null
  staffId?: string | null
  date: Date
  createdAt: Date
  updatedAt: Date
}

// ---- Stock ----
export interface StockReceipt {
  id: string
  receiptNumber: string
  supplierId?: string | null
  branchId?: string | null
  status: string
  totalAmount: number
  paidAmount: number
  notes?: string | null
  receivedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Supplier {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  createdAt: Date
}

// ---- Misc ----
export interface Branch {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  isActive: boolean
}

export {
  ServiceType,
  GroomingStatus,
  HotelStatus,
  HotelLineType,
  StaffRole,
  StaffStatus,
  EmploymentType,
  TransactionType,
  TransactionSource,
  TransactionReferenceType,
}
