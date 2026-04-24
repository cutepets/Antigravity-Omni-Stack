'use client'
import Image from 'next/image';

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Banknote,
  ChevronDown,
  Check,
  Copy,
  CreditCard,
  Edit2,
  Landmark,
  Loader2,
  Plus,
  Search,
  Smartphone,
  Star,
  Trash2,
} from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthorization } from '@/hooks/useAuthorization'
import {
  getPaymentMethodColorClasses,
  PAYMENT_METHOD_TYPE_LABELS,
  PAYMENT_METHOD_COLOR_OPTIONS,
  PAYMENT_METHOD_TYPE_OPTIONS,
  summarizePaymentMethodConditions,
  WEEKDAY_OPTIONS,
} from '@/lib/payment-methods'
import {
  settingsApi,
  type CreatedPaymentWebhookSecret,
  type PaymentMethod,
  type PaymentMethodColorKey,
  type PaymentWebhookSecret,
  type PaymentWebhookTestResult,
  type PaymentMethodType,
  type SettingsBranch,
} from '@/lib/api/settings.api'
import { findVietQrBank, VIETQR_BANKS, type VietQrBank } from '@/lib/constants/vietqr-banks'
import { useAuthStore } from '@/stores/auth.store'
import { toast as systemToast } from 'sonner'


type PaymentMethodFormData = {
  name: string
  type: PaymentMethodType
  colorKey: PaymentMethodColorKey
  isDefault: boolean
  isActive: boolean
  sortOrder: string
  minAmount: string
  maxAmount: string
  timeFrom: string
  timeTo: string
  weekdays: number[]
  branchIds: string[]
  notes: string
  bankName: string
  accountNumber: string
  accountHolder: string
  qrEnabled: boolean
  qrBankBin: string
  qrTemplate: string
  transferNotePrefix: string
}

const EMPTY_FORM: PaymentMethodFormData = {
  name: '',
  type: 'BANK',
  colorKey: 'sky',
  isDefault: false,
  isActive: true,
  sortOrder: '',
  minAmount: '',
  maxAmount: '',
  timeFrom: '',
  timeTo: '',
  weekdays: [],
  branchIds: [],
  notes: '',
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  qrEnabled: false,
  qrBankBin: '',
  qrTemplate: 'compact2',
  transferNotePrefix: '',
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const WEBHOOK_PROVIDER_EXAMPLE = 'primary'
const WEBHOOK_SECRET_HEADER = 'x-webhook-secret'
const BANK_TRANSACTIONS_TAB_URL = '/finance?tab=bank-transactions'

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('vi-VN')
  } catch {
    return value
  }
}

function toFormData(method?: PaymentMethod | null): PaymentMethodFormData {
  if (!method) return EMPTY_FORM

  return {
    name: method.name,
    type: method.type,
    colorKey: method.colorKey,
    isDefault: method.isDefault,
    isActive: method.isActive,
    sortOrder: String(method.sortOrder ?? 0),
    minAmount: method.minAmount !== null && method.minAmount !== undefined ? String(method.minAmount) : '',
    maxAmount: method.maxAmount !== null && method.maxAmount !== undefined ? String(method.maxAmount) : '',
    timeFrom: method.timeFrom ?? '',
    timeTo: method.timeTo ?? '',
    weekdays: method.weekdays ?? [],
    branchIds: method.branchIds ?? [],
    notes: method.notes ?? '',
    bankName: method.bankName ?? '',
    accountNumber: method.accountNumber ?? '',
    accountHolder: method.accountHolder ?? '',
    qrEnabled: Boolean(method.qrEnabled),
    qrBankBin: method.qrBankBin ?? '',
    qrTemplate: method.qrTemplate ?? 'compact2',
    transferNotePrefix: method.transferNotePrefix ?? '',
  }
}

function normalizeOptionalNumber(value: string) {
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function buildSubmitPayload(formData: PaymentMethodFormData) {
  return {
    name: formData.name.trim(),
    type: formData.type,
    colorKey: formData.colorKey,
    isDefault: formData.isDefault,
    isActive: formData.isActive,
    sortOrder: Math.max(0, Number(formData.sortOrder) || 0),
    minAmount: normalizeOptionalNumber(formData.minAmount),
    maxAmount: normalizeOptionalNumber(formData.maxAmount),
    timeFrom: formData.timeFrom || null,
    timeTo: formData.timeTo || null,
    weekdays: formData.weekdays,
    branchIds: formData.branchIds,
    notes: formData.notes.trim() || null,
    bankName: formData.type === 'BANK' ? formData.bankName.trim() : null,
    accountNumber: formData.type === 'BANK' ? formData.accountNumber.trim() : null,
    accountHolder: formData.type === 'BANK' ? formData.accountHolder.trim() : null,
    qrEnabled: formData.type === 'BANK' ? formData.qrEnabled : false,
    qrProvider: formData.type === 'BANK' && formData.qrEnabled ? ('VIETQR' as const) : null,
    qrBankBin: formData.type === 'BANK' && formData.qrEnabled ? formData.qrBankBin.trim() : null,
    qrTemplate: formData.type === 'BANK' && formData.qrEnabled ? formData.qrTemplate.trim() || 'compact2' : null,
    transferNotePrefix:
      formData.type === 'BANK' && formData.qrEnabled ? formData.transferNotePrefix.trim().toUpperCase() || null : null,
  }
}

function getTypeIcon(type: PaymentMethodType) {
  if (type === 'CASH') return Banknote
  if (type === 'BANK') return Landmark
  if (type === 'EWALLET') return Smartphone
  return CreditCard
}

function sanitizeTransferToken(value: string, maxLength: number) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLength)
}

