'use client'

import React, { useMemo, useState } from 'react'
import Image from 'next/image'
import {
  AlertCircle,
  Copy,
  Database,
  ExternalLink,
  FileText,
  ImageIcon,
  Link2,
  RefreshCw,
  Search,
  Trash2,
  Unlink,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DataListBulkBar, TableCheckbox, useDataListSelection } from '@petshop/ui/data-list'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { confirmDialog } from '@/components/ui/confirmation-provider'

type StoredAssetStatus = 'ACTIVE' | 'ORPHANED' | 'DELETED'
type FileManagerStatus = StoredAssetStatus | 'LEGACY' | 'all'

type StoredAssetReference = {
  id: string
  entityType: string
  entityId: string
  fieldName: string
}

type StoredAsset = {
  id: string
  provider: 'LOCAL' | 'GOOGLE_DRIVE'
  category: 'image' | 'document' | 'backup' | string
  originalName: string
  mimeType: string
  size: number
  url: string
  status: StoredAssetStatus
  referenceCount: number
  createdAt: string
  orphanedAt?: string | null
  scope?: string | null
  ownerType?: string | null
  ownerId?: string | null
  uploadedBy?: { fullName?: string | null; username?: string | null } | null
  references?: StoredAssetReference[]
}

type LegacyAsset = {
  url: string
  entityType: string
  entityId: string
  fieldName: string
  category: 'image' | 'document' | 'backup' | string
  label?: string
  reason: string
}

type StorageAssetsResponse = {
  data: StoredAsset[]
  legacyAssets?: LegacyAsset[]
  meta: { total: number; page: number; limit: number; totalPages: number }
  stats: {
    totalFiles: number
    totalSize: number
    activeFiles: number
    orphanedFiles: number
    deletedFiles: number
    legacyFiles: number
    duplicateFiles: number
  }
}

type FileRow =
  | ({ kind: 'stored' } & StoredAsset)
  | ({
      kind: 'legacy'
      id: string
      provider: 'LEGACY'
      originalName: string
      mimeType: string
      size: number
      status: 'LEGACY'
      referenceCount: number
      createdAt: string
      references: StoredAssetReference[]
    } & LegacyAsset)

const statusLabels: Record<FileManagerStatus, string> = {
  all: 'Tất cả',
  ACTIVE: 'Đang dùng',
  ORPHANED: 'Không còn kết nối',
  DELETED: 'Đã xóa',
  LEGACY: 'Legacy',
}

const providerLabels: Record<string, string> = {
  all: 'Tất cả provider',
  LOCAL: 'Local',
  GOOGLE_DRIVE: 'Drive',
  LEGACY: 'Legacy',
}

const categoryLabels: Record<string, string> = {
  all: 'Tất cả loại',
  image: 'Ảnh',
  document: 'Tài liệu',
  backup: 'Backup',
}

const legacyReasonLabels: Record<string, string> = {
  'legacy-url': 'URL cũ',
  'data-url': 'Base64',
  'remote-url': 'URL ngoài',
  'private-storage': 'Private local',
  'missing-stored-asset': 'Thiếu metadata',
}

const formatBytes = (value: number) => {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    return response?.data?.message || 'Không tải được danh sách file.'
  }
  if (error instanceof Error) return error.message
  return 'Không tải được danh sách file.'
}

const isOpenableLegacy = (url: string) => !url.startsWith('data:') && !url.startsWith('storage/private/')

const toOriginalName = (url: string, fallback: string) => {
  if (url.startsWith('data:')) return fallback
  const cleanUrl = url.split('?')[0]
  return decodeURIComponent(cleanUrl.split('/').filter(Boolean).pop() || fallback)
}

const formatDateTime = (value?: string) => {
  if (!value) return ''
  return new Date(value).toLocaleString('vi-VN')
}

