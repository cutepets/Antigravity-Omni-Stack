import { api } from '@/lib/api'

export type EquipmentStatus = 'IN_USE' | 'STANDBY' | 'MAINTENANCE' | 'BROKEN' | 'LIQUIDATED'

export type EquipmentBranch = {
  id: string
  code: string
  name: string
}

export type EquipmentCategory = {
  id: string
  name: string
  description?: string | null
  isActive: boolean
  sortOrder: number
}

export type EquipmentLocationPreset = {
  id: string
  branchId: string
  name: string
  description?: string | null
  isActive: boolean
  sortOrder: number
  branch?: EquipmentBranch | null
}

export type EquipmentHistoryEntry = {
  id: string
  action: string
  summary: string
  diffJson?: Record<string, unknown> | null
  createdAt: string
  actor?: {
    id: string
    fullName: string
    username: string
  } | null
}

export type EquipmentItem = {
  id: string
  code: string
  name: string
  model?: string | null
  status: EquipmentStatus
  imageUrl?: string | null
  serialNumber?: string | null
  purchaseDate?: string | null
  inServiceDate?: string | null
  warrantyUntil?: string | null
  purchaseValue?: number | null
  branchId: string
  categoryId?: string | null
  locationPresetId?: string | null
  holderName?: string | null
  note?: string | null
  archivedAt?: string | null
  branch?: EquipmentBranch | null
  category?: EquipmentCategory | null
  locationPreset?: EquipmentLocationPreset | null
  createdBy?: { id: string; fullName: string; username: string } | null
  updatedBy?: { id: string; fullName: string; username: string } | null
  history?: EquipmentHistoryEntry[]
  createdAt?: string
  updatedAt?: string
}

export type EquipmentListResponse = {
  success: boolean
  data: EquipmentItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type EquipmentListParams = {
  search?: string
  status?: EquipmentStatus | ''
  categoryId?: string
  branchId?: string
  locationPresetId?: string
  includeArchived?: boolean
  warrantyWindowDays?: number
}

export type EquipmentPayload = {
  code?: string
  name: string
  model?: string | null
  categoryId?: string | null
  status?: EquipmentStatus
  imageUrl?: string | null
  serialNumber?: string | null
  purchaseDate?: string | null
  inServiceDate?: string | null
  warrantyUntil?: string | null
  purchaseValue?: number | null
  branchId?: string | null
  locationPresetId?: string | null
  holderName?: string | null
  note?: string | null
}

export const equipmentApi = {
  list: async (params?: EquipmentListParams) =>
    api.get<EquipmentListResponse>('/equipment', { params }).then((res) => res.data),

  suggestNextCode: async () =>
    api.get<{ success: boolean; data: { code: string } }>('/equipment/next-code').then((res) => res.data.data.code),

  getByCode: async (code: string) =>
    api.get<{ success: boolean; data: EquipmentItem }>(`/equipment/code/${code}`).then((res) => res.data.data),

  getHistory: async (id: string) =>
    api.get<{ success: boolean; data: EquipmentHistoryEntry[] }>(`/equipment/${id}/history`).then((res) => res.data.data),

  create: async (payload: EquipmentPayload) =>
    api.post<{ success: boolean; data: EquipmentItem }>('/equipment', payload).then((res) => res.data.data),

  update: async (id: string, payload: Partial<EquipmentPayload>) =>
    api.patch<{ success: boolean; data: EquipmentItem }>(`/equipment/${id}`, payload).then((res) => res.data.data),

  archive: async (id: string) =>
    api.post<{ success: boolean; data: EquipmentItem }>(`/equipment/${id}/archive`).then((res) => res.data.data),

  resolveScan: async (code: string) =>
    api
      .post<{
        success: boolean
        data: { found: boolean; draft?: { code: string }; equipment?: EquipmentItem }
      }>('/equipment/scan/resolve', { code })
      .then((res) => res.data.data),

  getCategories: async () =>
    api.get<{ success: boolean; data: EquipmentCategory[] }>('/equipment/categories/list').then((res) => res.data.data),

  createCategory: async (payload: { name: string; description?: string | null; sortOrder?: number; isActive?: boolean }) =>
    api.post<{ success: boolean; data: EquipmentCategory }>('/equipment/categories', payload).then((res) => res.data.data),

  updateCategory: async (
    id: string,
    payload: Partial<{ name: string; description?: string | null; sortOrder?: number; isActive?: boolean }>,
  ) => api.patch<{ success: boolean; data: EquipmentCategory }>(`/equipment/categories/${id}`, payload).then((res) => res.data.data),

  getLocations: async (branchId?: string) =>
    api
      .get<{ success: boolean; data: EquipmentLocationPreset[] }>('/equipment/locations/list', {
        params: branchId ? { branchId } : undefined,
      })
      .then((res) => res.data.data),

  createLocation: async (payload: {
    branchId?: string | null
    name: string
    description?: string | null
    sortOrder?: number
    isActive?: boolean
  }) => api.post<{ success: boolean; data: EquipmentLocationPreset }>('/equipment/locations', payload).then((res) => res.data.data),

  updateLocation: async (
    id: string,
    payload: Partial<{
      branchId?: string | null
      name: string
      description?: string | null
      sortOrder?: number
      isActive?: boolean
    }>,
  ) => api.patch<{ success: boolean; data: EquipmentLocationPreset }>(`/equipment/locations/${id}`, payload).then((res) => res.data.data),

  uploadImage: async (file: File, displayName?: string) => {
    const formData = new FormData()
    formData.append('image', file)
    if (displayName) formData.append('displayName', displayName)
    const response = await api.post<{ success: boolean; url: string }>('/equipment/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data.url
  },
}
