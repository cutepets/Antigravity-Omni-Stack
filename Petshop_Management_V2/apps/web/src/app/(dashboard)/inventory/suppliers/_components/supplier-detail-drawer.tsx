'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  Download,
  Eye,
  FileText,
  FileUp,
  Package,
  Phone,
  ReceiptText,
  Target,
  Trash2,
  Upload,
  UserCircle2,
  Wallet,
  X,
} from 'lucide-react'
import { stockApi } from '@/lib/api/stock.api'
import { uploadApi } from '@/lib/api'
import {
  DataListBulkBar,
  DataListShell,
  DataListTable,
  DataListToolbar,
  TableCheckbox,
  useDataListSelection,
} from '@petshop/ui/data-list'
import { customToast as toast } from '@/components/ui/toast-with-copy'

interface SupplierDetailDrawerProps {
  isOpen: boolean
  supplierId: string | null
  supplierPreview?: any | null
  canUpdateSupplier: boolean
  onClose: () => void
  onEdit: (supplier: any) => void
}

type SupplierTab = 'overview' | 'history' | 'products'

type SupplierDocument = {
  name: string
  type: string
  url: string
  uploadedAt?: string
  expiresAt?: string | null
  notes?: string | null
  remindBeforeDays?: number | null
}

type DocumentDraft = {
  type: string
  expiresAt: string
  notes: string
  remindBeforeDays: string
}

const DOCUMENT_TYPES = ['Hợp đồng', 'Phiếu nhập', 'Báo giá', 'Biên bản', 'Hồ sơ pháp lý', 'Khác']

const DEFAULT_DOCUMENT_DRAFT: DocumentDraft = {
  type: 'Hợp đồng',
  expiresAt: '',
  notes: '',
  remindBeforeDays: '30',
}

const SUPPLIER_RECEIPT_DRAFT_KEY = 'inventory.receiptDraftFromSupplier'

type QuickReceiptDraftItem = {
  productId: string
  productVariantId?: string | null
  name: string
  sku?: string | null
  unit?: string | null
  quantity: number
  unitCost: number
}

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value ?? 0)
  return Math.round(amount).toLocaleString('vi-VN')
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return 'Chưa có'
  return new Date(value).toLocaleDateString('vi-VN')
}

function parseOptionalNumber(value?: string) {
  const normalized = String(value ?? '').replace(/[^\d]/g, '')
  if (!normalized) return null
  return Number(normalized)
}

function normalizeText(value?: string | null) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim()
}

function getScoreTone(score: number) {
  if (score >= 85) return 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20'
  if (score >= 70) return 'bg-sky-500/12 text-sky-400 border-sky-500/20'
  if (score >= 55) return 'bg-amber-500/12 text-amber-400 border-amber-500/20'
  return 'bg-red-500/12 text-red-400 border-red-500/20'
}

