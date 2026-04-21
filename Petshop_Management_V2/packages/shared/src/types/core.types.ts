// ===========================================================
// SHARED TYPES — Used by both frontend and backend
// ===========================================================

// ---- API Response Shapes ----
export interface ApiResponse<T = unknown> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  message: string
  statusCode?: number
  errors?: Record<string, string[]>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ListParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ---- Auth Types ----
export interface JwtPayload {
  userId: string
  role: StaffRole | string
  permissions?: string[]
  branchId?: string | null
  authorizedBranchIds?: string[]
  iat: number
  exp: number
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export interface BaseBranch {
  id: string
  name: string
  address?: string | null
  isActive: boolean
}

export interface PosPreferences {
  defaultBranchId?: string | null
  outOfStockHidden?: boolean
  autoFocusSearch?: boolean
  barcodeMode?: boolean
  soundEnabled?: boolean
  zoomLevel?: number
  defaultPayment?: string | null
  roundingEnabled?: boolean
  roundingUnit?: number
  printerIp?: string | null
  paperSize?: string | null
  autoPrint?: boolean
  autoPrintQR?: boolean
  posTheme?: string | null
}

export interface AuthUser {
  id: string
  username: string
  fullName: string
  role: StaffRole | string
  staffCode: string
  branchId?: string | null
  defaultBranchId?: string | null
  posPreferences?: PosPreferences | null
  avatar?: string | null
  authorizedBranches: BaseBranch[]
  permissions?: string[]
  googleLinked?: boolean
  googleEmail?: string | null
}

// ---- Enums ----
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'COMPLETED' | 'REFUNDED'

export type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'

export type StaffStatus =
  | 'PROBATION'
  | 'OFFICIAL'
  | 'LEAVE'
  | 'LEAVING'
  | 'RESIGNED'
  | 'QUIT'
  | 'WORKING'

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN'

export type ServiceType = 'GROOMING' | 'HOTEL' | 'MEDICAL' | 'TRAINING' | 'DAYCARE' | 'OTHER'

export type GroomingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export type HotelStatus = 'BOOKED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'

export type HotelLineType = 'REGULAR' | 'HOLIDAY'

export type CustomerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'

export type TransactionType = 'INCOME' | 'EXPENSE'

export type TransactionSource =
  | 'MANUAL'
  | 'ORDER_PAYMENT'
  | 'ORDER_ADJUSTMENT'
  | 'STOCK_RECEIPT'
  | 'SUPPLIER_RETURN'
  | 'HOTEL'
  | 'GROOMING'
  | 'OTHER'

export type TransactionReferenceType =
  | 'MANUAL'
  | 'ORDER'
  | 'STOCK_RECEIPT'
  | 'SUPPLIER_RETURN'
  | 'HOTEL_STAY'
  | 'GROOMING_SESSION'
  | 'OTHER'

export type PetGender = 'MALE' | 'FEMALE' | 'UNKNOWN'
