import { API_URL, api } from '../api'

export interface Staff {
  id: string
  staffCode: string
  username: string
  fullName: string
  role: { id: string; code: string; name: string; permissions: string[] } | null
  status: string
  phone: string | null
  email: string | null
  branch: { id: string; name: string } | null
  authorizedBranches?: { id: string; name: string }[]
  avatar: string | null
  createdAt: string
  joinDate?: string | null

  gender?: string | null
  dob?: string | null
  identityCode?: string | null
  emergencyContactTitle?: string | null
  emergencyContactPhone?: string | null
  shiftStart?: string | null
  shiftEnd?: string | null
  baseSalary?: number | null
  spaCommissionRate?: number | null
  employmentType?: string | null
}

export interface EmployeeDocument {
  id: string
  userId: string
  type: DocumentType
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  description: string | null
  uploadedAt: string
  uploadedBy: string
  expiresAt: string | null
  isActive: boolean
}

export type DocumentType =
  | 'CCCD_FRONT'
  | 'CCCD_BACK'
  | 'APPLICATION'
  | 'CERTIFICATE'
  | 'CONTRACT'
  | 'HEALTH_CERT'
  | 'TRAINING_CERT'
  | 'OTHER'

export interface StaffPerformance {
  monthlyRevenue: number
  monthlySpaSessions: number
  monthlyOrders: number
  month: number
  year: number
  chartData?: { month: number; year: number; revenue: number; orders: number; spaSessions: number }[]
}

export interface BranchRole {
  role: string
  branch: string
}

export interface BulkDeleteResult {
  success: boolean
  deletedIds: string[]
  blocked: Array<{ id: string; reason: string }>
}

// Attendance / Timekeeping interfaces
export interface ShiftSession {
  id: string
  openedAt: string
  closedAt: string | null
  status: string
  branchId: string
  orderCount: number
  collectedAmount: number
  differenceAmount: number | null
  reviewStatus: string
}

export interface AttendanceData {
  month: number
  year: number
  totalShifts: number
  completedShifts: number
  openShifts: number
  totalHours: number
  workingDays: number
  totalRevenue: number
  dailyHours: Record<string, number>
  shifts: ShiftSession[]
}

// Salary interfaces
export interface SalaryData {
  month: number
  year: number
  baseSalary: number
  proRatedBaseSalary: number
  actualWorkingDays: number
  expectedWorkingDays: number
  commission: {
    rate: number
    groomingRevenue: number
    amount: number
    sessionCount: number
  }
  bonuses: {
    fullAttendance: number
    revenue: number
    total: number
  }
  deductions: {
    shortages: number
    total: number
  }
  netSalary: number
  attendance: {
    totalShifts: number
    completedShifts: number
    workingDays: number
    totalHours: number
  }
}

export interface CreateStaffDto {
  username: string
  password?: string
  fullName: string
  role?: string
  phone?: string
  email?: string
  branchId?: string
  authorizedBranchIds?: string[]

  gender?: string
  dob?: string
  identityCode?: string
  emergencyContactTitle?: string
  emergencyContactPhone?: string
  shiftStart?: string
  shiftEnd?: string
  baseSalary?: number
  spaCommissionRate?: number
  employmentType?: string
  joinDate?: string
}

export interface UpdateStaffDto {
  fullName?: string
  role?: string
  status?: string
  phone?: string
  email?: string
  branchId?: string
  authorizedBranchIds?: string[]

  gender?: string
  dob?: string
  identityCode?: string
  emergencyContactTitle?: string
  emergencyContactPhone?: string
  shiftStart?: string
  shiftEnd?: string
  baseSalary?: number
  spaCommissionRate?: number
  employmentType?: string
  joinDate?: string
  password?: string
  avatar?: string
}

export interface UploadDocumentDto {
  type: DocumentType
  description?: string
  expiresAt?: string
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CCCD_FRONT: 'CCCD mặt trước',
  CCCD_BACK: 'CCCD mặt sau',
  APPLICATION: 'Hồ sơ xin việc',
  CERTIFICATE: 'Bằng cấp / Chứng chỉ',
  CONTRACT: 'Hợp đồng lao động',
  HEALTH_CERT: 'Giấy khám sức khỏe',
  TRAINING_CERT: 'Chứng chỉ đào tạo',
  OTHER: 'Tài liệu khác',
}

export const DOCUMENT_TYPE_ICONS: Record<DocumentType, string> = {
  CCCD_FRONT: '🪪',
  CCCD_BACK: '🪪',
  APPLICATION: '📋',
  CERTIFICATE: '🎓',
  CONTRACT: '📄',
  HEALTH_CERT: '🏥',
  TRAINING_CERT: '📜',
  OTHER: '📁',
}

function withDocumentDownloadUrl(document: EmployeeDocument): EmployeeDocument {
  return {
    ...document,
    fileUrl: `${API_URL}/api/staff/${encodeURIComponent(document.userId)}/documents/${encodeURIComponent(document.id)}`,
  }
}

export const staffApi = {
  getAll: () => api.get<Staff[]>('/staff').then((r) => r.data),

  getById: (id: string) => api.get<Staff>(`/staff/${id}`).then((r) => r.data),

  create: (data: CreateStaffDto) => api.post<Staff>('/staff', data).then((r) => r.data),

  update: (id: string, data: UpdateStaffDto) =>
    api.patch<Staff>(`/staff/${id}`, data).then((r) => r.data),

  deactivate: (id: string) =>
    api.delete<{ id: string; staffCode: string; status: string }>(`/staff/${id}`).then((r) => r.data),

  bulkDeactivate: (ids: string[]) =>
    api.post<BulkDeleteResult>('/staff/bulk-delete', { ids }).then((r) => r.data),

  // Documents
  getDocuments: (userId: string) =>
    api.get<EmployeeDocument[]>(`/staff/${userId}/documents`).then((r) => r.data.map(withDocumentDownloadUrl)),

  uploadDocument: (userId: string, file: File, data: UploadDocumentDto) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', data.type)
    if (data.description) formData.append('description', data.description)
    if (data.expiresAt) formData.append('expiresAt', data.expiresAt)

    return api
      .post<EmployeeDocument>(`/staff/${userId}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => withDocumentDownloadUrl(r.data))
  },

  deleteDocument: (userId: string, docId: string) =>
    api.delete(`/staff/${userId}/documents/${docId}`).then((r) => r.data),

  // Performance & Branch Roles
  getPerformance: (userId: string, month?: number, year?: number) => {
    const params = new URLSearchParams()
    if (month) params.append('month', String(month))
    if (year) params.append('year', String(year))

    return api.get<StaffPerformance>(`/staff/${userId}/performance?${params}`).then((r) => r.data)
  },

  getBranchRoles: (userId: string) => api.get<BranchRole[]>(`/staff/${userId}/branch-roles`).then((r) => r.data),

  // Attendance & Salary
  getAttendance: (userId: string, month?: number, year?: number) => {
    const params = new URLSearchParams()
    if (month) params.append('month', String(month))
    if (year) params.append('year', String(year))

    return api.get<AttendanceData>(`/staff/${userId}/attendance?${params}`).then((r) => r.data)
  },

  getSalary: (userId: string, month?: number, year?: number) => {
    const params = new URLSearchParams()
    if (month) params.append('month', String(month))
    if (year) params.append('year', String(year))

    return api.get<SalaryData>(`/staff/${userId}/salary?${params}`).then((r) => r.data)
  },
}