function formatReceiptStatus(status?: string | null) {
  switch (status) {
    case 'RECEIVED':
      return { label: 'Đã nhập', tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' }
    case 'CANCELLED':
      return { label: 'Đã hủy', tone: 'border-red-500/20 bg-red-500/10 text-red-400' }
    default:
      return { label: 'Nháp', tone: 'border-amber-500/20 bg-amber-500/10 text-amber-400' }
  }
}

function normalizeSupplierDocument(document: any): SupplierDocument | null {
  const name = String(document?.name ?? '').trim()
  const url = String(document?.url ?? '').trim()
  if (!name || !url) return null

  const remindBeforeDaysValue = Number(document?.remindBeforeDays)

  return {
    name,
    type: String(document?.type ?? '').trim() || 'Tài liệu',
    url,
    uploadedAt: String(document?.uploadedAt ?? '').trim() || new Date().toISOString(),
    expiresAt: String(document?.expiresAt ?? '').trim() || null,
    notes: String(document?.notes ?? '').trim() || null,
    remindBeforeDays:
      Number.isFinite(remindBeforeDaysValue) && remindBeforeDaysValue >= 0 ? Math.round(remindBeforeDaysValue) : null,
  }
}

function getRenewalStatus(document: SupplierDocument) {
  if (!document.expiresAt) {
    return {
      label: 'Không có hạn',
      hint: 'Chưa đặt ngày hết hạn.',
      tone: 'border-border bg-background-secondary text-foreground-muted',
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiresAt = new Date(document.expiresAt)
  expiresAt.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil((expiresAt.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  const remindBeforeDays = Number(document.remindBeforeDays ?? 0)

  if (diffDays < 0) {
    return {
      label: 'Đã hết hạn',
      hint: `Quá hạn ${Math.abs(diffDays)} ngày.`,
      tone: 'border-red-500/20 bg-red-500/10 text-red-400',
    }
  }

  if (diffDays === 0) {
    return {
      label: 'Hết hạn hôm nay',
      hint: 'Cần rà soát gia hạn ngay.',
      tone: 'border-red-500/20 bg-red-500/10 text-red-400',
    }
  }

  if (remindBeforeDays > 0 && diffDays <= remindBeforeDays) {
    return {
      label: 'Đến hạn nhắc',
      hint: `Còn ${diffDays} ngày tới hạn. Nhắc trước ${remindBeforeDays} ngày.`,
      tone: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    }
  }

  return {
    label: 'Còn hiệu lực',
    hint: `Còn ${diffDays} ngày tới hạn.`,
    tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  }
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Wallet
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/80 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
        <Icon size={14} />
        {label}
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  )
}

export function SupplierDetailDrawer({
  isOpen,
  supplierId,
  supplierPreview,
  canUpdateSupplier,
  onClose,
  onEdit,
}: SupplierDetailDrawerProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const addDocumentInputRef = useRef<HTMLInputElement | null>(null)
  const replaceDocumentInputRef = useRef<HTMLInputElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<SupplierTab>('overview')
  const [documents, setDocuments] = useState<SupplierDocument[]>([])
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft>(DEFAULT_DOCUMENT_DRAFT)
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [savingDocuments, setSavingDocuments] = useState(false)
  const [replacementIndex, setReplacementIndex] = useState<number | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [quickQuantities, setQuickQuantities] = useState<Record<string, string>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) setActiveTab('overview')
  }, [isOpen, supplierId])

  const { data, isLoading } = useQuery({
    queryKey: ['supplier-detail', supplierId],
    queryFn: () => stockApi.getSupplier(supplierId as string),
    enabled: isOpen && Boolean(supplierId),
  })

  const supplier = useMemo(() => (data as any)?.data?.data ?? supplierPreview ?? null, [data, supplierPreview])

  useEffect(() => {
    if (!isOpen) return

    const nextDocuments = Array.isArray(supplier?.documents)
      ? supplier.documents.map((document: any) => normalizeSupplierDocument(document)).filter(Boolean)
      : []

    setDocuments(nextDocuments)
    setDocumentDraft(DEFAULT_DOCUMENT_DRAFT)
    setReplacementIndex(null)
    setProductSearch('')
    setQuickQuantities({})
  }, [isOpen, supplierId, supplier?.documents])

  const score = Number(supplier?.evaluation?.score ?? supplierPreview?.evaluation?.score ?? 0)
  const stats = supplier?.stats ?? {}
  const evaluation = supplier?.evaluation ?? {}
  const receipts = Array.isArray(supplier?.recentReceipts) ? supplier.recentReceipts : []
  const products = Array.isArray(supplier?.products) ? supplier.products : []
  const filteredProducts = useMemo(() => {
    const query = normalizeText(productSearch)
    if (!query) return products
    return products.filter((product: any) =>
      [product?.name, product?.sku, product?.lastReceiptNumber]
        .filter(Boolean)
        .some((value) => normalizeText(String(value)).includes(query)),
    )
  }, [productSearch, products])
  const visibleProductRowIds = useMemo(
    () => filteredProducts.map((product: any) => `supplier-product:${product.key}`),
    [filteredProducts],
  )
  const {
    selectedRowIds,
    toggleRowSelection,
    toggleSelectAllVisible,
    clearSelection,
    allVisibleSelected,
  } = useDataListSelection(visibleProductRowIds)

  const refreshSupplierQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', supplierId] }),
    ])
  }

  const selectedDraftItems = useMemo(() => {
    return filteredProducts
      .filter((product: any) => selectedRowIds.has(`supplier-product:${product.key}`))
      .map((product: any) => {
        const quantity = Math.max(1, parseOptionalNumber(quickQuantities[product.key]) ?? 1)
        return {
          productId: String(product.productId),
          productVariantId: product.productVariantId ? String(product.productVariantId) : null,
          name: String(product.name ?? 'Sản phẩm'),
          sku: product.sku ? String(product.sku) : null,
          unit: product.unit ? String(product.unit) : null,
          quantity,
          unitCost: Number(product.lastUnitPrice ?? 0),
        } satisfies QuickReceiptDraftItem
      })
  }, [filteredProducts, quickQuantities, selectedRowIds])

  if (!mounted || !isOpen || !supplierId) return null

  const handleQuickQuantityChange = (productKey: string, rawValue: string) => {
    const normalized = rawValue.replace(/[^\d]/g, '')
    setQuickQuantities((current) => ({
      ...current,
      [productKey]: normalized,
    }))
  }

  const handleCreateDraftReceipt = () => {
    if (!supplier?.id) {
      toast.error('Không tìm thấy nhà cung cấp để tạo phiếu nhập.')
      return
    }

    if (selectedDraftItems.length === 0) {
      toast.error('Hãy chọn ít nhất một mặt hàng để tạo phiếu nhập nháp.')
      return
    }

    const draftPayload = {
      source: 'supplier-detail',
      createdAt: new Date().toISOString(),
      supplierId: String(supplier.id),
      notes: `Tạo nhanh từ hồ sơ NCC ${supplier.name ?? ''}`.trim(),
      items: selectedDraftItems,
    }

    window.localStorage.setItem(SUPPLIER_RECEIPT_DRAFT_KEY, JSON.stringify(draftPayload))
    onClose()
    router.push('/inventory/receipts/new')
  }

  const safeDeleteUploadedFile = async (url: string | null | undefined) => {
    if (!url) return

    try {
      await uploadApi.deleteFile(url)
    } catch (error) {
      console.error('Failed to remove uploaded file:', error)
    }
  }

  const persistDocuments = async (
    nextDocuments: SupplierDocument[],
    successMessage: string,
    options?: {
      cleanupUrlsOnSuccess?: string[]
      cleanupUrlsOnError?: string[]
    },
  ) => {
    setSavingDocuments(true)
    try {
      await stockApi.updateSupplier(supplierId, { documents: nextDocuments })
      setDocuments(nextDocuments)
      await refreshSupplierQueries()

      for (const url of options?.cleanupUrlsOnSuccess ?? []) {
        await safeDeleteUploadedFile(url)
      }

      toast.success(successMessage)
    } catch (error: any) {
      for (const url of options?.cleanupUrlsOnError ?? []) {
        await safeDeleteUploadedFile(url)
      }

      toast.error(error?.response?.data?.message || 'Không thể cập nhật tài liệu NCC')
    } finally {
      setSavingDocuments(false)
    }
  }

  const updateDocumentField = <K extends keyof SupplierDocument>(index: number, key: K, value: SupplierDocument[K]) => {
    setDocuments((current) =>
      current.map((document, currentIndex) => {
        if (currentIndex !== index) return document
        return { ...document, [key]: value }
      }),
    )
  }

  const handleAddDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingDocument(true)
    try {
      const uploaded = await uploadApi.uploadFile(file)
      const nextDocument: SupplierDocument = {
        name: uploaded.name || file.name,
        type: documentDraft.type,
        url: uploaded.url,
        uploadedAt: new Date().toISOString(),
        expiresAt: documentDraft.expiresAt || null,
        notes: documentDraft.notes.trim() || null,
        remindBeforeDays: parseOptionalNumber(documentDraft.remindBeforeDays),
      }

      await persistDocuments([...documents, nextDocument], 'Đã thêm tài liệu NCC', {
        cleanupUrlsOnError: [uploaded.url],
      })
      setDocumentDraft(DEFAULT_DOCUMENT_DRAFT)
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải tài liệu')
    } finally {
      setUploadingDocument(false)
      event.target.value = ''
    }
  }

  const handleDeleteDocument = async (index: number) => {
    const target = documents[index]
    if (!target) return
    if (!window.confirm(`Xóa tài liệu "${target.name}" khỏi hồ sơ NCC?`)) return

    await persistDocuments(
      documents.filter((_, currentIndex) => currentIndex !== index),
      'Đã xóa tài liệu NCC',
      { cleanupUrlsOnSuccess: [target.url] },
    )
  }

  const handleReplaceDocumentClick = (index: number) => {
    setReplacementIndex(index)
    replaceDocumentInputRef.current?.click()
  }

  const handleReplaceDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const currentIndex = replacementIndex
    event.target.value = ''
    setReplacementIndex(null)

    if (!file || currentIndex == null) return

    const target = documents[currentIndex]
    if (!target) return

    setUploadingDocument(true)
    try {
      const uploaded = await uploadApi.uploadFile(file)
      const nextDocuments = documents.map((document, index) =>
        index === currentIndex
          ? {
              ...document,
              name: uploaded.name || file.name,
              url: uploaded.url,
              uploadedAt: new Date().toISOString(),
            }
          : document,
      )

      await persistDocuments(nextDocuments, 'Đã thay thế tài liệu', {
        cleanupUrlsOnSuccess: [target.url],
        cleanupUrlsOnError: [uploaded.url],
      })
    } catch (error: any) {
      toast.error(error?.message || 'Không thể thay thế tài liệu')
    } finally {
      setUploadingDocument(false)
    }
  }

  const handleSaveDocumentMeta = async (index: number) => {
    const target = documents[index]
    if (!target) return

    const nextDocuments = documents.map((document, currentIndex) =>
      currentIndex === index
        ? {
            ...document,
            type: document.type.trim() || 'Tài liệu',
            expiresAt: document.expiresAt || null,
            notes: document.notes?.trim() || null,
            remindBeforeDays:
              document.remindBeforeDays != null && Number(document.remindBeforeDays) >= 0
                ? Math.round(Number(document.remindBeforeDays))
                : null,
          }
        : document,
    )

    await persistDocuments(nextDocuments, `Đã cập nhật metadata cho ${target.name}`)
  }

  const handlePreviewDocument = (document: SupplierDocument) => {
    window.open(document.url, '_blank', 'noopener,noreferrer')
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-[1440px] flex-col overflow-hidden rounded-[28px] border border-border bg-background-base shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-border bg-background-secondary">
              {supplier?.avatar ? (
                <img src={supplier.avatar} alt={supplier?.name ?? 'NCC'} className="h-full w-full object-cover" />
              ) : (
                <UserCircle2 size={54} className="text-foreground-muted" />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getScoreTone(score)}`}>
                  Điểm NCC {score}
                </span>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                    supplier?.isActive !== false
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                      : 'border-border bg-background-secondary text-foreground-muted'
                  }`}
                >
                  {supplier?.isActive !== false ? 'Đang hoạt động' : 'Tạm ngưng'}
                </span>
              </div>
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-bold text-foreground">{supplier?.name ?? 'Nhà cung cấp'}</h2>
                  {supplier?.code ? (
                    <div className="mt-1 truncate text-xs text-foreground-muted">{supplier.code}</div>
                  ) : null}
                </div>
                {supplier?.phone ? (
                  <span className="flex items-center gap-1.5 text-sm text-foreground-muted">
                    <Phone size={14} />
                    {supplier.phone}
                  </span>
                ) : null}
                {supplier?.email ? <span className="text-sm text-foreground-muted">{supplier.email}</span> : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canUpdateSupplier && supplier ? (
              <button
                type="button"
                onClick={() => onEdit(supplier)}
                className="rounded-xl border border-border bg-background-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background-tertiary"
              >
                Chỉnh sửa
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background-secondary text-foreground-muted transition-colors hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="border-b border-border px-6">
          <div className="flex gap-1">
            {([
              ['overview', 'Tổng quan'],
              ['history', 'Lịch sử nhập'],
              ['products', 'Mặt hàng nhập'],
            ] as Array<[SupplierTab, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  activeTab === key ? 'border-primary-500 text-primary-500' : 'border-transparent text-foreground-muted hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
          {isLoading && !supplier ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-2xl border border-border bg-background-secondary" />
              ))}
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-6">
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Tổng phiếu"
                  value={String(stats.totalOrders ?? 0)}
                  icon={ReceiptText}
                />
                <MetricCard
                  label="Tổng nhập"
                  value={formatCurrency(stats.totalSpent)}
                  icon={Wallet}
                />
                <MetricCard
                  label="Công nợ"
                  value={formatCurrency(stats.totalDebt)}
                  icon={BadgeCheck}
                />
                <MetricCard
                  label="Danh mục"
                  value={String(stats.uniqueProducts ?? 0)}
                  icon={Package}
                />
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
                <div className="rounded-2xl border border-border bg-card/80 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                    <BarChart3 size={14} />
                    Đánh giá vận hành
                  </div>
                  <p className="text-sm text-foreground-muted">{evaluation.summary ?? 'Chưa có nhận xét.'}</p>
                  <div className="mt-4 space-y-3">
                    {([
                      ['Tần suất nhập', Number(evaluation?.factors?.frequencyScore ?? 0)],
                      ['Độ mới giao dịch', Number(evaluation?.factors?.recencyScore ?? 0)],
                      ['Kiểm soát công nợ', Number(evaluation?.factors?.debtScore ?? 0)],
                      ['Độ đa dạng mặt hàng', Number(evaluation?.factors?.assortmentScore ?? 0)],
                    ] as Array<[string, number]>).map(([label, rawValue]) => {
                      const value = Number(rawValue)
                      return (
                        <div key={label}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-foreground-muted">{label}</span>
                            <span className="font-semibold text-foreground">{value}/100</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-background">
                            <div
                              className={`h-full rounded-full ${
                                value >= 85 ? 'bg-emerald-500' : value >= 70 ? 'bg-sky-500' : value >= 55 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.max(6, Math.min(100, value))}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card/80 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                    <Target size={14} />
                    Target nhập hàng
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-foreground-muted">Target tháng</span>
                        <span className="font-semibold text-foreground">
                          {stats.monthTarget ? `${stats.monthTargetProgress ?? 0}%` : 'Chưa đặt'}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-background">
                        <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.max(0, Math.min(100, Number(stats.monthTargetProgress ?? 0)))}%` }} />
                      </div>
                      <p className="mt-2 text-sm text-foreground-muted">
                        {formatCurrency(stats.currentMonthSpent)} / {stats.monthTarget ? formatCurrency(stats.monthTarget) : 'Chưa đặt'}
                      </p>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-foreground-muted">Target năm</span>
                        <span className="font-semibold text-foreground">
                          {stats.yearTarget ? `${stats.yearTargetProgress ?? 0}%` : 'Chưa đặt'}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-background">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(0, Math.min(100, Number(stats.yearTargetProgress ?? 0)))}%` }} />
                      </div>
                      <p className="mt-2 text-sm text-foreground-muted">
                        {formatCurrency(stats.currentYearSpent)} / {stats.yearTarget ? formatCurrency(stats.yearTarget) : 'Chưa đặt'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(400px,0.9fr)]">
                <div className="rounded-2xl border border-border bg-card/80 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                      <FileText size={14} />
                      Tài liệu NCC
                    </div>
                    {canUpdateSupplier ? (
                      <button
                        type="button"
                        onClick={() => addDocumentInputRef.current?.click()}
                        disabled={uploadingDocument || savingDocuments}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background-secondary px-3 text-sm font-medium text-foreground transition-colors hover:bg-background-tertiary disabled:opacity-60"
                      >
                        <Upload size={14} />
                        {uploadingDocument ? 'Đang tải...' : 'Thêm tài liệu'}
                      </button>
                    ) : null}
                  </div>

                  {canUpdateSupplier ? (
                    <div className="mb-4 rounded-2xl border border-dashed border-border bg-background-secondary p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-foreground">Loại tài liệu</label>
                          <select
                            value={documentDraft.type}
                            onChange={(event) => setDocumentDraft((current) => ({ ...current, type: event.target.value }))}
                            className="form-input h-10"
                          >
                            {DOCUMENT_TYPES.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-foreground">Ngày hết hạn</label>
                          <input
                            type="date"
                            value={documentDraft.expiresAt}
                            onChange={(event) => setDocumentDraft((current) => ({ ...current, expiresAt: event.target.value }))}
                            className="form-input"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-foreground">Nhắc gia hạn trước</label>
                          <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
                              <Bell size={16} />
                            </div>
                            <input
                              inputMode="numeric"
                              value={documentDraft.remindBeforeDays}
                              onChange={(event) => setDocumentDraft((current) => ({ ...current, remindBeforeDays: event.target.value }))}
                              className="form-input pl-10"
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-1.5 block text-sm font-medium text-foreground">Ghi chú tài liệu</label>
                          <textarea
                            value={documentDraft.notes}
                            onChange={(event) => setDocumentDraft((current) => ({ ...current, notes: event.target.value }))}
                            rows={3}
                            className="form-input resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <input
                    ref={addDocumentInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={handleAddDocument}
                  />
                  <input
                    ref={replaceDocumentInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={handleReplaceDocument}
                  />

                  {documents.length === 0 ? (
                    <p className="text-sm text-foreground-muted">Chưa lưu tài liệu nào cho NCC này.</p>
                  ) : (
                    <div className="space-y-3">
                      {documents.map((document, index) => {
                        const renewalStatus = getRenewalStatus(document)

                        return (
                          <div key={`${document.url}-${index}`} className="rounded-2xl border border-border bg-background-secondary px-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{document.name}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground-muted">
                                    {document.type}
                                  </span>
                                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${renewalStatus.tone}`}>
                                    {renewalStatus.label}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs text-foreground-muted">
                                  Upload {formatDate(document.uploadedAt)}
                                  {document.expiresAt ? ` • Hết hạn ${formatDate(document.expiresAt)}` : ''}
                                </p>
                                <p className="mt-1 text-xs text-foreground-muted">{renewalStatus.hint}</p>
                                {document.notes ? <p className="mt-2 text-sm text-foreground-muted">{document.notes}</p> : null}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handlePreviewDocument(document)}
                                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-background-tertiary"
                                >
                                  <Eye size={14} />
                                  Preview
                                </button>
                                <a
                                  href={document.url}
                                  download={document.name}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-background-tertiary"
                                >
                                  <Download size={14} />
                                  Tải xuống
                                </a>
                                {canUpdateSupplier ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleReplaceDocumentClick(index)}
                                      disabled={uploadingDocument || savingDocuments}
                                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-background-tertiary disabled:opacity-60"
                                    >
                                      <FileUp size={14} />
                                      Thay file
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDocument(index)}
                                      disabled={savingDocuments}
                                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-sm font-medium text-red-400 disabled:opacity-60"
                                    >
                                      <Trash2 size={14} />
                                      Xóa
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            {canUpdateSupplier ? (
                              <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2">
                                <div>
                                  <label className="mb-1.5 block text-sm font-medium text-foreground">Loại tài liệu</label>
                                  <select
                                    value={document.type}
                                    onChange={(event) => updateDocumentField(index, 'type', event.target.value)}
                                    className="form-input h-10"
                                  >
                                    {DOCUMENT_TYPES.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1.5 block text-sm font-medium text-foreground">Ngày hết hạn</label>
                                  <input
                                    type="date"
                                    value={document.expiresAt ? document.expiresAt.slice(0, 10) : ''}
                                    onChange={(event) => updateDocumentField(index, 'expiresAt', event.target.value || null)}
                                    className="form-input"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1.5 block text-sm font-medium text-foreground">Nhắc gia hạn trước</label>
                                  <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
                                      <Bell size={16} />
                                    </div>
                                    <input
                                      inputMode="numeric"
                                      value={document.remindBeforeDays ?? ''}
                                      onChange={(event) => updateDocumentField(index, 'remindBeforeDays', parseOptionalNumber(event.target.value))}
                                      className="form-input pl-10"
                                    />
                                  </div>
                                </div>

                                <div className="md:col-span-2">
                                  <label className="mb-1.5 block text-sm font-medium text-foreground">Ghi chú</label>
                                  <textarea
                                    value={document.notes ?? ''}
                                    onChange={(event) => updateDocumentField(index, 'notes', event.target.value)}
                                    rows={3}
                                    className="form-input resize-none"
                                  />
                                </div>

                                <div className="md:col-span-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveDocumentMeta(index)}
                                    disabled={savingDocuments}
                                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-background-tertiary disabled:opacity-60"
                                  >
                                    <FileText size={14} />
                                    {savingDocuments ? 'Đang lưu...' : 'Lưu metadata'}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-border bg-card/80 p-4">
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                      <Building2 size={14} />
                      Ghi chú nội bộ
                    </div>
                    <p className="text-sm text-foreground-muted">{supplier?.notes || 'Chưa có ghi chú.'}</p>
                  </div>
                </div>
              </section>
            </div>
          ) : activeTab === 'history' ? (
            <section className="space-y-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                <CalendarClock size={14} />
                Lịch sử nhập hàng
              </div>
              {receipts.length === 0 ? (
                <p className="text-sm text-foreground-muted">Chưa có lịch sử nhập hàng với NCC này.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card/80">
                  <div className="custom-scrollbar overflow-x-auto">
                    <table className="w-full min-w-[980px]">
                      <thead className="bg-background-secondary/80">
                        <tr className="border-b border-border">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">Phiếu nhập</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">Trạng thái</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">SL</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">Tổng tiền</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">Đã trả</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">Còn nợ</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receipts.map((receipt: any) => {
                          const status = formatReceiptStatus(receipt.status)

                          return (
                            <tr
                              key={`history-table-${receipt.id}`}
                              onClick={() => router.push(`/inventory/receipts/${receipt.receiptNumber || receipt.id}`)}
                              className="cursor-pointer border-b border-border/60 transition-colors hover:bg-background-secondary/40 last:border-b-0"
                            >
                              <td className="px-4 py-3">
                                <div className="space-y-1">
                                  <p className="font-semibold text-foreground">{receipt.receiptNumber}</p>
                                  <p className="text-xs text-foreground-muted">
                                    {formatDate(receipt.createdAt)}
                                    {receipt.branch?.name ? ` • ${receipt.branch.name}` : ''}
                                  </p>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
                                  {status.label}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right text-sm font-medium text-foreground">
                                {(receipt.itemCount ?? 0).toLocaleString('vi-VN')}
                              </td>
                              <td className="px-3 py-3 text-right text-sm font-semibold text-foreground">
                                {formatCurrency(receipt.totalAmount)}
                              </td>
                              <td className="px-3 py-3 text-right text-sm text-foreground-muted">
                                {formatCurrency(receipt.paidAmount)}
                              </td>
                              <td className="px-3 py-3 text-right text-sm font-medium text-foreground">
                                {formatCurrency(receipt.debtAmount)}
                              </td>
                              <td className="px-3 py-3 text-sm text-foreground-muted">
                                <span className="line-clamp-1">{receipt.notes || '—'}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {(!receipts || receipts.length === 0) ? (
                <p className="text-sm text-foreground-muted">Chưa có lịch sử nhập hàng với NCC này.</p>
              ) : (
                receipts.map((receipt: any) => (
                  <div key={receipt.id} className="rounded-2xl border border-border bg-card/80 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{receipt.receiptNumber}</p>
                        <p className="mt-1 text-sm text-foreground-muted">
                          {formatDate(receipt.createdAt)}
                          {receipt.branch?.name ? ` • ${receipt.branch.name}` : ''}
                        </p>
                        {receipt.notes ? <p className="mt-2 text-sm text-foreground-muted">{receipt.notes}</p> : null}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{formatCurrency(receipt.totalAmount)}</p>
                        <p className="mt-1 text-xs text-foreground-muted">Còn nợ {formatCurrency(receipt.debtAmount)}</p>
                        <p className="mt-1 text-xs text-foreground-muted">{receipt.itemCount ?? 0} đơn vị</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>
          ) : (
            <section className="space-y-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                <Activity size={14} />
                Mặt hàng nhập từ NCC
              </div>
              <DataListShell className="min-h-0">
                <DataListToolbar
                  searchValue={productSearch}
                  onSearchChange={setProductSearch}
                  searchPlaceholder="Tìm mặt hàng theo tên, SKU hoặc phiếu gần nhất..."
                  showFilterToggle={false}
                  showColumnToggle={false}
                  totalSlot={
                    <div className="pt-1 text-xs text-foreground-muted">
                      {filteredProducts.length} mặt hàng, đã chọn {selectedDraftItems.length} dòng tạo nháp
                    </div>
                  }
                />

                <DataListTable
                  columns={[
                    { id: 'product', label: 'Mặt hàng', minWidth: 'min-w-[260px]' },
                    { id: 'sku', label: 'SKU', width: 'w-32' },
                    { id: 'receipt', label: 'Phiếu gần nhất', width: 'w-36' },
                    { id: 'updated', label: 'Cập nhật', width: 'w-28' },
                    { id: 'qty', label: 'Tổng nhập', width: 'w-28' },
                    { id: 'price', label: 'Giá gần nhất', width: 'w-32' },
                    { id: 'quickQty', label: 'SL nhập nhanh', width: 'w-32' },
                    { id: 'draftTotal', label: 'Thành tiền nháp', width: 'w-36' },
                  ]}
                  className="max-h-[540px]"
                  isEmpty={filteredProducts.length === 0}
                  emptyText="Chưa có dữ liệu mặt hàng để tạo phiếu nhập nhanh."
                  allSelected={allVisibleSelected}
                  onSelectAll={toggleSelectAllVisible}
                  bulkBar={
                    selectedDraftItems.length > 0 ? (
                      <DataListBulkBar selectedCount={selectedDraftItems.length} onClear={clearSelection}>
                        <button
                          type="button"
                          onClick={handleCreateDraftReceipt}
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-primary-500/30 bg-primary-500/12 px-4 text-sm font-semibold text-primary-500 transition-colors hover:bg-primary-500/18"
                        >
                          <ReceiptText size={14} />
                          Tạo đơn nhập
                        </button>
                      </DataListBulkBar>
                    ) : undefined
                  }
                >
                  {filteredProducts.map((product: any) => {
                    const rowId = `supplier-product:${product.key}`
                    const isSelected = selectedRowIds.has(rowId)
                    const quickQty = Math.max(1, parseOptionalNumber(quickQuantities[product.key]) ?? 1)

                    return (
                      <tr
                        key={product.key}
                        className={`border-b border-border/60 transition-colors last:border-b-0 hover:bg-background-secondary/40 ${isSelected ? 'bg-primary-500/6' : ''}`}
                        onClick={() => toggleRowSelection(rowId)}
                      >
                        <td className="w-10 px-3 py-3" onClick={(event) => event.stopPropagation()}>
                          <TableCheckbox
                            checked={isSelected}
                            onCheckedChange={(_checked, shiftKey) => toggleRowSelection(rowId, shiftKey)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{product.name}</p>
                            <p className="mt-1 text-xs text-foreground-muted">
                              {product.unit ? `Đơn vị ${product.unit}` : 'Chưa có đơn vị'}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-foreground-muted">{product.sku || '—'}</td>
                        <td className="px-3 py-3 text-sm font-medium text-foreground">{product.lastReceiptNumber || '—'}</td>
                        <td className="px-3 py-3 text-sm text-foreground-muted">{formatDate(product.lastOrderAt)}</td>
                        <td className="px-3 py-3 text-right text-sm font-medium text-foreground">
                          {Number(product.totalQty ?? 0).toLocaleString('vi-VN')} {product.unit}
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-medium text-foreground">
                          {formatCurrency(product.lastUnitPrice)}
                        </td>
                        <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                          <input
                            inputMode="numeric"
                            value={quickQuantities[product.key] ?? '1'}
                            onChange={(event) => handleQuickQuantityChange(product.key, event.target.value)}
                            className="form-input h-9 w-24 text-right"
                          />
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-semibold text-foreground">
                          {formatCurrency(Number(product.lastUnitPrice ?? 0) * quickQty)}
                        </td>
                      </tr>
                    )
                  })}
                </DataListTable>
              </DataListShell>
              {(!products || products.length === 0) ? (
                <p className="text-sm text-foreground-muted">Chưa có dữ liệu mặt hàng để đánh giá.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {products.map((product: any) => (
                    <div key={product.key} className="rounded-2xl border border-border bg-card/80 px-4 py-4">
                      <p className="truncate font-semibold text-foreground">{product.name}</p>
                      <p className="mt-1 text-xs text-foreground-muted">{product.sku || 'Không có SKU'}</p>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-foreground-muted">Tổng đã nhập</span>
                        <span className="font-semibold text-foreground">
                          {Number(product.totalQty ?? 0).toLocaleString('vi-VN')} {product.unit}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-foreground-muted">Giá gần nhất</span>
                        <span className="font-semibold text-foreground">{formatCurrency(product.lastUnitPrice)}</span>
                      </div>
                      <p className="mt-2 text-xs text-foreground-muted">Cập nhật {formatDate(product.lastOrderAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
