'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Printer, ReceiptText, Trash2, X, Paperclip } from 'lucide-react'
import type { Customer } from '@petshop/shared'
import { customerApi } from '@/lib/api/customer.api'
import { financeApi, type CreateFinanceTransactionInput, type FinanceTransaction } from '@/lib/api/finance.api'
import { buildFinanceVoucherHref } from '@/lib/finance-routes'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'

type TransactionWindowMode = 'create' | 'view' | 'edit'
type ManualReferenceKind = 'NONE' | 'ORDER' | 'STOCK_RECEIPT'

interface BranchOption {
  id: string
  name: string
}

interface CreateTransactionModalProps {
  branches: BranchOption[]
  mode: TransactionWindowMode
  transaction?: FinanceTransaction | null
  initialType?: 'INCOME' | 'EXPENSE'
  onClose: () => void
  onEditRequest?: () => void
  onDeleteRequest?: () => void
  onOpenCompare?: () => void
  onSaved?: (transaction: FinanceTransaction) => void
}

type TransactionFormState = CreateFinanceTransactionInput & {
  manualReferenceKind: ManualReferenceKind
}

const MANUAL_LINK_TAGS = {
  ORDER: 'MANUAL_LINK_ORDER',
  STOCK_RECEIPT: 'MANUAL_LINK_STOCK_RECEIPT',
} as const

const INCOME_THEME = {
  shell: 'border-sky-500/20',
  headerGlow: 'from-sky-500/14 via-sky-500/6 to-transparent',
  icon: 'bg-sky-500/12 text-sky-300',
  badge: 'border-sky-500/20 bg-sky-500/10 text-sky-200',
  accentText: 'text-sky-300',
  accentStrong: 'text-sky-200',
  accentBorder: 'border-sky-500/25',
  accentCard: 'border-sky-500/18 bg-sky-500/8',
  focus: 'focus:border-sky-400',
  primaryButton: 'bg-sky-500 hover:bg-sky-600',
  ghostButton: 'hover:border-sky-500/50 hover:text-sky-200',
  amountBg: 'bg-sky-500/10 text-sky-200',
} as const

const EXPENSE_THEME = {
  shell: 'border-rose-500/20',
  headerGlow: 'from-rose-500/14 via-rose-500/6 to-transparent',
  icon: 'bg-rose-500/12 text-rose-300',
  badge: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
  accentText: 'text-rose-300',
  accentStrong: 'text-rose-200',
  accentBorder: 'border-rose-500/25',
  accentCard: 'border-rose-500/18 bg-rose-500/8',
  focus: 'focus:border-rose-400',
  primaryButton: 'bg-rose-500 hover:bg-rose-600',
  ghostButton: 'hover:border-rose-500/50 hover:text-rose-200',
  amountBg: 'bg-rose-500/10 text-rose-200',
} as const

