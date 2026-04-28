'use client'
import Image from 'next/image';

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  AlignLeft,
  Bell,
  Building2,
  CalendarRange,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserCircle2,
  X,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { normalizeBranchCode, suggestBranchCodeFromName } from '@petshop/shared'
import { stockApi } from '@/lib/api/stock.api'
import { uploadApi } from '@/lib/api'
import { customToast as toast } from '@/components/ui/toast-with-copy'


const supplierSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên nhà cung cấp'),
  code: z.string().min(2, 'ID NCC cần tối thiểu 2 ký tự').max(4, 'ID NCC tối đa 4 ký tự'),
  phone: z.string().optional(),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
  monthTarget: z.string().optional(),
  yearTarget: z.string().optional(),
})

type SupplierFormValues = z.infer<typeof supplierSchema>

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

interface Props {
  isOpen: boolean
  onClose: () => void
  initialData?: any | null
}

const DOCUMENT_TYPES = ['Hợp đồng', 'Phiếu nhập', 'Báo giá', 'Biên bản', 'Hồ sơ pháp lý', 'Khác']

const DEFAULT_DOCUMENT_DRAFT: DocumentDraft = {
  type: 'Hợp đồng',
  expiresAt: '',
  notes: '',
  remindBeforeDays: '30',
}

function parseOptionalNumber(value?: string) {
  const normalized = String(value ?? '').replace(/[^\d]/g, '')
  if (!normalized) return null
  return Number(normalized)
}

function formatMoneyInput(value?: string | number | null) {
  const normalized = String(value ?? '').replace(/[^\d]/g, '')
  if (!normalized) return ''
  return Number(normalized).toLocaleString('vi-VN')
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

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có'
  return new Date(value).toLocaleDateString('vi-VN')
}