export function TabStorageAssets() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<FileManagerStatus>('all')
  const [category, setCategory] = useState('all')
  const [provider, setProvider] = useState('all')
  const [q, setQ] = useState('')
  const [restoreTarget, setRestoreTarget] = useState<StoredAsset | null>(null)
  const [restoreForm, setRestoreForm] = useState({ entityType: '', entityId: '', fieldName: '' })
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set())

  const queryParams = useMemo(
    () => ({
      status,
      category,
      provider,
      q: q.trim() || undefined,
      page: 1,
      limit: 50,
    }),
    [category, provider, q, status],
  )

  const assetsQuery = useQuery({
    queryKey: ['settings-storage-assets', queryParams],
    queryFn: () =>
      api
        .get<StorageAssetsResponse>('/settings/storage/assets', { params: queryParams })
        .then((res) => res.data),
  })

  const refreshAssets = () => queryClient.invalidateQueries({ queryKey: ['settings-storage-assets'] })

  const scanMutation = useMutation({
    mutationFn: () => api.post('/settings/storage/assets/scan', { dryRun: false }),
    onSuccess: () => {
      toast.success('Đã quét lại file và cập nhật kết nối')
      refreshAssets()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const cleanupMutation = useMutation({
    mutationFn: () => api.post('/settings/storage/assets/cleanup', { retentionDays: 30 }),
    onSuccess: () => {
      toast.success('Đã dọn file không còn kết nối quá hạn')
      refreshAssets()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const markOrphanMutation = useMutation({
    mutationFn: (id: string) => api.post(`/settings/storage/assets/${id}/orphan`),
    onSuccess: () => {
      toast.success('Đã đánh dấu file không còn kết nối')
      refreshAssets()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const restoreMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof restoreForm }) =>
      api.post(`/settings/storage/assets/${id}/restore`, payload),
    onSuccess: () => {
      toast.success('Đã gắn lại file')
      setRestoreTarget(null)
      setRestoreForm({ entityType: '', entityId: '', fieldName: '' })
      refreshAssets()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/storage/assets/${id}`),
    onSuccess: () => {
      toast.success('Đã xóa vĩnh viễn file')
      clearSelection()
      refreshAssets()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/settings/storage/assets/bulk-delete', { ids }),
    onSuccess: (response) => {
      const data = response.data as { deleted?: number; failed?: Array<{ id: string; message: string }> }
      const failedCount = data.failed?.length ?? 0
      if (failedCount > 0) {
        toast.warning(`Đã xóa ${data.deleted ?? 0} file, ${failedCount} file lỗi`)
      } else {
        toast.success(`Đã xóa vĩnh viễn ${data.deleted ?? 0} file`)
      }
      clearSelection()
      refreshAssets()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const stats = assetsQuery.data?.stats
  const items = useMemo<FileRow[]>(() => {
    const storedRows: FileRow[] = (assetsQuery.data?.data ?? []).map((asset) => ({ ...asset, kind: 'stored' }))
    const legacyRows: FileRow[] = (assetsQuery.data?.legacyAssets ?? []).map((asset, index) => ({
      ...asset,
      kind: 'legacy',
      id: `legacy:${index}:${asset.entityType}:${asset.entityId}:${asset.fieldName}`,
      provider: 'LEGACY',
      originalName: asset.label || toOriginalName(asset.url, 'legacy-file'),
      mimeType: asset.url.startsWith('data:') ? asset.url.slice(5, asset.url.indexOf(';')) : '',
      size: 0,
      status: 'LEGACY',
      referenceCount: 1,
      createdAt: '',
      references: [
        {
          id: `legacy-ref:${index}`,
          entityType: asset.entityType,
          entityId: asset.entityId,
          fieldName: asset.fieldName,
        },
      ],
    }))

    return [...storedRows, ...legacyRows]
  }, [assetsQuery.data])

  const visibleStoredRowIds = useMemo(
    () => items.filter((asset) => asset.kind === 'stored').map((asset) => asset.id),
    [items],
  )
  const {
    selectedRowIds,
    toggleRowSelection,
    toggleSelectAllVisible,
    clearSelection,
    allVisibleSelected,
  } = useDataListSelection(visibleStoredRowIds)
  const selectedStoredIds = useMemo(() => {
    const visibleSet = new Set(visibleStoredRowIds)
    return Array.from(selectedRowIds).filter((id) => visibleSet.has(id))
  }, [selectedRowIds, visibleStoredRowIds])

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url)
    toast.success('Đã copy đường dẫn file')
  }

  const openRestoreModal = (asset: StoredAsset) => {
    const firstRef = asset.references?.[0]
    setRestoreTarget(asset)
    setRestoreForm({
      entityType: firstRef?.entityType || asset.ownerType || '',
      entityId: firstRef?.entityId || asset.ownerId || '',
      fieldName: firstRef?.fieldName || asset.scope || '',
    })
  }

  const submitRestore = () => {
    if (!restoreTarget) return
    if (!restoreForm.entityType.trim() || !restoreForm.entityId.trim() || !restoreForm.fieldName.trim()) {
      toast.error('Nhập đầy đủ entityType, entityId và fieldName')
      return
    }
    restoreMutation.mutate({
      id: restoreTarget.id,
      payload: {
        entityType: restoreForm.entityType.trim(),
        entityId: restoreForm.entityId.trim(),
        fieldName: restoreForm.fieldName.trim(),
      },
    })
  }

  const confirmDelete = async (asset: StoredAsset) => {
    if (!(await confirmDialog(`Xóa vĩnh viễn file "${asset.originalName}"? File trên Drive/local và metadata DB sẽ bị xóa thật.`))) {
      return
    }
    deleteMutation.mutate(asset.id)
  }

  const confirmBulkDelete = async () => {
    if (selectedStoredIds.length === 0) return
    if (!(await confirmDialog(`Xóa vĩnh viễn ${selectedStoredIds.length} file đã chọn? File trên Drive/local và metadata DB sẽ bị xóa thật.`))) {
      return
    }
    bulkDeleteMutation.mutate(selectedStoredIds)
  }

  const markImageFailed = (id: string) => {
    setFailedImageIds((current) => {
      const next = new Set(current)
      next.add(id)
      return next
    })
  }

  return (
    <div className="relative z-0 h-full w-full">
      <div className="rounded-3xl border border-border/60 bg-background-secondary p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 border-b border-border/50 pb-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="text-primary-500">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground-base">Quản lý file</h2>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              label="Quét lại"
              icon={<Database size={16} />}
              loading={scanMutation.isPending}
              onClick={() => scanMutation.mutate()}
            />
            <ActionButton
              label="Dọn orphan"
              icon={<Trash2 size={16} />}
              loading={cleanupMutation.isPending}
              onClick={() => cleanupMutation.mutate()}
            />
            <ActionButton
              label="Tải lại"
              icon={<RefreshCw size={16} className={assetsQuery.isFetching ? 'animate-spin' : ''} />}
              onClick={() => assetsQuery.refetch()}
            />
          </div>
        </div>

        {stats ? (
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-7">
            <StatCard label="Tổng file" value={String(stats.totalFiles)} />
            <StatCard label="Dung lượng" value={formatBytes(stats.totalSize)} />
            <StatCard label="Đang dùng" value={String(stats.activeFiles)} />
            <StatCard label="Không kết nối" value={String(stats.orphanedFiles)} />
            <StatCard label="Đã xóa" value={String(stats.deletedFiles)} />
            <StatCard label="Legacy" value={String(stats.legacyFiles)} />
            <StatCard label="Trùng hash" value={String(stats.duplicateFiles)} />
          </div>
        ) : null}

        <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
          <label className="relative block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm text-foreground-base outline-none focus:border-primary-500"
              placeholder="Tìm tên file, URL, owner..."
            />
          </label>
          <SelectFilter value={status} onChange={(value) => setStatus(value as FileManagerStatus)} options={['all', 'ACTIVE', 'ORPHANED', 'DELETED', 'LEGACY']} labels={statusLabels} />
          <SelectFilter value={category} onChange={setCategory} options={['all', 'image', 'document', 'backup']} labels={categoryLabels} />
          <SelectFilter value={provider} onChange={setProvider} options={['all', 'LOCAL', 'GOOGLE_DRIVE', 'LEGACY']} labels={providerLabels} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
          {selectedStoredIds.length > 0 ? (
            <DataListBulkBar selectedCount={selectedStoredIds.length} onClear={clearSelection}>
              <button
                type="button"
                onClick={confirmBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-semibold text-red-500 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Trash2 size={15} />
                Xóa vĩnh viễn
              </button>
            </DataListBulkBar>
          ) : null}

          <div className="grid grid-cols-[36px_72px_1.5fr_110px_130px_1fr_180px] gap-3 border-b border-border bg-background-tertiary/50 px-4 py-3 text-xs font-bold uppercase text-foreground-muted">
            <span>
              <TableCheckbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} />
            </span>
            <span>Loại</span>
            <span>File</span>
            <span>Size</span>
            <span>Provider</span>
            <span>Kết nối</span>
            <span className="text-right">Thao tác</span>
          </div>
          {assetsQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-foreground-muted">Đang tải danh sách file...</div>
          ) : assetsQuery.isError ? (
            <div className="space-y-2 p-8 text-center text-sm text-red-400">
              <div className="flex items-center justify-center gap-2 font-semibold">
                <AlertCircle size={16} />
                {getErrorMessage(assetsQuery.error)}
              </div>
              <p className="text-foreground-muted">
                Nếu vừa cập nhật schema, hãy chạy migration/generate và restart API rồi bấm Tải lại.
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="space-y-2 p-8 text-center text-sm text-foreground-muted">
              <p>Không có file phù hợp bộ lọc.</p>
              <p>Bấm Quét lại để backfill kết nối từ DB nếu hệ thống vừa được nâng cấp.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {items.map((asset) => {
                const isImage = asset.category === 'image' || asset.mimeType?.startsWith('image/')
                const firstRef = asset.references?.[0]
                const canSelect = asset.kind === 'stored'
                return (
                  <div key={asset.id} className="grid grid-cols-[36px_72px_1.5fr_110px_130px_1fr_180px] items-center gap-3 px-4 py-3 text-sm">
                    <div>
                      {canSelect ? (
                        <TableCheckbox
                          checked={selectedRowIds.has(asset.id)}
                          onCheckedChange={(_, shiftKey) => toggleRowSelection(asset.id, shiftKey)}
                        />
                      ) : null}
                    </div>
                    <AssetThumbnail
                      asset={asset}
                      isImage={isImage}
                      failed={failedImageIds.has(asset.id)}
                      onError={() => markImageFailed(asset.id)}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground-base">{asset.originalName}</p>
                      <p className="mt-1 truncate text-xs text-foreground-muted">
                        {statusLabels[asset.status]}
                        {asset.kind === 'legacy'
                          ? ` - ${legacyReasonLabels[asset.reason] ?? asset.reason}`
                          : ` - ${formatDateTime(asset.createdAt)}`}
                      </p>
                    </div>
                    <span className="text-foreground-secondary">{asset.kind === 'legacy' ? '-' : formatBytes(asset.size)}</span>
                    <span className="text-xs font-semibold text-foreground-base">{providerLabels[asset.provider] ?? asset.provider}</span>
                    <span className="truncate text-xs text-foreground-muted">
                      {firstRef ? `${firstRef.entityType}:${firstRef.entityId} / ${firstRef.fieldName}` : 'Chưa có kết nối'}
                    </span>
                    <div className="flex justify-end gap-1.5">
                      {asset.kind === 'stored' || isOpenableLegacy(asset.url) ? (
                        <IconButton label="Mở file" onClick={() => window.open(asset.url, '_blank')} icon={<ExternalLink size={15} />} />
                      ) : null}
                      <IconButton label="Copy URL" onClick={() => copyUrl(asset.url)} icon={<Copy size={15} />} />
                      {asset.kind === 'stored' ? (
                        <>
                          <IconButton label="Gắn lại" onClick={() => openRestoreModal(asset)} icon={<Link2 size={15} />} />
                          <IconButton label="Đánh dấu không kết nối" onClick={() => markOrphanMutation.mutate(asset.id)} icon={<Unlink size={15} />} />
                          <IconButton label="Xóa vĩnh viễn" onClick={() => confirmDelete(asset)} icon={<Trash2 size={15} />} danger />
                        </>
                      ) : (
                        <span className="inline-flex h-8 items-center rounded-lg border border-amber-500/30 px-2 text-xs font-semibold text-amber-500">
                          Legacy
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {restoreTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl">
            <h3 className="text-base font-bold text-foreground-base">Khôi phục / gắn lại file</h3>
            <p className="mt-1 truncate text-sm text-foreground-muted">{restoreTarget.originalName}</p>
            <div className="mt-4 space-y-3">
              <TextInput label="Entity type" value={restoreForm.entityType} onChange={(value) => setRestoreForm((current) => ({ ...current, entityType: value }))} />
              <TextInput label="Entity ID" value={restoreForm.entityId} onChange={(value) => setRestoreForm((current) => ({ ...current, entityId: value }))} />
              <TextInput label="Field name" value={restoreForm.fieldName} onChange={(value) => setRestoreForm((current) => ({ ...current, fieldName: value }))} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="h-10 rounded-xl border border-border px-4 text-sm font-semibold text-foreground-base hover:bg-background-secondary"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={submitRestore}
                disabled={restoreMutation.isPending}
                className="h-10 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                Gắn lại
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AssetThumbnail({
  asset,
  isImage,
  failed,
  onError,
}: {
  asset: FileRow
  isImage: boolean
  failed: boolean
  onError: () => void
}) {
  return (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border bg-background-secondary">
      {asset.kind === 'stored' && isImage && !failed ? (
        <Image
          src={asset.url}
          alt={asset.originalName}
          width={48}
          height={48}
          unoptimized
          className="h-full w-full object-cover"
          onError={onError}
        />
      ) : isImage ? (
        <ImageIcon size={18} className="text-primary-500" />
      ) : (
        <FileText size={18} className="text-foreground-muted" />
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase text-foreground-muted">{label}</p>
      <p className="mt-2 text-lg font-bold text-foreground-base">{value}</p>
    </div>
  )
}

function SelectFilter({
  value,
  onChange,
  options,
  labels,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  labels?: Record<string, string>
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground-base outline-none focus:border-primary-500"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  )
}

function ActionButton({
  label,
  icon,
  loading,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  loading?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground-base hover:bg-background-elevated disabled:opacity-60"
    >
      {icon}
      {label}
    </button>
  )
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-foreground-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground-base outline-none focus:border-primary-500"
      />
    </label>
  )
}

function IconButton({ label, icon, onClick, danger }: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
        danger
          ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
          : 'border-border text-foreground-muted hover:bg-background-secondary hover:text-foreground-base'
      }`}
    >
      {icon}
    </button>
  )
}
