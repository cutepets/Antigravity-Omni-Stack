import { api } from '@/lib/api'

export type AttendanceStatus = 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ABSENT' | 'ON_LEAVE'

export type AttendanceRecord = {
    id: string
    staffId: string
    date: string
    checkInTime?: string | null
    checkOutTime?: string | null
    status: AttendanceStatus
    faceConfidence?: number | null
    isManualEntry: boolean
    manualReason?: string | null
    managerNote?: string | null
    reviewedBy?: string | null
    reviewedAt?: string | null
    scheduleId?: string | null
    createdAt: string
    updatedAt: string
}

export type ClockInPayload = {
    staffId: string
    faceConfidence?: number
    note?: string
}

export type ClockOutPayload = {
    staffId: string
    faceConfidence?: number
    note?: string
}

export type ManualAttendancePayload = {
    staffId: string
    date: string
    checkInTime?: string
    checkOutTime?: string
    status: AttendanceStatus
    manualReason?: string
    scheduleId?: string
}

export type ReviewAttendancePayload = {
    status: AttendanceStatus
    managerNote?: string
}

export type BulkReviewPayload = {
    recordIds: string[]
    status: AttendanceStatus
    managerNote?: string
}

export type AttendanceListParams = {
    startDate?: string
    endDate?: string
    staffId?: string
    status?: AttendanceStatus
    isManualEntry?: boolean
    page?: number
    limit?: number
}

export const attendanceApi = {
    list: (params?: AttendanceListParams) =>
        api
            .get('/attendance', { params })
            .then((response) => response.data.data), // Return paginated data from backend

    getById: (id: string) =>
        api
            .get(`/attendance/${id}`)
            .then((response) => response.data.data as AttendanceRecord),

    clockIn: (payload: ClockInPayload) =>
        api
            .post('/attendance/clock-in', payload)
            .then((response) => response.data.data as AttendanceRecord),

    clockOut: (payload: ClockOutPayload) =>
        api
            .post('/attendance/clock-out', payload)
            .then((response) => response.data.data as AttendanceRecord),

    manualRecord: (payload: ManualAttendancePayload) =>
        api
            .post('/attendance/manual', payload)
            .then((response) => response.data.data as AttendanceRecord),

    review: (id: string, payload: ReviewAttendancePayload) =>
        api
            .patch(`/attendance/${id}/review`, payload)
            .then((response) => response.data.data as AttendanceRecord),

    bulkReview: (payload: BulkReviewPayload) =>
        api
            .patch('/attendance/bulk-review', payload)
            .then((response) => response.data.data as { count: number }),
}
