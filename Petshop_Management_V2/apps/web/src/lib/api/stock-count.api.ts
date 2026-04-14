import { api } from '@/lib/api'

const API_BASE = '/stock-count'

export const stockCountApi = {
  createSession: (data: {
    branchId: string
    weekNumber: number
    year: number
    startDate: string
    endDate: string
  }) => api.post(`${API_BASE}/sessions`, data),

  getSessions: (params: {
    branchId: string
    weekNumber?: number
    year?: number
    page?: number
    limit?: number
  }) => api.get(`${API_BASE}/sessions`, { params }),

  getSession: (id: string) => api.get(`${API_BASE}/sessions/${id}`),

  assignShifts: (sessionId: string, data: { productIds?: string[]; category?: string }) =>
    api.post(`${API_BASE}/sessions/${sessionId}/assign-shifts`, data),

  claimRandomShift: (sessionId: string, data: { countDate: string; notes?: string }) =>
    api.post(`${API_BASE}/sessions/${sessionId}/claim-random-shift`, data),

  getShiftSession: (shiftId: string) => api.get(`${API_BASE}/shifts/${shiftId}`),

  startShiftSession: (shiftId: string, data?: { notes?: string }) =>
    api.post(`${API_BASE}/shifts/${shiftId}/start`, data),

  completeShiftSession: (shiftId: string) => api.post(`${API_BASE}/shifts/${shiftId}/complete`),

  submitCountItem: (itemId: string, data: { variance: number; notes?: string }) =>
    api.post(`${API_BASE}/items/${itemId}/count`, data),

  approveSession: (sessionId: string) => api.post(`${API_BASE}/sessions/${sessionId}/approve`),

  rejectSession: (sessionId: string, data: { rejectionReason: string }) =>
    api.post(`${API_BASE}/sessions/${sessionId}/reject`, data),

  getWeeklyProgress: (branchId: string, weekNumber: number, year: number) =>
    api.get(`${API_BASE}/progress/${branchId}/${weekNumber}/${year}`),
}
