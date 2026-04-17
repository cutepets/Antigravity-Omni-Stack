import { api } from '@/lib/api'

export type LeaveType = 'ANNUAL' | 'SICK' | 'UNPAID' | 'MATERNITY' | 'OTHER'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export type LeaveRequest = {
    id: string
    userId: string
    branchId: string
    leaveType: LeaveType
    startDate: string
    endDate: string
    totalDays: number
    reason: string
    attachmentUrl?: string | null
    status: LeaveStatus
    approvedBy?: string | null
    approvedAt?: string | null
    rejectedReason?: string | null
    createdAt: string
    updatedAt: string
}

export type CreateLeavePayload = {
    userId: string
    branchId: string
    leaveType: LeaveType
    startDate: string
    endDate: string
    totalDays: number
    reason: string
    attachmentUrl?: string
}

export type ApproveLeavePayload = {
    action: 'APPROVE' | 'REJECT'
    rejectedReason?: string
}

export type LeaveListParams = {
    userId?: string
    branchId?: string
    status?: LeaveStatus
    startDate?: string
    endDate?: string
    page?: number
    limit?: number
}

export const leaveApi = {
    list: (params?: LeaveListParams) =>
        api
            .get('/leave', { params })
            .then((response) => response.data.data), // Paginated response

    getById: (id: string) =>
        api
            .get(`/leave/${id}`)
            .then((response) => response.data.data as LeaveRequest),

    create: (payload: CreateLeavePayload) =>
        api
            .post('/leave', payload)
            .then((response) => response.data.data as LeaveRequest),

    approve: (id: string, payload: ApproveLeavePayload) =>
        api
            .patch(`/leave/${id}/approve`, payload)
            .then((response) => response.data.data as LeaveRequest),

    delete: (id: string) =>
        api
            .delete(`/leave/${id}`)
            .then((response) => response.data.data as { id: string }),

    getBalance: (staffId: string, year?: number) =>
        api
            .get('/leave/balance', { params: { staffId, year } })
            .then((response) => response.data.data),
}
