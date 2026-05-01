import { API_URL, api } from '@/lib/api'

export type CashbookCategory = {
  id: string
  type: 'INCOME' | 'EXPENSE'
  name: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type BankTransferAccount = {
  id: string
  name: string
  bankName: string
  accountNumber: string
  accountHolder: string
  notes: string | null
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type PaymentMethodType = 'CASH' | 'BANK' | 'EWALLET' | 'CARD' | 'POINTS'
export type PaymentMethodColorKey = 'emerald' | 'sky' | 'amber' | 'orange' | 'violet' | 'rose' | 'cyan' | 'slate'
export type PaymentQrProvider = 'VIETQR'

export type PaymentOptions = {
  allowMultiPayment: boolean
  loyaltyPointValue?: number
  orderReturnWindowDays?: number
}

export type PaymentWebhookSecret = {
  id: string
  name: string
  provider: string
  secretPreview: string
  createdAt: string
  updatedAt: string
  lastUsedAt: string | null
}

export type CreatedPaymentWebhookSecret = PaymentWebhookSecret & {
  secret: string
}

export type BankTransactionInboxItem = {
  id: string
  provider: string
  amount: number
  currency: string
  direction: string
  accountNumber: string
  bankBin: string | null
  description: string
  normalizedDescription: string
  status: 'RECEIVED' | 'SUGGESTED' | 'APPLIED' | 'REVIEW' | 'DUPLICATE' | 'IGNORED' | 'REJECTED'
  classification: 'UNCLASSIFIED' | 'SALES_PAYMENT' | 'SUPPLIER_PAYMENT' | 'CUSTOMER_CREDIT' | 'MANUAL_TRANSACTION'
  isTest: boolean
  sourceCount: number
  note: string | null
  txnAt: string | null
  processedAt: string | null
  createdAt: string | null
  matchedPaymentIntent: {
    id: string
    code: string
    status: 'PENDING' | 'PAID' | 'EXPIRED'
    orderId: string | null
    orderNumber: string | null
    amount: number
    transferContent: string
  } | null
}

export type PaymentWebhookTestResult = {
  ok: boolean
  persisted: boolean
  status: 'matched' | 'already_paid' | 'unmatched'
  bankTransaction: BankTransactionInboxItem
  normalizedEvent: {
    provider: string
    accountNumber: string
    bankBin: string | null
    amount: number
    currency: string
    direction: 'IN' | 'OUT'
    description: string
    normalizedDescription: string
    txnAt: string | null
  }
  matchedPaymentIntent: {
    id: string
    code: string
    status: 'PENDING' | 'PAID' | 'EXPIRED'
    orderId: string | null
    orderNumber: string | null
    amount: number
    paymentMethodId: string
    transferContent: string
  } | null
}

export type PaymentMethod = {
  id: string
  code: string | null
  name: string
  type: PaymentMethodType
  colorKey: PaymentMethodColorKey
  isSystem: boolean
  isDefault: boolean
  isActive: boolean
  sortOrder: number
  minAmount: number | null
  maxAmount: number | null
  timeFrom: string | null
  timeTo: string | null
  weekdays: number[]
  branchIds: string[]
  notes: string | null
  bankName: string | null
  accountNumber: string | null
  accountHolder: string | null
  qrEnabled: boolean
  qrProvider: PaymentQrProvider | null
  qrBankBin: string | null
  qrTemplate: string | null
  transferNotePrefix: string | null
  createdAt: string
  updatedAt: string
}

export type SettingsBranch = {
  id: string
  code: string
  name: string
  address?: string | null
  phone?: string | null
  isActive?: boolean
}

export type PrintTemplate = {
  id: string
  type: string
  name: string
  content: string
  paperSize: string
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export type BackupCatalogEntry = {
  moduleId: string
  label: string
  moduleVersion: number
  dependencies: string[]
  requiredBy: string[]
  keepsFileRefs: boolean
  supportedImportVersions: number[]
}

export type BackupDataBlockCatalogEntry = {
  blockId: 'configuration' | 'staff_equipment' | 'customers_pets' | 'operations'
  label: string
  description: string
  moduleIds: string[]
}

export type BackupCatalogResult = {
  modules: BackupCatalogEntry[]
  dataBlocks: BackupDataBlockCatalogEntry[]
}

export type BackupInspectModuleResult = BackupCatalogEntry & {
  fileModuleVersion: number
  recordCounts: Record<string, number>
  compatible: boolean
  compatibilityReason: string | null
}

export type BackupInspectResult = {
  manifest: {
    appId: string
    appVersion: string
    formatName: string
    formatVersion: number
    createdAt: string
    createdBy: string | null
    schemaFingerprint: string
    selectedModules: string[]
    excludedBinaryContent: true
    keepsFileRefs: true
    containsSecrets: boolean
    modules: Array<{
      moduleId: string
      label: string
      moduleVersion: number
      dependencies: string[]
      recordCounts: Record<string, number>
    }>
  }
  modules: BackupInspectModuleResult[]
  warnings: string[]
}

export type BackupRestoreResult = {
  strategy: 'replace_selected'
  schemaMatched: boolean
  restoredModules: string[]
  warnings: string[]
}

export type BackupExportPayload = {
  modules: string[]
  destination: 'download' | 'google_drive'
  password: string
}

export type BackupExportResult =
  | {
    kind: 'download'
    fileName: string
    blob: Blob
    manifest: BackupInspectResult['manifest'] | null
  }
  | {
    kind: 'google_drive'
    data: {
      fileName: string
      size: number
      asset: {
        id: string
        url: string
        originalName: string
      }
      manifest: BackupInspectResult['manifest']
    }
  }

function parseFileNameFromDisposition(disposition: string | null) {
  if (!disposition) return null
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const plainMatch = disposition.match(/filename="?([^"]+)"?/i)
  if (plainMatch?.[1]) {
    return plainMatch[1]
  }

  return null
}

async function parseErrorResponse(response: Response) {
  const payload = await response.json().catch(() => ({}))
  const message =
    (payload as { message?: string }).message ||
    (payload as { error?: string }).error ||
    `HTTP ${response.status}`

  throw new Error(message)
}

export const settingsApi = {
  getBackupCatalog: async (): Promise<BackupCatalogResult> => {
    const { data } = await api.get('/settings/backups/catalog')
    const payload = data.data ?? {}

    if (Array.isArray(payload)) {
      return {
        modules: payload,
        dataBlocks: [],
      }
    }

    return {
      modules: Array.isArray(payload.modules) ? payload.modules : [],
      dataBlocks: Array.isArray(payload.dataBlocks) ? payload.dataBlocks : [],
    }
  },

  exportBackup: async (payload: BackupExportPayload): Promise<BackupExportResult> => {
    const response = await fetch(`${API_URL}/api/settings/backups/export`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      await parseErrorResponse(response)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const data = await response.json()
      return {
        kind: 'google_drive',
        data: data.data,
      }
    }

    return {
      kind: 'download',
      fileName:
        parseFileNameFromDisposition(response.headers.get('content-disposition')) ??
        'backup.appbak',
      blob: await response.blob(),
      manifest: null,
    }
  },

  inspectBackup: async (file: File, password: string): Promise<BackupInspectResult> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('password', password)

    const { data } = await api.post('/settings/backups/inspect', formData)
    return data.data as BackupInspectResult
  },

  restoreBackup: async (payload: {
    file: File
    password: string
    modules: string[]
    strategy?: 'replace_selected'
  }): Promise<BackupRestoreResult> => {
    const formData = new FormData()
    formData.append('file', payload.file)
    formData.append('password', payload.password)
    formData.append('modules', JSON.stringify(payload.modules))
    formData.append('strategy', payload.strategy ?? 'replace_selected')

    const { data } = await api.post('/settings/backups/restore', formData)
    return data.data as BackupRestoreResult
  },

  getPrintTemplates: async (): Promise<PrintTemplate[]> => {
    const { data } = await api.get('/settings/print-templates')
    return data.data ?? []
  },

  getPrintTemplateByType: async (type: string): Promise<PrintTemplate> => {
    const { data } = await api.get(`/settings/print-templates/${type}`)
    return data.data
  },

  updatePrintTemplate: async (type: string, payload: { content: string; paperSize: string }): Promise<PrintTemplate> => {
    const { data } = await api.put(`/settings/print-templates/${type}`, payload)
    return data.data
  },

  getConfigs: async (keys?: string[]): Promise<Record<string, any>> => {
    const { data } = await api.get('/settings/configs', { params: { keys: keys?.join(',') } })
    if (data.success) {
      // Assume API returns { success: true, data: { key: value, ... } }
      return data.data
    }
    return {}
  },

  updateConfigs: async (payload: Record<string, any>) => {
    const { data } = await api.put('/settings/configs', payload)
    return data
  },

  getCashbookCategories: async (type?: 'INCOME' | 'EXPENSE'): Promise<CashbookCategory[]> => {
    const { data } = await api.get('/settings/cashbook-categories', { params: type ? { type } : undefined })
    return data.data ?? []
  },

  createCashbookCategory: async (payload: { type: 'INCOME' | 'EXPENSE'; name: string }) => {
    const { data } = await api.post('/settings/cashbook-categories', payload)
    return data.data as CashbookCategory
  },

  updateCashbookCategory: async (id: string, payload: Partial<{ name: string; isActive: boolean; sortOrder: number }>) => {
    const { data } = await api.put(`/settings/cashbook-categories/${id}`, payload)
    return data.data as CashbookCategory
  },

  deleteCashbookCategory: async (id: string) => {
    const { data } = await api.delete(`/settings/cashbook-categories/${id}`)
    return data
  },

  getBranches: async (): Promise<SettingsBranch[]> => {
    const { data } = await api.get('/settings/branches')
    return data.data ?? []
  },

  getPaymentMethods: async (): Promise<PaymentMethod[]> => {
    const { data } = await api.get('/settings/payment-methods')
    return data.data ?? []
  },

  getPaymentOptions: async (): Promise<PaymentOptions> => {
    const { data } = await api.get('/settings/payment-options')
    return data.data ?? { allowMultiPayment: false }
  },

  updatePaymentOptions: async (payload: PaymentOptions) => {
    const { data } = await api.put('/settings/payment-options', payload)
    return data.data as PaymentOptions
  },

  getPaymentWebhookSecrets: async (): Promise<PaymentWebhookSecret[]> => {
    const { data } = await api.get('/settings/payment-webhook-secrets')
    return data.data ?? []
  },

  createPaymentWebhookSecret: async (payload: { name: string; provider: string }) => {
    const { data } = await api.post('/settings/payment-webhook-secrets', payload)
    return data.data as CreatedPaymentWebhookSecret
  },

  testPaymentWebhook: async (payload: { provider: string; payload: Record<string, unknown> }) => {
    const { data } = await api.post('/settings/payment-webhook-secrets/test', payload)
    return data.data as PaymentWebhookTestResult
  },

  getBankTransactions: async (params?: {
    scope?: 'all' | 'test' | 'real'
    status?: string
    search?: string
  }) => {
    const { data } = await api.get('/settings/bank-transactions', { params })
    if (Array.isArray(data)) {
      return data as BankTransactionInboxItem[]
    }

    return (data.data ?? []) as BankTransactionInboxItem[]
  },

  deleteBankTransaction: async (id: string) => {
    const { data } = await api.delete(`/settings/bank-transactions/${id}`)
    return data
  },

  deletePaymentWebhookSecret: async (id: string) => {
    const { data } = await api.delete(`/settings/payment-webhook-secrets/${id}`)
    return data
  },

  createPaymentMethod: async (payload: {
    name: string
    type: PaymentMethodType
    colorKey?: PaymentMethodColorKey | null
    isDefault?: boolean
    isActive?: boolean
    sortOrder?: number
    minAmount?: number | null
    maxAmount?: number | null
    timeFrom?: string | null
    timeTo?: string | null
    weekdays?: number[]
    branchIds?: string[]
    notes?: string | null
    bankName?: string | null
    accountNumber?: string | null
    accountHolder?: string | null
    qrEnabled?: boolean
    qrProvider?: PaymentQrProvider | null
    qrBankBin?: string | null
    qrTemplate?: string | null
    transferNotePrefix?: string | null
  }) => {
    const { data } = await api.post('/settings/payment-methods', payload)
    return data.data as PaymentMethod
  },

  updatePaymentMethod: async (
    id: string,
    payload: Partial<{
      name: string
      type: PaymentMethodType
      colorKey: PaymentMethodColorKey | null
      isDefault: boolean
      isActive: boolean
      sortOrder: number
      minAmount: number | null
      maxAmount: number | null
      timeFrom: string | null
      timeTo: string | null
      weekdays: number[]
      branchIds: string[]
      notes: string | null
      bankName: string | null
      accountNumber: string | null
      accountHolder: string | null
      qrEnabled: boolean
      qrProvider: PaymentQrProvider | null
      qrBankBin: string | null
      qrTemplate: string | null
      transferNotePrefix: string | null
    }>,
  ) => {
    const { data } = await api.put(`/settings/payment-methods/${id}`, payload)
    return data.data as PaymentMethod
  },

  deletePaymentMethod: async (id: string) => {
    const { data } = await api.delete(`/settings/payment-methods/${id}`)
    return data
  },

  getBankTransferAccounts: async (): Promise<BankTransferAccount[]> => {
    const { data } = await api.get('/settings/bank-transfer-accounts')
    return data.data ?? []
  },

  createBankTransferAccount: async (payload: {
    name: string
    bankName: string
    accountNumber: string
    accountHolder: string
    notes?: string
    isDefault?: boolean
    isActive?: boolean
  }) => {
    const { data } = await api.post('/settings/bank-transfer-accounts', payload)
    return data.data as BankTransferAccount
  },

  updateBankTransferAccount: async (
    id: string,
    payload: Partial<{
      name: string
      bankName: string
      accountNumber: string
      accountHolder: string
      notes: string | null
      isDefault: boolean
      isActive: boolean
    }>,
  ) => {
    const { data } = await api.put(`/settings/bank-transfer-accounts/${id}`, payload)
    return data.data as BankTransferAccount
  },

  deleteBankTransferAccount: async (id: string) => {
    const { data } = await api.delete(`/settings/bank-transfer-accounts/${id}`)
    return data
  },

  getAbout: async (): Promise<{
    appId: string
    version: string
    nodeEnv: string
    buildNumber: string | null
    gitSha: string | null
    buildDate: string | null
  }> => {
    const { data } = await api.get('/settings/about')
    return data.data
  },

  purgeData: async (superAdminPassword: string) => {
    const { data } = await api.delete('/settings/purge', {
      data: { superAdminPassword },
    })
    return data.data as { purgedModules: string[] }
  },
}
