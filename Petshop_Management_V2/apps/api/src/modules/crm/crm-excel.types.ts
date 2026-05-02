import type { JwtPayload } from '@petshop/shared'

export type CrmExcelScope = 'customers' | 'pets' | 'all'
export type CrmCustomerExportScope = 'all' | 'filtered' | 'selected' | 'page'

export type CrmExcelIssue = {
  sheet: string
  row?: number
  column?: string
  message: string
}

export type CrmExcelSummary = {
  customerCreateCount: number
  customerUpdateCount: number
  petCreateCount: number
  petUpdateCount: number
  skippedCount: number
  errorCount: number
  warningCount: number
}

export type NormalizedCustomerImportRow = {
  row: number
  action: 'create' | 'update'
  existingId?: string
  customerCode?: string
  phone: string
  previousPoints?: number
  data: Record<string, unknown>
}

export type NormalizedPetImportRow = {
  row: number
  action: 'create' | 'update'
  existingId?: string
  petCode?: string
  ownerCustomerCode?: string
  data: Record<string, unknown>
}

export type CrmExcelNormalizedPayload = {
  customers: NormalizedCustomerImportRow[]
  pets: NormalizedPetImportRow[]
}

export type CrmExcelPreviewResult = {
  summary: CrmExcelSummary
  errors: CrmExcelIssue[]
  warnings: CrmExcelIssue[]
  normalizedPayload: CrmExcelNormalizedPayload | null
}

export type CrmExcelUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>

export type CrmCustomerExportRequest = {
  scope: CrmCustomerExportScope
  filters?: {
    search?: string
    page?: number
    limit?: number
    tier?: string
    groupId?: string
    isActive?: boolean | string
    branchId?: string
    dateFrom?: string
    dateTo?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }
  customerIds?: string[]
  columns?: string[]
}