export function SupplierFormModal({ isOpen, onClose, initialData }: Props) {
  const queryClient = useQueryClient()
  const isEditing = Boolean(initialData)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const documentInputRef = useRef<HTMLInputElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [documents, setDocuments] = useState<SupplierDocument[]>([])
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft>(DEFAULT_DOCUMENT_DRAFT)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [codeTouched, setCodeTouched] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      code: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      isActive: true,
      monthTarget: '',
      yearTarget: '',
    },
  })

  const monthTargetField = register('monthTarget')
  const yearTargetField = register('yearTarget')
  const codeField = register('code')
  const monthTargetValue = watch('monthTarget') ?? ''
  const yearTargetValue = watch('yearTarget') ?? ''
  const supplierNameValue = watch('name') ?? ''

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    reset({
      name: initialData?.name || '',
      code: initialData?.code || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      address: initialData?.address || '',
      notes: initialData?.notes || '',
      isActive: initialData?.isActive ?? true,
      monthTarget: formatMoneyInput(initialData?.monthTarget),
      yearTarget: formatMoneyInput(initialData?.yearTarget),
    })

    setAvatarUrl(initialData?.avatar || null)
    setDocuments(
      Array.isArray(initialData?.documents)
        ? initialData.documents.map((document: any) => normalizeSupplierDocument(document)).filter(Boolean)
        : [],
    )
    setDocumentDraft(DEFAULT_DOCUMENT_DRAFT)
    setCodeTouched(Boolean(initialData?.code))
  }, [initialData, isOpen, reset])

  useEffect(() => {
    if (!isOpen || codeTouched) return

    setValue('code', supplierNameValue ? suggestBranchCodeFromName(supplierNameValue) : '', {
      shouldDirty: true,
      shouldValidate: true,
    })
  }, [codeTouched, isOpen, setValue, supplierNameValue])

  const invalidateSupplierQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    queryClient.invalidateQueries({ queryKey: ['supplier-detail'] })
  }

  const createMutation = useMutation({
    mutationFn: stockApi.createSupplier,
    onSuccess: () => {
      toast.success('Thêm nhà cung cấp thành công')
      invalidateSupplierQueries()
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi tạo nhà cung cấp')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => stockApi.updateSupplier(initialData!.id, data),
    onSuccess: () => {
      toast.success('Cập nhật nhà cung cấp thành công')
      invalidateSupplierQueries()
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi cập nhật')
    },
  })

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const uploadedUrl = await uploadApi.uploadImage(file, {
        scope: 'suppliers',
        ownerType: 'SUPPLIER',
        ownerId: initialData?.id || 'draft',
        fieldName: 'avatar',
        displayName: supplierNameValue || initialData?.name || 'supplier',
      })
      setAvatarUrl(uploadedUrl)
      toast.success('Đã tải avatar NCC')
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải avatar')
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const handleDocumentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingDocument(true)
    try {
      const uploaded = await uploadApi.uploadFile(file, {
        scope: 'supplier-documents',
        ownerType: 'SUPPLIER_DOCUMENT',
        ownerId: initialData?.id || 'draft',
        fieldName: 'documents',
        displayName: supplierNameValue || initialData?.name || documentDraft.type || 'supplier-document',
      })
      setDocuments((current) => [
        ...current,
        {
          name: uploaded.name || file.name,
          type: documentDraft.type,
          url: uploaded.url,
          uploadedAt: new Date().toISOString(),
          expiresAt: documentDraft.expiresAt || null,
          notes: documentDraft.notes.trim() || null,
          remindBeforeDays: parseOptionalNumber(documentDraft.remindBeforeDays),
        },
      ])
      setDocumentDraft(DEFAULT_DOCUMENT_DRAFT)
      toast.success('Đã lưu tài liệu NCC')
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải tài liệu')
    } finally {
      setUploadingDocument(false)
      event.target.value = ''
    }
  }

  const handleRemoveDocument = (index: number) => {
    setDocuments((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const onSubmit = (data: SupplierFormValues) => {
    const payload = {
      ...data,
      code: normalizeBranchCode(data.code || suggestBranchCodeFromName(data.name)),
      avatar: avatarUrl || undefined,
      monthTarget: parseOptionalNumber(data.monthTarget),
      yearTarget: parseOptionalNumber(data.yearTarget),
      documents,
    }

    if (isEditing) {
      updateMutation.mutate(payload)
      return
    }

    createMutation.mutate(payload)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  if (!mounted || !isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 app-modal-overlay" />

      <div className="card relative z-[81] flex max-h-[92vh] w-full max-w-[1440px] flex-col overflow-hidden p-0 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-border bg-background-tertiary px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">{isEditing ? 'Cập nhật hồ sơ nhà cung cấp' : 'Thêm nhà cung cấp mới'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-5 rounded-3xl border border-border bg-background-secondary p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">Avatar NCC</p>
                <div className="mt-4 flex flex-col items-center gap-4">
                  <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-3xl border border-border bg-background">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="Avatar NCC" className="h-full w-full object-cover" width={400} height={400} unoptimized />
                    ) : (
                      <UserCircle2 size={72} className="text-foreground-muted" />
                    )}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background-tertiary disabled:opacity-60"
                    >
                      <Upload size={14} />
                      {uploadingAvatar ? 'Đang tải...' : 'Tải avatar'}
                    </button>
                    {avatarUrl ? (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl(null)}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400"
                      >
                        <Trash2 size={14} />
                        Xóa ảnh
                      </button>
                    ) : null}
                  </div>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  <FileText size={14} />
                  Tài liệu NCC
                </div>

                <div className="mt-4 space-y-3">
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

                  <div className="grid gap-3 md:grid-cols-2">
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
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Ghi chú tài liệu</label>
                    <textarea
                      value={documentDraft.notes}
                      onChange={(event) => setDocumentDraft((current) => ({ ...current, notes: event.target.value }))}
                      rows={3}
                      className="form-input resize-none"
                    />
                  </div>

                  <div className="flex justify-end rounded-2xl border border-dashed border-border bg-background-secondary px-3 py-3">
                    <button
                      type="button"
                      onClick={() => documentInputRef.current?.click()}
                      disabled={uploadingDocument}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-background-tertiary disabled:opacity-60"
                    >
                      <Upload size={14} />
                      {uploadingDocument ? 'Đang tải...' : 'Thêm file'}
                    </button>
                  </div>

                  <input
                    ref={documentInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={handleDocumentUpload}
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {documents.length === 0 ? (
                    <p className="text-sm text-foreground-muted">Chưa có tài liệu NCC.</p>
                  ) : (
                    documents.map((document, index) => (
                      <div key={`${document.url}-${index}`} className="rounded-2xl border border-border bg-background-secondary px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{document.name}</p>
                            <p className="mt-1 text-xs text-foreground-muted">
                              {document.type}
                              {document.expiresAt ? ` • Hết hạn ${formatDate(document.expiresAt)}` : ''}
                            </p>
                            {document.remindBeforeDays != null ? (
                              <p className="mt-1 text-xs text-foreground-muted">Nhắc trước {document.remindBeforeDays} ngày</p>
                            ) : null}
                            {document.notes ? <p className="mt-1 text-xs text-foreground-muted">{document.notes}</p> : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument(index)}
                            className="text-foreground-muted transition-colors hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Tên nhà cung cấp <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
                      <Building2 size={18} />
                    </div>
                    <input
                      {...register('name')}
                      className={`form-input pl-10 ${errors.name ? 'border-error focus:ring-error/20' : ''}`}
                    />
                  </div>
                  {errors.name ? <p className="mt-1.5 text-xs text-error">{errors.name.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    ID NCC <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
                      <Building2 size={18} />
                    </div>
                    <input
                      name={codeField.name}
                      ref={codeField.ref}
                      value={watch('code') ?? ''}
                      onBlur={codeField.onBlur}
                      onChange={(event) => {
                        setCodeTouched(true)
                        setValue('code', normalizeBranchCode(event.target.value), {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }}
                      maxLength={4}
                      className={`form-input pl-10 uppercase ${errors.code ? 'border-error focus:ring-error/20' : ''}`}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-foreground-muted">Gợi ý từ tên NCC, có thể sửa trước khi lưu.</p>
                  {errors.code ? <p className="mt-1.5 text-xs text-error">{errors.code.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Số điện thoại</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
                      <Phone size={18} />
                    </div>
                    <input {...register('phone')} className="form-input pl-10" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
                      <Mail size={18} />
                    </div>
                    <input {...register('email')} className="form-input pl-10" />
                  </div>
                  {errors.email ? <p className="mt-1.5 text-xs text-error">{errors.email.message}</p> : null}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Địa chỉ</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
                      <MapPin size={18} />
                    </div>
                    <input {...register('address')} className="form-input pl-10" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Target tháng</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
                      <CalendarRange size={18} />
                    </div>
                    <input
                      name={monthTargetField.name}
                      ref={monthTargetField.ref}
                      value={monthTargetValue}
                      onBlur={monthTargetField.onBlur}
                      onChange={(event) => setValue('monthTarget', formatMoneyInput(event.target.value), { shouldDirty: true })}
                      inputMode="numeric"
                      className="form-input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Target năm</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
                      <CalendarRange size={18} />
                    </div>
                    <input
                      name={yearTargetField.name}
                      ref={yearTargetField.ref}
                      value={yearTargetValue}
                      onBlur={yearTargetField.onBlur}
                      onChange={(event) => setValue('yearTarget', formatMoneyInput(event.target.value), { shouldDirty: true })}
                      inputMode="numeric"
                      className="form-input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Trạng thái</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
                      <ShieldCheck size={18} />
                    </div>
                    <select
                      {...register('isActive', { setValueAs: (value) => value === 'true' || value === true })}
                      className="form-input pl-10"
                    >
                      <option value="true">Đang hoạt động</option>
                      <option value="false">Tạm ngưng</option>
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Ghi chú</label>
                  <div className="relative">
                    <div className="absolute left-3 top-3 text-foreground-muted">
                      <AlignLeft size={18} />
                    </div>
                    <textarea
                      {...register('notes')}
                      rows={4}
                      className="form-input block w-full resize-none py-3 pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3 border-t border-border bg-background-tertiary px-6 py-4">
          <button type="button" onClick={onClose} className="btn-outline rounded-xl px-6">
            Hủy bỏ
          </button>
          <button type="submit" form="supplier-form" disabled={isSaving} className="btn-primary liquid-button flex items-center gap-2 rounded-xl px-6">
            {isSaving ? (
              'Đang lưu...'
            ) : (
              <>
                {!isEditing ? <Plus size={16} /> : null}
                {isEditing ? 'Lưu thay đổi' : 'Thêm mới'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