function parseManualReferenceKind(tags?: string | null, refType?: string | null): ManualReferenceKind {
  if (refType === 'ORDER') return 'ORDER'
  if (refType === 'STOCK_RECEIPT') return 'STOCK_RECEIPT'

  const tagSet = new Set(
    (tags ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )

  if (tagSet.has(MANUAL_LINK_TAGS.ORDER)) return 'ORDER'
  if (tagSet.has(MANUAL_LINK_TAGS.STOCK_RECEIPT)) return 'STOCK_RECEIPT'
  return 'NONE'
}

function mergeManualReferenceTags(existingTags: string | undefined, kind: ManualReferenceKind) {
  const nextTags = (existingTags ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && !Object.values(MANUAL_LINK_TAGS).includes(item as (typeof MANUAL_LINK_TAGS)[keyof typeof MANUAL_LINK_TAGS]))

  if (kind === 'ORDER') nextTags.push(MANUAL_LINK_TAGS.ORDER)
  if (kind === 'STOCK_RECEIPT') nextTags.push(MANUAL_LINK_TAGS.STOCK_RECEIPT)

  return nextTags.length > 0 ? nextTags.join(',') : undefined
}

function buildInitialForm(
  transaction?: FinanceTransaction | null,
  initialType: 'INCOME' | 'EXPENSE' = 'INCOME',
  defaultBranchId?: string,
): TransactionFormState {
  return {
    type: transaction?.type ?? initialType,
    amount: transaction?.amount ?? 0,
    description: transaction?.description ?? '',
    paymentMethod: transaction?.paymentMethod ?? 'CASH',
    branchId: transaction?.branchId ?? defaultBranchId ?? '',
    payerName: transaction?.payerName ?? '',
    payerId: transaction?.payerId ?? undefined,
    notes: transaction?.notes ?? '',
    category: transaction?.category ?? undefined,
    refType:
      transaction?.refType === 'ORDER' || transaction?.refType === 'STOCK_RECEIPT'
        ? transaction.refType
        : 'MANUAL',
    refId: transaction?.refId ?? undefined,
    refNumber: transaction?.refNumber ?? undefined,
    tags: transaction?.tags ?? undefined,
    attachmentUrl: transaction?.attachmentUrl ?? undefined,
    date: transaction?.date ? transaction.date.slice(0, 10) : undefined,
    manualReferenceKind: parseManualReferenceKind(transaction?.tags, transaction?.refType),
  }
}

function resolveLinkedEntity(transaction?: FinanceTransaction | null) {
  if (!transaction) return null

  const manualReferenceKind = parseManualReferenceKind(transaction.tags, transaction.refType)
  const isManualSource = transaction.isManual || transaction.source === 'MANUAL'

  if (transaction.refType === 'ORDER' && (transaction.refNumber || transaction.refId)) {
    return {
      href: transaction.refId ? `/orders/${transaction.refId}` : null,
      label: transaction.refId ? 'Mo don hang' : 'Da gan ma don',
      value: transaction.refNumber || transaction.refId,
      description: isManualSource ? 'Liên kết thu cong voi don hang' : 'Đồng bộ tu don hang',
      canCompare: false,
    }
  }

  if (transaction.refType === 'STOCK_RECEIPT' && (transaction.refNumber || transaction.refId)) {
    return {
      href: transaction.refId ? `/inventory/receipts/${transaction.refId}` : null,
      label: 'Mo phieu nhap',
      value: transaction.refNumber || transaction.refId || '-',
      description: isManualSource ? 'Liên kết thu cong voi phieu nhap' : 'Đồng bộ tu phieu nhap',
      canCompare: Boolean(transaction.refId),
    }
  }

  if (manualReferenceKind === 'ORDER') {
    return {
      href: transaction.refId ? `/orders/${transaction.refId}` : null,
      label: transaction.refId ? 'Mo don hang' : 'Da gan ma don',
      value: transaction.refNumber || transaction.refId || '-',
      description: 'Liên kết thu cong voi don hang',
      canCompare: false,
    }
  }

  if (manualReferenceKind === 'STOCK_RECEIPT') {
    return {
      href: transaction.refId ? `/inventory/receipts/${transaction.refId}` : null,
      label: transaction.refId ? 'Mo phieu nhap' : 'Da gan ma phieu nhap',
      value: transaction.refNumber || transaction.refId || '-',
      description: 'Liên kết thu cong voi phieu nhap',
      canCompare: false,
    }
  }

  return null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function parseCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN')
}

function getTypeLabel(type: 'INCOME' | 'EXPENSE') {
  return type === 'INCOME' ? 'Phiếu thu' : 'Phiếu chi'
}

function getManualReferenceLabel(kind: ManualReferenceKind) {
  if (kind === 'ORDER') return 'Đơn hàng'
  if (kind === 'STOCK_RECEIPT') return 'Phiếu nhập'
  return 'Không gán'
}

export function CreateTransactionModal({
  branches,
  mode,
  transaction,
  initialType = 'INCOME',
  onClose,
  onEditRequest,
  onDeleteRequest,
  onSaved,
}: CreateTransactionModalProps) {
  const queryClient = useQueryClient()
  const activeBranchId = useAuthStore((state) => state.activeBranchId)
  const allowedBranches = useAuthStore((state) => state.allowedBranches)
  const defaultBranchId = activeBranchId ?? allowedBranches[0]?.id ?? branches[0]?.id ?? ''
  const [form, setForm] = useState<TransactionFormState>(() => buildInitialForm(transaction, initialType, defaultBranchId))
  const [customerSearch, setCustomerSearch] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const deferredCustomerSearch = useDeferredValue(customerSearch)
  const customerPanelRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const urls: string[] = []
      for (const file of files) {
        urls.push(await financeApi.uploadAttachment(file))
      }
      return urls
    },
    onMutate: () => setIsUploading(true),
    onSuccess: (newUrls) => {
      setForm((current) => {
        const existing = current.attachmentUrl ? current.attachmentUrl.split(',').filter(Boolean) : []
        return { ...current, attachmentUrl: [...existing, ...newUrls].join(',') }
      })
      toast.success('Đã tải lên ảnh mới')
      setIsUploading(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Lỗi tải ảnh lên')
      setIsUploading(false)
    },
  })
  const currentBranch =
    branches.find((branch) => branch.id === (transaction?.branchId ?? form.branchId ?? defaultBranchId)) ??
    allowedBranches.find((branch) => branch.id === (transaction?.branchId ?? form.branchId ?? defaultBranchId)) ??
    null

  useEffect(() => {
    setForm(buildInitialForm(transaction, initialType, defaultBranchId))
    setCustomerSearch('')
  }, [defaultBranchId, initialType, transaction, mode])

  useEffect(() => {
    if (transaction || form.branchId || !defaultBranchId) return
    setForm((current) => ({ ...current, branchId: defaultBranchId }))
  }, [defaultBranchId, form.branchId, transaction])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerPanelRef.current && !customerPanelRef.current.contains(event.target as Node)) {
        setCustomerSearch('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isCreate = mode === 'create'
  const isEdit = mode === 'edit'
  const isView = mode === 'view'
  const editScope = transaction?.editScope ?? 'FULL'
  const canEditCore = isCreate || (isEdit && editScope === 'FULL')
  const canEditReference = canEditCore && (isCreate || Boolean(transaction?.isManual))
  const linkedEntity = resolveLinkedEntity(transaction)
  const theme = form.type === 'INCOME' ? INCOME_THEME : EXPENSE_THEME
  const amountDisplay = form.amount > 0 ? formatCurrency(form.amount) : ''
  const headerCode = transaction?.voucherNumber ?? null
  const inputClass = `h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors ${theme.focus} disabled:cursor-not-allowed disabled:opacity-70`

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (canEditCore && e.clipboardData?.files?.length) {
        const files = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'))
        if (files.length > 0) uploadMutation.mutate(files as any)
      }
    }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      if (canEditCore && e.dataTransfer?.files?.length) {
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
        if (files.length > 0) uploadMutation.mutate(files as any)
      }
    }
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    window.addEventListener('paste', handlePaste as any)
    window.addEventListener('drop', handleDrop)
    window.addEventListener('dragover', handleDragOver)
    return () => {
      window.removeEventListener('paste', handlePaste as any)
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('dragover', handleDragOver)
    }
  }, [canEditCore])

  const { data: customers = [] } = useQuery({
    queryKey: ['finance', 'customer-search', deferredCustomerSearch],
    queryFn: async () => {
      const response = await customerApi.getCustomers({ search: deferredCustomerSearch, limit: 8 })
      return response.data ?? []
    },
    enabled: canEditCore && deferredCustomerSearch.trim().length >= 2,
    staleTime: 10_000,
  })

  const saveTransaction = useMutation({
    mutationFn: async () => {
      const normalizedTags = mergeManualReferenceTags(form.tags, form.manualReferenceKind)
      const manualReferenceType: CreateFinanceTransactionInput['refType'] =
        form.manualReferenceKind === 'NONE' ? 'MANUAL' : form.manualReferenceKind
      const normalizedRefNumber =
        form.manualReferenceKind === 'NONE'
          ? undefined
          : form.refNumber?.trim()
            ? form.refNumber.trim()
            : undefined

      if (transaction) {
        const payload =
          editScope === 'FULL'
            ? {
                amount: Number(form.amount),
                description: form.description,
                category: form.category,
                paymentMethod: form.paymentMethod,
                branchId: form.branchId || undefined,
                payerName: form.payerName,
                payerId: form.payerId,
                refType: manualReferenceType,
                refNumber: normalizedRefNumber,
                tags: normalizedTags ?? '',
                date: form.date,
              }
            : {}

        return financeApi.update(transaction.id, payload)
      }

      return financeApi.create({
        ...form,
        amount: Number(form.amount),
        branchId: form.branchId || undefined,
        refType: manualReferenceType,
        refNumber: normalizedRefNumber,
        notes: undefined,
        tags: normalizedTags ?? '',
      })
    },
    onSuccess: (savedTransaction) => {
      toast.success(
        transaction
          ? editScope === 'FULL'
            ? 'Đã cập nhật phiếu thu chi'
            : 'Không có thay đổi nào được phép'
          : 'Đã tạo phiếu thu chi',
      )
      queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] })
      onSaved?.(savedTransaction)
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Không thể lưu phiếu thu chi')
    },
  })

  const canSubmit = transaction
    ? editScope === 'FULL'
      ? Number(form.amount) > 0 &&
        form.description.trim().length > 0 &&
        (form.manualReferenceKind === 'NONE' || Boolean(form.refNumber?.trim()))
      : false
    : Number(form.amount) > 0 &&
      form.description.trim().length > 0 &&
      (form.manualReferenceKind === 'NONE' || Boolean(form.refNumber?.trim()))

  const title = isCreate ? getTypeLabel(form.type) : isEdit ? `Sua ${getTypeLabel(form.type).toLowerCase()}` : getTypeLabel(form.type)
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`relative flex max-h-[90vh] w-full max-w-[760px] flex-col overflow-hidden rounded-3xl border bg-background-base shadow-2xl ${theme.shell}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`relative flex items-start justify-between gap-4 border-b border-border px-5 py-4 bg-gradient-to-r ${theme.headerGlow}`}>
          <div className="flex items-start gap-4">
            <div className={`rounded-xl p-2.5 ${theme.icon}`}>
              <ReceiptText size={18} />
            </div>
            <div className="flex flex-col justify-center gap-1.5 h-full">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                {headerCode ? (
                  <Link
                    href={buildFinanceVoucherHref(headerCode)}
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${theme.accentBorder} ${theme.accentStrong}`}
                  >
                    {headerCode}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isView ? (
              <button
                type="button"
                disabled={!canSubmit || saveTransaction.isPending}
                onClick={() => saveTransaction.mutate()}
                className={`inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${theme.primaryButton}`}
              >
                {saveTransaction.isPending ? 'Dang luu...' : isCreate ? 'Lưu phiếu' : 'Lưu cập nhật'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handlePrint}
              title="In phiếu"
              className={`hidden h-10 w-10 items-center justify-center rounded-xl border transition-colors sm:inline-flex ${theme.accentBorder} text-foreground-muted hover:text-foreground`}
            >
              <Printer size={16} />
            </button>
            <div className={`hidden h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold sm:inline-flex ${theme.accentCard} text-foreground`}>
              {currentBranch?.name ?? transaction?.branchName ?? 'Toàn hệ thống'}
            </div>
            {isView && transaction && transaction.editScope === 'FULL' && onEditRequest ? (
              <button
                type="button"
                onClick={onEditRequest}
                className={`inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors ${theme.ghostButton}`}
              >
                Chỉnh sửa
              </button>
            ) : null}
            {transaction?.canDelete && onDeleteRequest ? (
              <button
                type="button"
                onClick={onDeleteRequest}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-500/30 px-4 text-sm font-medium text-rose-300 transition-colors hover:border-rose-500/60 hover:text-rose-200"
              >
                <Trash2 size={14} />
                Xoa
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground-muted transition-colors hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 gap-0 sm:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="grid gap-4 grid-cols-1">
              <div ref={customerPanelRef} className="space-y-2">
                <label className="space-y-2">
                  <span className="text-sm text-foreground-muted">Người nộp/nhận</span>
                  <input
                    value={form.payerName ?? ''}
                    disabled={!canEditCore}
                    onChange={(event) => {
                      const value = event.target.value
                      setForm((current) => ({ ...current, payerName: value, payerId: undefined }))
                      setCustomerSearch(value)
                    }}
                    className={inputClass}
                    placeholder="Tên khách hàng hoặc đối tác"
                  />
                </label>
                {canEditCore && deferredCustomerSearch.trim().length >= 2 && customers.length > 0 ? (
                  <div className="rounded-2xl border border-border bg-background-secondary p-2">
                    {customers.map((customer: Customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => {
                          setForm((current) => ({
                            ...current,
                            payerName: customer.fullName,
                            payerId: customer.id,
                          }))
                          setCustomerSearch('')
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-background-tertiary"
                      >
                        <span>{customer.fullName}</span>
                        <span className="text-xs text-foreground-muted">{customer.phone}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-foreground-muted">Số tiền</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amountDisplay}
                    disabled={!canEditCore}
                    onChange={(event) => setForm((current) => ({ ...current, amount: parseCurrencyInput(event.target.value) }))}
                    className={`${inputClass} text-right text-2xl font-bold ${theme.accentText} ${theme.focus}`}
                    placeholder=""
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-foreground-muted">Hinh thuc thanh toan</span>
                  <select
                    value={form.paymentMethod ?? ''}
                    disabled={!canEditCore}
                    onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                    className={inputClass}
                  >
                    <option value="CASH">Tien mat</option>
                    <option value="BANK">Chuyen khoan</option>
                    <option value="MOMO">MoMo</option>
                    <option value="CARD">The</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm text-foreground-muted">Ngày giao dịch</span>
                  <input
                    type="date"
                    value={form.date ?? ''}
                    disabled={!canEditCore}
                    onChange={(event) => setForm((current) => ({ ...current, date: event.target.value || undefined }))}
                    className={inputClass}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-foreground-muted">Danh mục</span>
                  <input
                    value={form.category ?? ''}
                    disabled={!canEditCore}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value || undefined }))}
                    className={inputClass}
                    placeholder="Ban hang, nhap hang, van hanh..."
                  />
                </label>
              </div>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-sm text-foreground-muted">Mô tả</span>
              <input
                value={form.description}
                disabled={!canEditCore}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className={inputClass}
                placeholder="Nội dung thu chi"
              />
            </label>

            <div className="mt-4 block space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground-muted">Ảnh hóa đơn</span>
                <button
                  type="button"
                  disabled={isUploading || !canEditCore}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-8 items-center gap-2 rounded-xl px-3 text-xs font-semibold bg-background-secondary text-foreground transition-colors hover:bg-background-tertiary disabled:opacity-50"
                >
                  <Paperclip size={12} />
                  {isUploading ? 'Đang tải...' : 'Chọn file'}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length > 0) {
                    uploadMutation.mutate(files)
                  }
                }}
              />
              {form.attachmentUrl ? (
                <div className="mt-2 flex flex-wrap gap-3">
                  {form.attachmentUrl.split(',').filter(Boolean).map((url, index) => (
                    <div key={index} className="relative rounded-xl border border-border bg-card p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`}
                        alt="Hóa đơn"
                        className="h-20 w-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setForm((current) => {
                            const newUrls = current.attachmentUrl!.split(',').filter(Boolean)
                            newUrls.splice(index, 1)
                            return { ...current, attachmentUrl: newUrls.length > 0 ? newUrls.join(',') : null }
                          })
                        }}
                        className="absolute -top-2 -right-2 bg-background border border-border p-1 rounded-full text-foreground-muted hover:text-rose-400 shadow-sm"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div 
                  className="mt-2 rounded-xl border border-dashed border-border bg-background-secondary/30 py-3 px-4 text-center text-sm text-foreground-muted"
                >
                  Kéo thả ảnh hoặc dán (Ctrl+V) vào đây
                </div>
              )}
            </div>

          </div>

          <aside className="min-h-0 overflow-y-auto sm:border-l border-border px-5 py-5 bg-card/30">
            <div className="space-y-4">
              <div className={`rounded-2xl border p-4 ${theme.accentCard}`}>
                <p className="text-sm font-semibold text-foreground">Liên kết</p>
                <div className="mt-3 space-y-3 text-sm">
                  {canEditReference ? (
                    <>
                      <label className="space-y-2">
                        <span className="inline-flex items-center gap-2 text-foreground-muted">
                          <Pencil size={14} className={theme.accentText} />
                          Loại liên kết
                        </span>
                        <select
                          value={form.manualReferenceKind}
                          disabled={!canEditReference}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              manualReferenceKind: event.target.value as ManualReferenceKind,
                              refId: undefined,
                              refNumber: event.target.value === 'NONE' ? undefined : current.refNumber,
                            }))
                          }
                          className={inputClass}
                        >
                          <option value="NONE">Không gán</option>
                          <option value="ORDER">Gan ma don hang</option>
                          <option value="STOCK_RECEIPT">Gan ma phieu nhap</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="inline-flex items-center gap-2 text-foreground-muted">
                          <Pencil size={14} className={theme.accentText} />
                          Mã tham chiếu
                        </span>
                        <input
                          value={form.refNumber ?? ''}
                          disabled={!canEditReference || form.manualReferenceKind === 'NONE'}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              refId: undefined,
                              refNumber: event.target.value || undefined,
                            }))
                          }
                          className={inputClass}
                          placeholder={
                            form.manualReferenceKind === 'ORDER'
                              ? 'VD: DH260408001'
                              : form.manualReferenceKind === 'STOCK_RECEIPT'
                                ? 'VD: PN2604003'
                                : 'Chọn loại liên kết'
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-foreground-muted shrink-0">Loai</span>
                        <span className={`font-medium ${theme.accentText} text-right truncate`}>
                          {linkedEntity?.description ?? getManualReferenceLabel(parseManualReferenceKind(transaction?.tags, transaction?.refType))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-foreground-muted shrink-0">Mã tham chiếu</span>
                        {linkedEntity?.href && (transaction?.refNumber || transaction?.refId) ? (
                          <Link href={linkedEntity.href} className={`font-medium transition-colors hover:${theme.accentStrong} ${theme.accentStrong} text-right truncate`}>
                            {transaction?.refNumber || transaction?.refId}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground text-right truncate">{transaction?.refNumber || transaction?.refId || '-'}</span>
                        )}
                      </div>
                      {linkedEntity?.value ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-foreground-muted shrink-0">Thong tin</span>
                          {linkedEntity.href ? (
                            <Link href={linkedEntity.href} className={`truncate transition-colors hover:${theme.accentStrong} ${theme.accentText} text-right`}>
                              {linkedEntity.value}
                            </Link>
                          ) : (
                            <span className="truncate text-foreground text-right">{linkedEntity.value}</span>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card/80 p-4">
                <p className="text-sm font-semibold text-foreground">Thong tin he thong</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground-muted shrink-0">Nguon</span>
                    <span className="font-medium text-foreground text-right truncate">{transaction?.source || 'MANUAL'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground-muted shrink-0">Nguoi tao</span>
                    <span className="text-foreground text-right truncate">{transaction?.createdBy?.name || 'He thong'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground-muted shrink-0">Ngay tao</span>
                    <span className="text-foreground text-right truncate">{formatDateTime(transaction?.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground-muted shrink-0">Cap nhat</span>
                    <span className="text-foreground text-right truncate">{formatDateTime(transaction?.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

      </div>
    </div>
  )
}
