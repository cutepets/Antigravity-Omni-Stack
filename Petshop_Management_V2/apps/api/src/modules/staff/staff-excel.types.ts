export type StaffExcelUser = {
  userId?: string
  role?: string
  permissions?: string[]
  branchId?: string | null
}

export type StaffExcelIssue = {
  sheet: string
  row?: number
  column?: string
  message: string
}

export type NormalizedStaffImportRow = {
  row: number
  action: 'create' | 'update'
  existingId?: string
  username?: string
  password?: string
  data: Record<string, unknown>
}

export type StaffExcelNormalizedPayload = {
  rows: NormalizedStaffImportRow[]
}

export type StaffExcelSummary = {
  createCount: number
  updateCount: number
  skippedCount: number
  errorCount: number
  warningCount: number
}

export type StaffExcelPreviewResult = {
  summary: StaffExcelSummary
  errors: StaffExcelIssue[]
  warnings: StaffExcelIssue[]
  normalizedPayload: StaffExcelNormalizedPayload | null
}
