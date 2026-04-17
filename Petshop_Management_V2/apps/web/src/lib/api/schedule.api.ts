import { api } from '@/lib/api'

export type ScheduleStatus = 'ACTIVE' | 'CANCELLED' | 'COMPLETED'

export type StaffSchedule = {
    id: string
    userId: string
    branchId: string
    date: string // ISO Date string
    shiftType: string
    startTime: string // HH:mm
    endTime: string // HH:mm
    isActive: boolean
    note?: string | null
    createdAt: string
    updatedAt: string
}

export type CreateSchedulePayload = {
    userId: string
    branchId: string
    date: string
    shiftType: string
    startTime: string
    endTime: string
    note?: string
    isActive?: boolean
}

export type CreateScheduleDto = {
    userId: string
    branchId: string
    date: string
    shiftType: string
    startTime: string
    endTime: string
    note?: string
}

export type BulkCreateScheduleDto = {
    branchId: string
    userIds: string[]
    dates: string[]
    shiftType: string
    startTime: string
    endTime: string
}

export type BulkCreateSchedulePayload = {
    schedules: CreateSchedulePayload[]
}

export type ScheduleListParams = {
    startDate?: string
    endDate?: string
    userId?: string
    branchId?: string
}

export const scheduleApi = {
    list: (params?: ScheduleListParams) =>
        api
            .get('/schedule', { params })
            .then((response) => (Array.isArray(response.data?.data) ? response.data.data : []) as StaffSchedule[]),

    getById: (id: string) =>
        api
            .get(`/schedule/${id}`)
            .then((response) => response.data.data as StaffSchedule),

    create: (payload: CreateScheduleDto) =>
        api
            .post('/schedule', payload)
            .then((response) => response.data.data as StaffSchedule),

    bulkCreate: (payload: BulkCreateScheduleDto) =>
        api
            .post('/schedule/bulk', payload)
            .then((response) => response.data.data as { count: number }),

    update: (id: string, payload: Partial<CreateScheduleDto & { isActive: boolean }>) =>
        api
            .patch(`/schedule/${id}`, payload)
            .then((response) => response.data.data as StaffSchedule),

    delete: (id: string) =>
        api
            .delete(`/schedule/${id}`)
            .then((response) => response.data.data as { id: string }),
}
