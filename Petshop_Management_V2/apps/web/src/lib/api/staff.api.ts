import { api } from '../api'

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

export const staffApi = {
  getAll: () => api.get<Staff[]>('/staff').then((r) => r.data),
  
  getById: (id: string) => api.get<Staff>(`/staff/${id}`).then((r) => r.data),
  
  create: (data: CreateStaffDto) => api.post<Staff>('/staff', data).then((r) => r.data),
  
  update: (id: string, data: UpdateStaffDto) => 
    api.patch<Staff>(`/staff/${id}`, data).then((r) => r.data),
    
  deactivate: (id: string) => 
    api.delete<{ id: string, staffCode: string, status: string }>(`/staff/${id}`).then((r) => r.data),
}