function buildTransferContentPreview(params: {
  prefix: string
  branchCode?: string | null
  orderCode?: string | null
  paymentAccountName?: string | null
}) {
  let prefix = sanitizeTransferToken(params.prefix, 5) || 'PET'
  let branchCode = sanitizeTransferToken(params.branchCode ?? '', 4) || 'CN'
  const orderCode = sanitizeTransferToken(params.orderCode ?? '', 14) || 'MADON'
  const paymentAccountName = sanitizeTransferToken(params.paymentAccountName ?? '', 6) || 'TK'

  let base = `${prefix}${branchCode}${orderCode}`
  if (base.length > 23 && prefix.length > 3) {
    const overflow = base.length - 23
    prefix = prefix.slice(0, Math.max(3, prefix.length - overflow))
    base = `${prefix}${branchCode}${orderCode}`
  }

  if (base.length > 23 && branchCode.length > 2) {
    const overflow = base.length - 23
    branchCode = branchCode.slice(0, Math.max(2, branchCode.length - overflow))
    base = `${prefix}${branchCode}${orderCode}`
  }

  const remaining = Math.max(0, 25 - base.length)
  const accountToken = paymentAccountName.slice(0, remaining)
  return `${base}${accountToken}`.slice(0, 25)
}

function BankCombobox({
  value,
  onChange,
  disabled,
}: {
  value: VietQrBank | null
  onChange: (bank: VietQrBank) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredBanks = useMemo(() => {
    const query = search.trim().toLowerCase()
    const availableBanks = VIETQR_BANKS.filter((bank) => bank.transferSupported || bank.isTransfer)
    if (!query) return availableBanks.slice(0, 40)

    return availableBanks
      .filter((bank) =>
        bank.shortName.toLowerCase().includes(query) ||
        bank.name.toLowerCase().includes(query) ||
        bank.code.toLowerCase().includes(query) ||
        bank.bin.includes(query),
      )
      .slice(0, 40)
  }, [search])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-left text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {value?.logo ? (
          <Image src={value.logo} alt={value.shortName} className="h-6 w-6 rounded-full bg-white object-contain p-0.5" width={400} height={400} unoptimized />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500/15 text-[10px] font-bold text-primary-500">
            {(value?.shortName ?? 'NH').slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {value ? (
            <>
              <div className="truncate font-semibold text-foreground-base">{value.shortName}</div>
              <div className="truncate text-xs text-foreground-muted">
                {value.code} • BIN {value.bin}
              </div>
            </>
          ) : (
            <>
              <div className="font-semibold text-foreground-base">Chọn ngân hàng</div>
              <div className="text-xs text-foreground-muted">Tìm theo tên ngân hàng, mã code hoặc BIN</div>
            </>
          )}
        </div>
        <ChevronDown size={16} className={`shrink-0 text-foreground-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border/60 bg-background-secondary shadow-2xl">
          <div className="border-b border-border/50 p-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Techcombank, VCB, 970407..."
                className="w-full rounded-lg border border-border/50 bg-black/20 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary-500"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {filteredBanks.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-foreground-muted">Không tìm thấy ngân hàng phù hợp</div>
            ) : (
              filteredBanks.map((bank) => {
                const isSelected = value?.bin === bank.bin
                return (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => {
                      onChange(bank)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-primary-500/12' : 'hover:bg-black/10'
                      }`}
                  >
                    {bank.logo ? (
                      <Image src={bank.logo} alt={bank.shortName} className="h-8 w-8 rounded-full bg-white object-contain p-1" width={400} height={400} unoptimized />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/15 text-[11px] font-bold text-primary-500">
                        {bank.shortName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground-base">{bank.shortName}</div>
                      <div className="truncate text-xs text-foreground-muted">
                        {bank.name} • {bank.code} • BIN {bank.bin}
                      </div>
                    </div>
                    {isSelected ? <Check size={16} className="shrink-0 text-primary-500" /> : null}
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TypeSelectDropdown({
  value,
  onChange,
  disabled,
}: {
  value: PaymentMethodType
  onChange: (type: PaymentMethodType, colorKey: PaymentMethodColorKey) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selectedLabel = PAYMENT_METHOD_TYPE_LABELS[value] ?? value

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((c) => !c)}
        className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-left text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate text-foreground-base">{selectedLabel}</span>
        <ChevronDown size={14} className={`shrink-0 text-foreground-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border/60 bg-background-secondary shadow-xl">
          {PAYMENT_METHOD_TYPE_OPTIONS.map((option) => {
            const isSelected = value === option.value
            const autoColor: PaymentMethodColorKey =
              option.value === 'CASH' ? 'emerald'
                : option.value === 'BANK' ? 'sky'
                  : option.value === 'EWALLET' ? 'orange'
                    : 'violet'
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value as PaymentMethodType, autoColor)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${isSelected ? 'bg-primary-500/12 text-primary-400 font-semibold' : 'text-foreground-base hover:bg-black/15'
                  }`}
              >
                {option.label}
                {isSelected && <Check size={14} className="shrink-0 text-primary-500" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function TabPayments() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthorization()
  const allowedBranches = useAuthStore((state) => state.allowedBranches)
  const activeBranchId = useAuthStore((state) => state.activeBranchId)
  const canManage = hasPermission('settings.payment.manage')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<PaymentMethodFormData>(EMPTY_FORM)
  const [conditionsEnabled, setConditionsEnabled] = useState(false)
  const [isWebhookPanelOpen, setIsWebhookPanelOpen] = useState(false)
  const [webhookSecretForm, setWebhookSecretForm] = useState({ name: '', provider: WEBHOOK_PROVIDER_EXAMPLE })
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<CreatedPaymentWebhookSecret | null>(null)
  const [webhookTestPayload, setWebhookTestPayload] = useState('')
  const [webhookTestResult, setWebhookTestResult] = useState<PaymentWebhookTestResult | null>(null)

  const { data: methods = [], isLoading, isError, error } = useQuery({
    queryKey: ['settings', 'payment-methods'],
    queryFn: () => settingsApi.getPaymentMethods(),
  })
  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.getBranches(),
    staleTime: 60_000,
  })
  const webhookSecretsQuery = useQuery({
    queryKey: ['settings', 'payment-webhook-secrets'],
    queryFn: () => settingsApi.getPaymentWebhookSecrets(),
    enabled: canManage,
  })
  const { data: webhookSecrets = [] } = webhookSecretsQuery

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingId(null)
    setFormData(EMPTY_FORM)
    setConditionsEnabled(false)
  }

  const openCreate = () => {
    if (!canManage) return
    setEditingId(null)
    setFormData(EMPTY_FORM)
    setConditionsEnabled(false)
    setIsFormOpen(true)
  }

  const openEdit = (method: PaymentMethod) => {
    if (!canManage) return
    setEditingId(method.id)
    const nextForm = toFormData(method)
    setFormData(nextForm)
    setConditionsEnabled(
      Boolean(
        nextForm.branchIds.length > 0 ||
        nextForm.weekdays.length > 0 ||
        nextForm.timeFrom ||
        nextForm.timeTo ||
        nextForm.minAmount ||
        nextForm.maxAmount,
      ),
    )
    setIsFormOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: () => settingsApi.createPaymentMethod(buildSubmitPayload(formData)),
    onSuccess: () => {
      toast.success('Đã thêm phương thức thanh toán')
      queryClient.invalidateQueries({ queryKey: ['settings', 'payment-methods'] })
      queryClient.invalidateQueries({ queryKey: ['settings', 'bank-transfer-accounts'] })
      closeForm()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? error?.message ?? 'Không thể tạo phương thức thanh toán')
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => settingsApi.updatePaymentMethod(editingId!, buildSubmitPayload(formData)),
    onSuccess: () => {
      toast.success('Đã cập nhật phương thức thanh toán')
      queryClient.invalidateQueries({ queryKey: ['settings', 'payment-methods'] })
      queryClient.invalidateQueries({ queryKey: ['settings', 'bank-transfer-accounts'] })
      closeForm()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? error?.message ?? 'Không thể cập nhật phương thức thanh toán')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deletePaymentMethod(id),
    onSuccess: () => {
      toast.success('Đã xóa phương thức thanh toán')
      queryClient.invalidateQueries({ queryKey: ['settings', 'payment-methods'] })
      queryClient.invalidateQueries({ queryKey: ['settings', 'bank-transfer-accounts'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? error?.message ?? 'Không thể xóa phương thức thanh toán')
    },
  })
  const createWebhookSecretMutation = useMutation({
    mutationFn: () => settingsApi.createPaymentWebhookSecret({
      name: webhookSecretForm.provider.trim(),
      provider: webhookSecretForm.provider.trim(),
    }),
    onSuccess: (secret) => {
      setCreatedWebhookSecret(secret)
      setWebhookSecretForm((current) => ({ ...current, name: '' }))
      queryClient.invalidateQueries({ queryKey: ['settings', 'payment-webhook-secrets'] })
      systemToast.success('Đã tạo key webhook mới.')
    },
    onError: (error: any) => {
      systemToast.error(error?.response?.data?.message ?? error?.message ?? 'Không thể tạo key webhook')
    },
  })
  const deleteWebhookSecretMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deletePaymentWebhookSecret(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'payment-webhook-secrets'] })
      systemToast.success('Đã thu hồi key webhook')
    },
    onError: (error: any) => {
      systemToast.error(error?.response?.data?.message ?? error?.message ?? 'Không thể thu hồi key webhook')
    },
  })
  const testWebhookMutation = useMutation({
    mutationFn: (payload: { provider: string; payload: Record<string, unknown> }) => settingsApi.testPaymentWebhook(payload),
    onSuccess: (result) => {
      setWebhookTestResult(result)
      queryClient.invalidateQueries({ queryKey: ['settings', 'bank-transactions'] })
      systemToast.success('Đã gửi payload test')
    },
    onError: (error: any) => {
      setWebhookTestResult(null)
      systemToast.error(error?.response?.data?.message ?? error?.message ?? 'Không thể test webhook')
    },
  })
  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const selectedBank = useMemo(
    () => findVietQrBank(formData.qrBankBin || formData.bankName),
    [formData.bankName, formData.qrBankBin],
  )
  const branchCodeLookup = useMemo(
    () =>
      branches.reduce<Record<string, SettingsBranch>>((result, branch) => {
        result[branch.id] = branch
        return result
      }, {}),
    [branches],
  )
  const previewBranchCode = useMemo(() => {
    const selectedBranchId = formData.branchIds[0] ?? activeBranchId ?? ''
    return branchCodeLookup[selectedBranchId]?.code ?? 'CN'
  }, [activeBranchId, branchCodeLookup, formData.branchIds])
  const previewTransferContent = useMemo(
    () =>
      buildTransferContentPreview({
        prefix: formData.transferNotePrefix,
        branchCode: previewBranchCode,
        orderCode: 'DH202604100001',
        paymentAccountName: formData.name || formData.accountHolder || selectedBank?.shortName || '',
      }),
    [formData.accountHolder, formData.name, formData.transferNotePrefix, previewBranchCode, selectedBank],
  )
  const buildWebhookUrl = (provider: string) => `${API_URL}/api/payment-webhooks/bank-transfer/${encodeURIComponent(provider)}`
  const activeWebhookProvider = webhookSecretForm.provider.trim() || WEBHOOK_PROVIDER_EXAMPLE
  const webhookSamplePayload = useMemo(
    () =>
      JSON.stringify(
        {
          eventId: 'evt_20260410_001',
          transactionId: 'txn_123456789',
          accountNumber: formData.accountNumber || '0123456789',
          bankBin: formData.qrBankBin || '970407',
          amount: 150000,
          currency: 'VND',
          direction: 'IN',
          description: previewTransferContent,
          transactionTime: '2026-04-10T10:15:30+07:00',
        },
        null,
        2,
      ),
    [formData.accountNumber, formData.qrBankBin, previewTransferContent],
  )

  useEffect(() => {
    setWebhookTestPayload((current) => (current.trim() ? current : webhookSamplePayload))
  }, [webhookSamplePayload])

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value)
      systemToast.success(successMessage)
    } catch {
      systemToast.error('Không copy được. Kiểm tra quyền clipboard.')
    }
  }

  const openBankTransactionsInbox = () => {
    if (typeof window === 'undefined') return
    window.open(BANK_TRANSACTIONS_TAB_URL, '_blank', 'noopener,noreferrer')
  }

  const handleCreateWebhookSecret = () => {
    if (!canManage) return
    if (!/^[a-z0-9][a-z0-9_-]{1,39}$/i.test(webhookSecretForm.provider.trim())) {
      systemToast.error('Provider phải từ 2-40 ký tự a-z, 0-9, gạch ngang hoặc gạch dưới')
      return
    }
    createWebhookSecretMutation.mutate()
  }

  const handleDeleteWebhookSecret = (secret: PaymentWebhookSecret) => {
    if (!canManage || deleteWebhookSecretMutation.isPending) return
    const confirmed = window.confirm(`Thu hồi key "${secret.name}" cho provider "${secret.provider}"?`)
    if (!confirmed) return
    deleteWebhookSecretMutation.mutate(secret.id)
  }

  const toggleWebhookPanel = () => {
    setIsWebhookPanelOpen((current) => {
      if (current) {
        setCreatedWebhookSecret(null)
        setWebhookTestResult(null)
      }
      return !current
    })
  }

  const resetWebhookTestPayload = () => {
    setWebhookTestPayload(webhookSamplePayload)
    setWebhookTestResult(null)
  }

  const handleTestWebhook = () => {
    if (!canManage || testWebhookMutation.isPending) return

    let payload: Record<string, unknown>
    try {
      const parsed = JSON.parse(webhookTestPayload)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        systemToast.error('JSON test phải là object hợp lệ')
        return
      }
      payload = parsed as Record<string, unknown>
    } catch {
      systemToast.error('JSON test không hợp lệ')
      return
    }

    testWebhookMutation.mutate({
      provider: activeWebhookProvider,
      payload,
    })
  }

  const handleSave = () => {
    if (!canManage) {
      toast.error('Bạn không có quyền quản lý thanh toán')
      return
    }

    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên hiển thị')
      return
    }

    if (formData.type === 'BANK') {
      if (!selectedBank) {
        toast.error('Vui lòng chọn ngân hàng trong danh sách')
        return
      }
      if (formData.accountNumber.trim().length < 6) {
        toast.error('Số tài khoản chưa hợp lệ')
        return
      }
      if (!formData.accountHolder.trim()) {
        toast.error('Vui lòng nhập tên thụ hưởng')
        return
      }
      if (formData.qrEnabled) {
        if (formData.accountNumber.trim().length > 19) {
          toast.error('Số tài khoản bật QR không được vượt quá 19 chữ số')
          return
        }
        if (!selectedBank || !/^\d{6}$/.test(formData.qrBankBin.trim())) {
          toast.error('Không tìm thấy BIN hợp lệ cho ngân hàng đã chọn')
          return
        }
        if (!/^[A-Z0-9_-]{2,24}$/.test(formData.transferNotePrefix.trim().toUpperCase())) {
          toast.error('Tiền tố nội dung chuyển khoản phải từ 2-24 ký tự A-Z, 0-9, gạch ngang hoặc gạch dưới')
          return
        }
      }
    }

    if (editingId) {
      updateMutation.mutate()
      return
    }

    createMutation.mutate()
  }

  const toggleWeekday = (day: number) => {
    setFormData((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter((value) => value !== day)
        : [...current.weekdays, day].sort((left, right) => left - right),
    }))
  }

  const toggleBranch = (branchId: string) => {
    setFormData((current) => ({
      ...current,
      branchIds: current.branchIds.includes(branchId)
        ? current.branchIds.filter((value) => value !== branchId)
        : [...current.branchIds, branchId],
    }))
  }

  const toggleConditions = (checked: boolean) => {
    setConditionsEnabled(checked)
    if (!checked) {
      setFormData((current) => ({
        ...current,
        minAmount: '',
        maxAmount: '',
        timeFrom: '',
        timeTo: '',
        weekdays: [],
        branchIds: [],
      }))
    }
  }

  return (
    <div className="flex min-h-[500px] w-full flex-col overflow-hidden rounded-3xl border border-border/60 bg-background-secondary shadow-sm">
      <div className="flex items-center justify-between border-b border-border/50 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-3 text-lg font-bold text-foreground-base">
            <ArrowRightLeft className="text-primary-500" size={24} />
            Thanh toán
          </h2>
          {!canManage ? (
            <span className="rounded-full border border-border/60 bg-background-elevated px-3 py-1 text-xs font-semibold text-foreground-muted">
              Chế độ chỉ xem
            </span>
          ) : null}
        </div>

        {!isFormOpen && canManage ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleWebhookPanel}
              className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${isWebhookPanelOpen
                ? 'border-sky-500/40 bg-sky-500/12 text-sky-200 hover:bg-sky-500/18'
                : 'border-border/60 bg-background-elevated text-foreground-base hover:border-border'
                }`}
            >
              Webhook
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-600"
            >
              <Plus size={16} />
              Thêm phương thức
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-6 bg-black/5 p-8">
        {isError ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {(error as any)?.response?.data?.message ?? (error as any)?.message ?? 'Không tải được cấu hình thanh toán. Kiểm tra API 3001 và database 5432.'}
          </div>
        ) : null}

        {isWebhookPanelOpen ? (
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/6 p-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-foreground-base">Webhook chuyển khoản chung</div>

                {webhookSecretsQuery.isError ? (
                  <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {(webhookSecretsQuery.error as any)?.response?.data?.message
                      ?? (webhookSecretsQuery.error as any)?.message
                      ?? 'Không tải được danh sách key webhook. Kiểm tra migration và API.'}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground-base">Provider</label>
                    <input
                      value={webhookSecretForm.provider}
                      disabled={!canManage || createWebhookSecretMutation.isPending}
                      onChange={(event) =>
                        setWebhookSecretForm((current) => ({
                          ...current,
                          provider: event.target.value.toLowerCase().replace(/\s+/g, '-'),
                        }))
                      }
                      className="w-full rounded-lg border border-border/50 bg-background-elevated px-4 py-2.5 font-mono text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground-base">Tác vụ</label>
                    <button
                      type="button"
                      disabled={!canManage || createWebhookSecretMutation.isPending}
                      onClick={handleCreateWebhookSecret}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-200 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {createWebhookSecretMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                      Tạo key mới
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background-elevated px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-muted">Link webhook</div>
                    <div className="mt-1 font-mono text-sm text-foreground-base truncate">{buildWebhookUrl(activeWebhookProvider)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(buildWebhookUrl(activeWebhookProvider), 'Đã copy link webhook')}
                    className="shrink-0 rounded-lg p-2 text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground-base"
                    title="Copy link"
                  >
                    <Copy size={18} />
                  </button>
                </div>

                {createdWebhookSecret ? (
                  <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-foreground-base">Key mới vừa tạo, copy ngay</div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-border/50 bg-background-elevated px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-muted">Link webhook</div>
                            <div className="mt-2 break-all font-mono text-sm text-foreground-base">
                              {buildWebhookUrl(createdWebhookSecret.provider)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border/50 bg-background-elevated px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-muted">Secret</div>
                            <div className="mt-2 break-all font-mono text-sm text-foreground-base">{createdWebhookSecret.secret}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(buildWebhookUrl(createdWebhookSecret.provider), 'Đã copy link webhook')}
                          className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                        >
                          Copy link
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(createdWebhookSecret.secret, 'Đã copy secret webhook')}
                          className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                        >
                          Copy secret
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreatedWebhookSecret(null)}
                          className="rounded-xl border border-border/60 bg-background-elevated px-4 py-2 text-sm font-semibold text-foreground-base transition-colors hover:border-border"
                        >
                          Đóng
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">Key đang hoạt động</div>
                  {canManage && webhookSecrets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 bg-background-elevated px-4 py-4 text-sm text-foreground-muted">
                      Chưa có key webhook nào. Tạo key mới để cấp cho bên gửi thông báo.
                    </div>
                  ) : null}

                  {webhookSecrets.map((secret) => (
                    <div key={secret.id} className="rounded-2xl border border-border/50 bg-background-elevated p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-bold text-foreground-base">{secret.name}</div>
                            <span className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-foreground-muted">
                              {secret.provider}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground-muted">
                            <span>Tạo: {formatDate(secret.createdAt)}</span>
                            <span>Dùng: {secret.lastUsedAt ? formatDate(secret.lastUsedAt) : 'Chưa có'}</span>
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 flex items-center gap-3 lg:border-l lg:border-border/50 lg:pl-4">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground-muted">Secret preview</div>
                            <div className="mt-0.5 font-mono text-sm text-foreground-base truncate">{secret.secretPreview}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(buildWebhookUrl(secret.provider), 'Đã copy link webhook')}
                              className="rounded-lg p-2 text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground-base"
                              title="Copy link"
                            >
                              <Copy size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={!canManage || deleteWebhookSecretMutation.isPending}
                              onClick={() => handleDeleteWebhookSecret(secret)}
                              className="rounded-lg p-2 text-rose-500/70 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                              title="Xóa key"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="xl:w-[460px]">
                <div className="rounded-2xl border border-border/50 bg-background-elevated p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">Test webhook</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(webhookTestPayload || webhookSamplePayload, 'Đã copy JSON webhook')}
                        className="rounded-xl border border-border/60 bg-background-secondary px-3 py-2 text-xs font-semibold text-foreground-base transition-colors hover:border-border"
                      >
                        Copy JSON
                      </button>
                      <button
                        type="button"
                        onClick={resetWebhookTestPayload}
                        className="rounded-xl border border-border/60 bg-background-secondary px-3 py-2 text-xs font-semibold text-foreground-base transition-colors hover:border-border"
                      >
                        Nạp JSON mẫu
                      </button>
                      <button
                        type="button"
                        disabled={!canManage || testWebhookMutation.isPending}
                        onClick={handleTestWebhook}
                        className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {testWebhookMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                        Test
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={webhookTestPayload}
                    disabled={!canManage || testWebhookMutation.isPending}
                    onChange={(event) => setWebhookTestPayload(event.target.value)}
                    className="mt-3 min-h-[280px] w-full rounded-xl border border-border/50 bg-black/10 p-4 font-mono text-xs leading-6 text-foreground-muted outline-none transition-colors focus:border-sky-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                    spellCheck={false}
                  />

                  {webhookTestResult ? (
                    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">Kết quả test</div>
                        <span className="rounded-full border border-emerald-500/25 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-200">
                          {webhookTestResult.status}
                        </span>
                        <span className="rounded-full border border-sky-500/25 px-2 py-0.5 text-[11px] font-semibold uppercase text-sky-200">
                          inbox {webhookTestResult.bankTransaction.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-border/50 bg-background-secondary px-3 py-3 text-xs">
                          <div className="font-semibold text-foreground-base">Payload đã chuẩn hóa</div>
                          <div className="mt-2 space-y-1 text-foreground-muted">
                            <div>Provider: <span className="font-mono text-foreground-base">{webhookTestResult.normalizedEvent.provider}</span></div>
                            <div>Số TK: <span className="font-mono text-foreground-base">{webhookTestResult.normalizedEvent.accountNumber}</span></div>
                            <div>Số tiền: <span className="font-mono text-foreground-base">{webhookTestResult.normalizedEvent.amount.toLocaleString('vi-VN')} VND</span></div>
                            <div>Hướng giao dịch: <span className="font-mono text-foreground-base">{webhookTestResult.normalizedEvent.direction === 'OUT' ? 'CHI' : 'THU'}</span></div>
                            <div>Nội dung: <span className="font-mono text-foreground-base">{webhookTestResult.normalizedEvent.normalizedDescription}</span></div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-background-secondary px-3 py-3 text-xs">
                          <div className="font-semibold text-foreground-base">Kết quả đối soát / lưu inbox</div>
                          <div className="mt-2 text-foreground-muted">
                            Đã lưu vào hàng đợi giao dịch ngân hàng.
                          </div>
                          {webhookTestResult.matchedPaymentIntent ? (
                            <div className="mt-2 text-emerald-500">Tìm thấy đơn hàng khớp với mã: <span className="font-mono font-bold text-emerald-400">{webhookTestResult.matchedPaymentIntent.orderNumber ?? webhookTestResult.matchedPaymentIntent.code}</span></div>
                          ) : (
                            <div className="mt-2 text-foreground-muted">Chưa tìm thấy đơn hàng tương ứng.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {isFormOpen ? (
          <div className="space-y-5 rounded-2xl border border-primary-500/30 bg-background-elevated p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-primary-500">
                {editingId ? <Edit2 size={16} /> : <Plus size={16} />}
                {editingId ? 'Cập nhật phương thức thanh toán' : 'Thêm phương thức thanh toán'}
              </h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground-base">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    disabled={!canManage}
                    onChange={(event) => setFormData((current) => ({ ...current, isDefault: event.target.checked }))}
                    className="rounded border-border/50 bg-black/20 text-primary-500 focus:ring-primary-500"
                  />
                  Mặc định
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-foreground-base">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    disabled={!canManage || (editingId ? methods.find((method) => method.id === editingId)?.isSystem : false)}
                    onChange={(event) => setFormData((current) => ({ ...current, isActive: event.target.checked }))}
                    className="rounded border-border/50 bg-black/20 text-primary-500 focus:ring-primary-500"
                  />
                  Đang hoạt động
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-foreground-base">Tên hiển thị</label>
                <input
                  value={formData.name}
                  disabled={!canManage}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="VD: Techcombank CN Q1, MoMo, Quét thẻ VPBank"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground-base">Loại</label>
                <TypeSelectDropdown
                  value={formData.type}
                  disabled={!canManage || !!(editingId ? methods.find((method) => method.id === editingId)?.isSystem : false)}
                  onChange={(type, autoColor) =>
                    setFormData((current) => ({
                      ...current,
                      type,
                      colorKey:
                        current.colorKey === 'emerald' ||
                          current.colorKey === 'sky' ||
                          current.colorKey === 'orange' ||
                          current.colorKey === 'violet'
                          ? autoColor
                          : current.colorKey,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground-base">Màu hiển thị</label>
              <div className="flex flex-wrap gap-3">
                {PAYMENT_METHOD_COLOR_OPTIONS.map((option) => {
                  const selected = formData.colorKey === option.value
                  const classes = getPaymentMethodColorClasses(formData.type, option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canManage}
                      onClick={() => setFormData((current) => ({ ...current, colorKey: option.value }))}
                      title={option.label}
                      className={`h-12 w-16 rounded-2xl border transition-all ${selected ? `${classes.chip} ring-2 ${classes.ring} scale-105` : 'border-border/60 bg-background-secondary hover:border-border'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <span className={`mx-auto block h-6 w-6 rounded-full ${classes.accent}`} />
                    </button>
                  )
                })}
              </div>
            </div>

            {formData.type === 'BANK' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground-base">Ngân hàng</label>
                    <BankCombobox
                      value={selectedBank}
                      disabled={!canManage}
                      onChange={(bank) =>
                        setFormData((current) => ({
                          ...current,
                          bankName: bank.shortName,
                          qrBankBin: bank.bin,
                          name: current.name.trim() ? current.name : bank.shortName.toUpperCase(),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground-base">Số tài khoản</label>
                    <input
                      value={formData.accountNumber}
                      disabled={!canManage}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          accountNumber: event.target.value.replace(/\D/g, ''),
                        }))
                      }
                      inputMode="numeric"
                      className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="Chỉ nhập số"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground-base">Tên thụ hưởng</label>
                    <input
                      value={formData.accountHolder}
                      disabled={!canManage}
                      onChange={(event) => setFormData((current) => ({ ...current, accountHolder: event.target.value }))}
                      className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="TÊN THỤ HƯỞNG"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/6 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-foreground-base">QR động cho chuyển khoản</div>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-foreground-base">
                      <input
                        type="checkbox"
                        checked={formData.qrEnabled}
                        disabled={!canManage}
                        onChange={(event) => setFormData((current) => ({ ...current, qrEnabled: event.target.checked }))}
                        className="rounded border-border/50 bg-black/20 text-primary-500 focus:ring-primary-500"
                      />
                      Bật QR
                    </label>
                  </div>

                  {formData.qrEnabled ? (
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground-base">Tiền tố nội dung chuyển khoản</label>
                        <input
                          value={formData.transferNotePrefix}
                          disabled={!canManage}
                          onChange={(event) =>
                            setFormData((current) => ({
                              ...current,
                              transferNotePrefix: event.target.value.toUpperCase(),
                            }))
                          }
                          className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm uppercase outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="TT"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground-base">Preview</label>
                        <div className="rounded-lg border border-border/50 bg-black/10 px-4 py-2.5 text-sm text-foreground-muted">
                          {previewTransferContent}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground-base">Thứ tự</label>
                <input
                  value={formData.sortOrder}
                  disabled={!canManage}
                  onChange={(event) => setFormData((current) => ({ ...current, sortOrder: event.target.value.replace(/[^\d]/g, '') }))}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground-base">Ghi chú</label>
                <input
                  value={formData.notes}
                  disabled={!canManage}
                  onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Mô tả nhanh"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background-secondary/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-foreground-base">Điều kiện hiển thị</div>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-foreground-base">
                  <input
                    type="checkbox"
                    checked={conditionsEnabled}
                    disabled={!canManage}
                    onChange={(event) => toggleConditions(event.target.checked)}
                    className="rounded border-border/50 bg-black/20 text-primary-500 focus:ring-primary-500"
                  />
                  Bật điều kiện
                </label>
              </div>

              {conditionsEnabled ? (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground-base">Tiền từ</label>
                      <input
                        value={formData.minAmount}
                        disabled={!canManage}
                        onChange={(event) => setFormData((current) => ({ ...current, minAmount: event.target.value.replace(/[^\d.]/g, '') }))}
                        inputMode="decimal"
                        className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Để trống = không giới hạn"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground-base">Tiền đến</label>
                      <input
                        value={formData.maxAmount}
                        disabled={!canManage}
                        onChange={(event) => setFormData((current) => ({ ...current, maxAmount: event.target.value.replace(/[^\d.]/g, '') }))}
                        inputMode="decimal"
                        className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Để trống = không giới hạn"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground-base">Khung giờ hiển thị</label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="time"
                          value={formData.timeFrom}
                          disabled={!canManage}
                          onChange={(event) => setFormData((current) => ({ ...current, timeFrom: event.target.value }))}
                          className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <input
                          type="time"
                          value={formData.timeTo}
                          disabled={!canManage}
                          onChange={(event) => setFormData((current) => ({ ...current, timeTo: event.target.value }))}
                          className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground-base">Ngày áp dụng</label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_OPTIONS.map((item) => {
                        const active = formData.weekdays.includes(item.value)
                        return (
                          <button
                            key={item.value}
                            type="button"
                            disabled={!canManage}
                            onClick={() => toggleWeekday(item.value)}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${active
                              ? 'border-primary-500 bg-primary-500/12 text-primary-500'
                              : 'border-border/60 bg-background-secondary text-foreground-muted'
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground-base">Chi nhánh hiển thị</label>
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => setFormData((current) => ({ ...current, branchIds: [] }))}
                        className="text-xs font-medium text-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Tất cả chi nhánh
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allowedBranches.map((branch) => {
                        const active = formData.branchIds.includes(branch.id)
                        return (
                          <button
                            key={branch.id}
                            type="button"
                            disabled={!canManage}
                            onClick={() => toggleBranch(branch.id)}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${active
                              ? 'border-primary-500 bg-primary-500/12 text-primary-500'
                              : 'border-border/60 bg-background-secondary text-foreground-muted'
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {branch.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeForm}
                className="px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground-base"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={!canManage || isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Xác nhận
              </button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-foreground-muted">
            <Loader2 size={18} className="mr-2 animate-spin" />
            Đang tải cấu hình thanh toán...
          </div>
        ) : methods.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background-elevated px-6 py-12 text-center">
            <div className="mt-2 text-base font-semibold text-foreground-base">Chưa có phương thức thanh toán nào</div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {methods.map((method) => {
              const TypeIcon = getTypeIcon(method.type)
              const conditions = summarizePaymentMethodConditions(method, allowedBranches)
              const colorClasses = getPaymentMethodColorClasses(method.type, method.colorKey)

              return (
                <div
                  key={method.id}
                  className={`rounded-2xl border bg-background-elevated p-5 shadow-sm transition-colors ${colorClasses.softSurface}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={`rounded-xl p-2 ${colorClasses.iconSurface}`}>
                          <TypeIcon size={16} />
                        </div>
                        <div className="text-base font-bold text-foreground-base">{method.name}</div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${colorClasses.chipSubtle}`}>
                          {PAYMENT_METHOD_TYPE_LABELS[method.type]}
                        </span>
                        {method.isDefault ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                            <Star size={12} />
                            Mặc định
                          </span>
                        ) : null}
                        {method.isSystem ? (
                          <span className="inline-flex rounded-full bg-primary-500/12 px-2.5 py-1 text-[11px] font-semibold text-primary-400">
                            Hệ thống
                          </span>
                        ) : null}
                        {method.type === 'BANK' && method.qrEnabled ? (
                          <span className="inline-flex rounded-full bg-sky-500/12 px-2.5 py-1 text-[11px] font-semibold text-sky-300">
                            QR động
                          </span>
                        ) : null}
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${method.isActive
                            ? 'bg-emerald-500/12 text-emerald-300'
                            : 'bg-foreground/10 text-foreground-muted'
                            }`}
                        >
                          {method.isActive ? 'Đang hoạt động' : 'Tạm tắt'}
                        </span>
                      </div>

                      {method.type === 'BANK' ? (
                        <div className="mt-3 space-y-2 text-sm text-foreground-muted">
                          <div>
                            {method.bankName} • {method.accountNumber} • {method.accountHolder}
                          </div>
                        </div>
                      ) : (
                        method.notes ? <div className="mt-3 text-sm text-foreground-muted">{method.notes}</div> : null
                      )}
                    </div>

                    {canManage ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(method)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-foreground-muted transition-colors hover:border-primary-500 hover:text-foreground-base"
                          title="Sửa"
                        >
                          <Edit2 size={15} />
                        </button>
                        {!method.isSystem ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Xóa phương thức "${method.name}"?`)) {
                                deleteMutation.mutate(method.id)
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/30 text-rose-300 transition-colors hover:border-rose-500/60 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Xóa"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {conditions.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {conditions.map((item) => (
                        <span
                          key={item}
                          className="inline-flex rounded-full border border-border/60 bg-black/10 px-3 py-1 text-[11px] font-medium text-foreground-muted"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-border/50 bg-black/10 px-3 py-3 text-sm text-foreground-muted">
                      Luôn hiển thị nếu đang hoạt động.
                    </div>
                  )}

                  {method.notes ? (
                    <div className="mt-4 rounded-xl border border-border/50 bg-black/10 px-3 py-3 text-sm text-foreground-muted">
                      {method.notes}
                    </div>
                  ) : null}

                  <div className="mt-4 text-xs text-foreground-muted">Cập nhật lần cuối: {formatDate(method.updatedAt)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}