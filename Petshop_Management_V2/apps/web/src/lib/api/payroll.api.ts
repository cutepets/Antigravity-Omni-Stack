import { api } from '@/lib/api'

export type PayrollPeriodStatus = 'DRAFT' | 'FINALIZED' | 'CLOSED'
export type PayrollSlipStatus = 'DRAFT' | 'FINALIZED' | 'PAID' | 'CANCELLED'

export type PayrollPeriod = {
    id: string
    name: string
    month: number
    year: number
    startDate: string
    endDate: string
    status: PayrollPeriodStatus
    totalBaseSalary: number
    totalGrossSalary: number
    totalDeductions: number
    totalNetSalary: number
    createdAt: string
    updatedAt: string
}

export type PayrollSlip = {
    id: string
    periodId: string
    staffId: string
    status: PayrollSlipStatus
    baseSalary: number
    actualWorkDays: number
    overtimeHours: number
    overtimePay: number
    commissionSpa: number
    commissionHotel: number
    commissionSales: number
    allowances: number
    grossSalary: number
    bhxh: number
    bhyt: number
    bhtn: number
    pit: number
    advances: number
    penalties: number
    totalDeductions: number
    netSalary: number
    notes?: string | null
    createdAt: string
    updatedAt: string
    staff?: any // Mở rộng nếu backend include
    lineItems?: PayrollLineItem[]
}

export type PayrollItemType = 'INCOME' | 'DEDUCTION' | 'TAX' | 'ALLOWANCE' | 'COMMISSION'
export type PayrollLineItem = {
    id: string
    slipId: string
    type: PayrollItemType
    amount: number
    description: string
    referenceId?: string | null
    createdAt: string
}

export type CreatePayrollPeriodPayload = {
    month: number
    year: number
    name: string
    startDate: string
    endDate: string
}

export type CalculatePayrollPayload = {
    periodId: string
}

export type UpdateSlipPayload = {
    allowances?: number
    advances?: number
    penalties?: number
    notes?: string
}

export type PayrollSlipListParams = {
    periodId?: string
    staffId?: string
    status?: PayrollSlipStatus
}

export const payrollApi = {
    // Periods
    listPeriods: () =>
        api
            .get('/payroll/periods')
            .then((response) => response.data.data as PayrollPeriod[]),

    createPeriod: (payload: CreatePayrollPeriodPayload) =>
        api
            .post('/payroll/periods', payload)
            .then((response) => response.data.data as PayrollPeriod),

    // Calculate
    calculate: (payload: CalculatePayrollPayload) =>
        api
            .post('/payroll/calculate', payload)
            .then((response) => response.data.data as { count: number }),

    // Slips
    listSlips: (params?: PayrollSlipListParams) =>
        api
            .get('/payroll/slips', { params })
            .then((response) => response.data.data as PayrollSlip[]),

    getSlipById: (slipId: string) =>
        api
            .get(`/payroll/slips/${slipId}`)
            .then((response) => response.data.data as PayrollSlip),

    updateSlip: (slipId: string, payload: UpdateSlipPayload) =>
        api
            .patch(`/payroll/slips/${slipId}`, payload)
            .then((response) => response.data.data as PayrollSlip),

    updateSlipStatus: (slipId: string, status: PayrollSlipStatus) =>
        api
            .patch(`/payroll/slips/${slipId}/status`, { status })
            .then((response) => response.data.data as PayrollSlip),
}
