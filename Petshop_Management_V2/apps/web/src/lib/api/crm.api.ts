import { api } from '@/lib/api'

export type CrmExcelScope = 'customers' | 'pets' | 'all'
export type CrmCustomerExportScope = 'all' | 'filtered' | 'selected' | 'page'

export type CrmExcelIssue = {
  sheet: string
  row?: number
  column?: string
  message: string
}

export type CrmExcelPreviewResult = {
  summary: {
    customerCreateCount: number
    customerUpdateCount: number
    petCreateCount: number
    petUpdateCount: number
    skippedCount: number
    errorCount: number
    warningCount: number
  }
  errors: CrmExcelIssue[]
  warnings: CrmExcelIssue[]
  normalizedPayload: unknown | null
}

export type CrmCustomerExportRequest = {
  scope: CrmCustomerExportScope
  filters?: Record<string, any>
  customerIds?: string[]
  columns?: string[]
}

function filenameFromDisposition(disposition?: string) {
  if (!disposition) return null
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1])
  const match = disposition.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? null
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function uploadForm(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return formData
}

export const crmApi = {
  exportExcel: async (scope: CrmExcelScope = 'all') => {
    const res = await api.get<Blob>('/crm/excel-export', {
      params: { scope },
      responseType: 'blob',
    })
    const filename = filenameFromDisposition(res.headers['content-disposition']) ?? `crm-${scope}.xlsx`
    downloadBlob(res.data, filename)
    return { filename }
  },

  downloadTemplate: async () => {
    const res = await api.get<Blob>('/crm/excel-template', {
      responseType: 'blob',
    })
    const filename = filenameFromDisposition(res.headers['content-disposition']) ?? 'crm-template.xlsx'
    downloadBlob(res.data, filename)
    return { filename }
  },

  exportCustomers: async (payload: CrmCustomerExportRequest) => {
    const res = await api.post<Blob>('/crm/customers/export', payload, {
      responseType: 'blob',
    })
    const filename = filenameFromDisposition(res.headers['content-disposition']) ?? `khach-hang-${payload.scope}.xlsx`
    downloadBlob(res.data, filename)
    return { filename }
  },

  previewImport: async (file: File) => {
    const { data } = await api.post<CrmExcelPreviewResult>('/crm/excel-import/preview', uploadForm(file), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  applyImport: async (file: File) => {
    const { data } = await api.post<CrmExcelPreviewResult>('/crm/excel-import/apply', uploadForm(file), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
}
