'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthorization } from '@/hooks/useAuthorization'
import {
  settingsApi,
  type BackupCatalogEntry,
  type BackupInspectModuleResult,
  type BackupInspectResult,
} from '@/lib/api/settings.api'

function expandModules(selected: string[], modules: Array<Pick<BackupCatalogEntry, 'moduleId' | 'dependencies'>>) {
  const map = new Map(modules.map((entry) => [entry.moduleId, entry]))
  const visited = new Set<string>()
  const ordered: string[] = []

  const visit = (moduleId: string) => {
    if (visited.has(moduleId)) return
    visited.add(moduleId)

    const current = map.get(moduleId)
    if (!current) return

    current.dependencies.forEach(visit)
    ordered.push(moduleId)
  }

  selected.forEach(visit)
  return ordered
}

function collectRestoreBlockers(
  selected: string[],
  modules: BackupInspectModuleResult[],
) {
  const selectedSet = new Set(selected)
  return selected
    .map((moduleId) => {
      const current = modules.find((entry) => entry.moduleId === moduleId)
      const blockers = (current?.requiredBy ?? []).filter(
        (entry) => !selectedSet.has(entry),
      )
      return {
        moduleId,
        blockers,
      }
    })
    .filter((entry) => entry.blockers.length > 0)
}

function sumRecordCounts(recordCounts: Record<string, number>) {
  return Object.values(recordCounts).reduce((total, value) => total + value, 0)
}

const inputClassName =
  'w-full rounded-xl border border-border/50 bg-black/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60'

export function TabBackup() {
  const { isSuperAdmin } = useAuthorization()
  const canManageBackup = isSuperAdmin()
  const [exportModules, setExportModules] = useState<string[]>([])
  const [destination, setDestination] = useState<'download' | 'google_drive'>('download')
  const [exportPassword, setExportPassword] = useState('')
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState('')
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [restorePassword, setRestorePassword] = useState('')
  const [inspectedBackup, setInspectedBackup] = useState<BackupInspectResult | null>(null)
  const [restoreModules, setRestoreModules] = useState<string[]>([])
  const [isApplyingInspectResult, startInspectTransition] = useTransition()

  const catalogQuery = useQuery({
    queryKey: ['settings', 'backup-catalog'],
    queryFn: async () => settingsApi.getBackupCatalog(),
    staleTime: 5 * 60 * 1000,
  })

  const configQuery = useQuery({
    queryKey: ['settings', 'backup-configs'],
    queryFn: async () => settingsApi.getConfigs(),
    staleTime: 5 * 60 * 1000,
  })

  const exportModulePreview = useMemo(
    () => expandModules(exportModules, catalogQuery.data ?? []),
    [catalogQuery.data, exportModules],
  )

  const restoreModulePreview = useMemo(
    () => expandModules(restoreModules, inspectedBackup?.modules ?? []),
    [inspectedBackup?.modules, restoreModules],
  )

  const restoreBlockers = useMemo(
    () =>
      inspectedBackup
        ? collectRestoreBlockers(restoreModulePreview, inspectedBackup.modules)
        : [],
    [inspectedBackup, restoreModulePreview],
  )

  const incompatibleRestoreModules = useMemo(
    () =>
      (inspectedBackup?.modules ?? [])
        .filter(
          (entry) =>
            restoreModulePreview.includes(entry.moduleId) && !entry.compatible,
        )
        .map((entry) => entry.moduleId),
    [inspectedBackup?.modules, restoreModulePreview],
  )

  const exportMutation = useMutation({
    mutationFn: async () =>
      settingsApi.exportBackup({
        modules: exportModules,
        destination,
        password: exportPassword,
      }),
    onSuccess: (result) => {
      if (result.kind === 'download') {
        const href = URL.createObjectURL(result.blob)
        const anchor = document.createElement('a')
        anchor.href = href
        anchor.download = result.fileName
        anchor.click()
        URL.revokeObjectURL(href)
        toast.success('Đã tạo file backup .appbak để tải xuống')
        return
      }

      toast.success(`Đã lưu backup lên Google Drive: ${result.data.fileName}`)
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Không tạo được file backup')
    },
  })

  const inspectMutation = useMutation({
    mutationFn: async () => {
      if (!backupFile) {
        throw new Error('Cần chọn file backup để kiểm tra')
      }
      return settingsApi.inspectBackup(backupFile, restorePassword)
    },
    onSuccess: (result) => {
      startInspectTransition(() => {
        setInspectedBackup(result)
        setRestoreModules(
          result.modules
            .filter((entry) => entry.compatible)
            .map((entry) => entry.moduleId),
        )
      })
      toast.success('Đã giải mã file backup và đọc được manifest')
    },
    onError: (error: any) => {
      setInspectedBackup(null)
      setRestoreModules([])
      toast.error(error?.message || 'Không đọc được file backup')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!backupFile) {
        throw new Error('Cần chọn file backup để khôi phục')
      }

      return settingsApi.restoreBackup({
        file: backupFile,
        password: restorePassword,
        modules: restoreModules,
        strategy: 'replace_selected',
      })
    },
    onSuccess: (result) => {
      toast.success(`Đã khôi phục ${result.restoredModules.length} module`)
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Khôi phục thất bại')
    },
  })

  const toggleExportModule = (moduleId: string) => {
    if (!canManageBackup) return
    setExportModules((current) =>
      current.includes(moduleId)
        ? current.filter((entry) => entry !== moduleId)
        : [...current, moduleId],
    )
  }

  const toggleRestoreModule = (moduleId: string) => {
    if (!canManageBackup) return
    setRestoreModules((current) =>
      current.includes(moduleId)
        ? current.filter((entry) => entry !== moduleId)
        : [...current, moduleId],
    )
  }

  const handleExport = () => {
    if (!canManageBackup) return
    if (exportModules.length === 0) {
      toast.error('Cần chọn ít nhất 1 module để backup')
      return
    }
    if (exportPassword.length < 8) {
      toast.error('Mật khẩu backup phải có ít nhất 8 ký tự')
      return
    }
    if (exportPassword !== exportPasswordConfirm) {
      toast.error('Mật khẩu xác nhận chưa khớp')
      return
    }
    if (destination === 'google_drive' && !configQuery.data?.googleDriveEnabled) {
      toast.error('Google Drive chưa được bật trong cấu hình hệ thống')
      return
    }

    exportMutation.mutate()
  }

  const handleInspect = () => {
    if (!canManageBackup) return
    if (!backupFile) {
      toast.error('Cần chọn file .appbak')
      return
    }
    if (restorePassword.length < 8) {
      toast.error('Mật khẩu backup phải có ít nhất 8 ký tự')
      return
    }

    inspectMutation.mutate()
  }

  const handleRestore = () => {
    if (!canManageBackup) return
    if (!inspectedBackup) {
      toast.error('Cần inspect file backup trước khi khôi phục')
      return
    }
    if (restoreModules.length === 0) {
      toast.error('Cần chọn ít nhất 1 module để khôi phục')
      return
    }
    if (restoreBlockers.length > 0) {
      toast.error('Tập module khôi phục hiện tại chưa hợp lệ vì thiếu module phụ thuộc ngược')
      return
    }
    if (incompatibleRestoreModules.length > 0) {
      toast.error('Có module không tương thích với app hiện tại')
      return
    }

    restoreMutation.mutate()
  }

  if (!canManageBackup) {
    return (
      <div className="flex h-40 items-center justify-center gap-3 text-foreground-muted">
        <AlertCircle size={18} />
        Tính năng backup chỉ dành cho SUPER_ADMIN.
      </div>
    )
  }

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-border/60 bg-background-secondary shadow-sm">
      <div className="border-b border-border/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-3 text-lg font-bold text-foreground-base">
              <Database className="text-primary-500" size={24} />
              Backup và khôi phục một-file
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Tạo file `.appbak` đã nén + mã hóa. Không bao gồm ảnh hoặc tài liệu nhị phân.
            </p>
          </div>

          <span className="rounded-full border border-border/60 bg-background-elevated px-3 py-1 text-xs font-semibold text-foreground-muted">
            SUPER_ADMIN
          </span>
        </div>
      </div>

      <div className="space-y-8 p-8">
        <section className="space-y-6 rounded-2xl border border-border/50 bg-background-elevated/60 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-foreground-base">Tạo backup</h3>
              <p className="mt-1 text-xs text-foreground-muted">
                Chọn module cần đóng gói. Hệ thống tự động kèm module tiền đề bắt buộc.
              </p>
            </div>

            <button
              type="button"
              onClick={() => catalogQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-semibold text-foreground-base transition-colors hover:bg-background-secondary"
            >
              <RefreshCw size={16} className={catalogQuery.isFetching ? 'animate-spin' : ''} />
              Làm mới danh mục
            </button>
          </div>

          {catalogQuery.isLoading ? (
            <div className="flex items-center gap-3 text-sm text-foreground-muted">
              <RefreshCw size={16} className="animate-spin" />
              Đang tải danh mục module backup...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {(catalogQuery.data ?? []).map((entry) => {
                const checked = exportModules.includes(entry.moduleId)
                return (
                  <label
                    key={entry.moduleId}
                    className="flex items-start gap-3 rounded-2xl border border-border/40 bg-background-base px-4 py-4"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExportModule(entry.moduleId)}
                      className="mt-1 h-4 w-4 rounded border-border/50"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground-base">
                        {entry.label}
                      </div>
                      <div className="mt-1 text-xs text-foreground-muted">
                        {entry.moduleId} • v{entry.moduleVersion}
                      </div>
                      <div className="mt-2 text-xs text-foreground-muted">
                        Phụ thuộc: {entry.dependencies.length > 0 ? entry.dependencies.join(', ') : 'Không có'}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Field label="Đích đến backup">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDestination('download')}
                  className={`rounded-2xl border px-4 py-4 text-left ${destination === 'download'
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-border/40 bg-background-base'
                    }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground-base">
                    <Download size={16} />
                    Tải xuống máy
                  </div>
                  <div className="mt-2 text-xs text-foreground-muted">
                    Nhận 1 file `.appbak` để lưu trữ ngoài hệ thống.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDestination('google_drive')}
                  disabled={!configQuery.data?.googleDriveEnabled}
                  className={`rounded-2xl border px-4 py-4 text-left disabled:cursor-not-allowed disabled:opacity-60 ${destination === 'google_drive'
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-border/40 bg-background-base'
                    }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground-base">
                    <Cloud size={16} />
                    Lưu Google Drive
                  </div>
                  <div className="mt-2 text-xs text-foreground-muted">
                    Dùng folder backup đã cấu hình trong hệ thống.
                  </div>
                </button>
              </div>
            </Field>

            <Field label="Module sẽ được đóng gói">
              <div className="rounded-2xl border border-border/40 bg-background-base px-4 py-4 text-sm text-foreground-base">
                {exportModulePreview.length > 0 ? (
                  <div className="space-y-2">
                    <div>{exportModulePreview.join(', ')}</div>
                    <div className="text-xs text-foreground-muted">
                      Hệ thống tự động mở rộng dependency để file backup có thể dùng lại an toàn hơn.
                    </div>
                  </div>
                ) : (
                  <div className="text-foreground-muted">Chưa chọn module nào.</div>
                )}
              </div>
            </Field>

            <Field label="Mật khẩu backup">
              <input
                type="password"
                value={exportPassword}
                onChange={(event) => setExportPassword(event.target.value)}
                className={inputClassName}
                placeholder="Nhập mật khẩu để mã hóa file .appbak"
              />
            </Field>

            <Field label="Xác nhận mật khẩu">
              <input
                type="password"
                value={exportPasswordConfirm}
                onChange={(event) => setExportPasswordConfirm(event.target.value)}
                className={inputClassName}
                placeholder="Nhập lại mật khẩu"
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100">
            File backup chỉ giữ dữ liệu và tham chiếu URL/path. Ảnh, tài liệu upload, và nội dung file trên Google Drive không nằm trong `.appbak`.
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleExport}
              disabled={exportMutation.isPending || catalogQuery.isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportMutation.isPending ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Tạo backup
            </button>
          </div>
        </section>

        <section className="space-y-6 rounded-2xl border border-border/50 bg-background-elevated/60 p-6">
          <div>
            <h3 className="text-sm font-bold text-foreground-base">Khôi phục từ file `.appbak`</h3>
            <p className="mt-1 text-xs text-foreground-muted">
              Kiểm tra manifest trước, sau đó chọn module cần replace.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Field label="Chọn file backup">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/40 bg-background-base px-4 py-4">
                <Upload size={18} className="text-foreground-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground-base">
                    {backupFile?.name || 'Bấm để chọn file .appbak'}
                  </div>
                  <div className="mt-1 text-xs text-foreground-muted">
                    Chỉ đọc file backup một-file đã mã hóa.
                  </div>
                </div>
                <input
                  type="file"
                  accept=".appbak"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    setBackupFile(file)
                    setInspectedBackup(null)
                    setRestoreModules([])
                  }}
                />
              </label>
            </Field>

            <Field label="Mật khẩu backup">
              <input
                type="password"
                value={restorePassword}
                onChange={(event) => setRestorePassword(event.target.value)}
                className={inputClassName}
                placeholder="Nhập mật khẩu để inspect và restore"
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleInspect}
              disabled={inspectMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-semibold text-foreground-base transition-colors hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inspectMutation.isPending || isApplyingInspectResult ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <RotateCcw size={16} />
              )}
              Inspect backup
            </button>
          </div>

          {inspectedBackup ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <InfoTile label="Ung dung" value={`${inspectedBackup.manifest.appId} • v${inspectedBackup.manifest.appVersion}`} />
                <InfoTile label="Format" value={`${inspectedBackup.manifest.formatName} • v${inspectedBackup.manifest.formatVersion}`} />
                <InfoTile label="Tạo lúc" value={new Date(inspectedBackup.manifest.createdAt).toLocaleString()} />
              </div>

              <div className="space-y-3 rounded-2xl border border-border/40 bg-background-base p-4">
                <div className="text-sm font-semibold text-foreground-base">Cảnh báo từ file backup</div>
                {inspectedBackup.warnings.length > 0 ? (
                  inspectedBackup.warnings.map((warning) => (
                    <div key={warning} className="flex items-start gap-2 text-sm text-amber-100">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-300" />
                      <span>{warning}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-foreground-muted">Không có cảnh báo bổ sung.</div>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-foreground-base">Chọn module cần khôi phục</div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {inspectedBackup.modules.map((entry) => {
                    const checked = restoreModules.includes(entry.moduleId)
                    const totalRecords = sumRecordCounts(entry.recordCounts)
                    return (
                      <label
                        key={entry.moduleId}
                        className={`flex items-start gap-3 rounded-2xl border px-4 py-4 ${checked
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-border/40 bg-background-base'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRestoreModule(entry.moduleId)}
                          className="mt-1 h-4 w-4 rounded border-border/50"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground-base">
                            <span>{entry.label}</span>
                            {entry.compatible ? (
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                                Compatible
                              </span>
                            ) : (
                              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-300">
                                Incompatible
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-foreground-muted">
                            {entry.moduleId} • file v{entry.fileModuleVersion} • app v{entry.moduleVersion}
                          </div>
                          <div className="mt-2 text-xs text-foreground-muted">
                            {totalRecords} bản ghi • Phụ thuộc: {entry.dependencies.length > 0 ? entry.dependencies.join(', ') : 'Không có'}
                          </div>
                          {entry.compatibilityReason ? (
                            <div className="mt-2 text-xs text-rose-300">
                              {entry.compatibilityReason}
                            </div>
                          ) : null}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-border/40 bg-background-base p-4">
                  <div className="text-sm font-semibold text-foreground-base">
                    Tập module sẽ được restore
                  </div>
                  <div className="mt-2 text-sm text-foreground-base">
                    {restoreModulePreview.length > 0
                      ? restoreModulePreview.join(', ')
                      : 'Chưa chọn module nào.'}
                  </div>
                  <div className="mt-2 text-xs text-foreground-muted">
                    Backend sẽ tự động mở rộng dependency trước khi xóa/nạp lại dữ liệu.
                  </div>
                </div>

                <div className="rounded-2xl border border-border/40 bg-background-base p-4">
                  <div className="text-sm font-semibold text-foreground-base">
                    Điều kiện trước khi restore
                  </div>
                  {restoreBlockers.length > 0 ? (
                    <div className="mt-2 space-y-2 text-sm text-rose-300">
                      {restoreBlockers.map((entry) => (
                        <div key={entry.moduleId}>
                          {entry.moduleId} cần chọn kèm: {entry.blockers.join(', ')}
                        </div>
                      ))}
                    </div>
                  ) : incompatibleRestoreModules.length > 0 ? (
                    <div className="mt-2 space-y-2 text-sm text-rose-300">
                      {incompatibleRestoreModules.map((moduleId) => (
                        <div key={moduleId}>{moduleId} chưa có adapter import từ version trong file.</div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2 text-sm text-emerald-300">
                      <CheckCircle2 size={16} />
                      Tập module restore hợp lệ theo ranh giới version và dependency hiện tại.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={restoreMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {restoreMutation.isPending ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                  Khôi phục dữ liệu
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* ─── Purge Section ─── */}
        <PurgeSection catalog={catalogQuery.data ?? []} />
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-foreground-base">{label}</label>
      {children}
    </div>
  )
}

function InfoTile({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background-base p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground-base">{value}</div>
    </div>
  )
}

function PurgeSection({ catalog }: { catalog: BackupCatalogEntry[] }) {
  const [purgeModules, setPurgeModules] = useState<string[]>([])
  const [confirmPhrase, setConfirmPhrase] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const purgeModulePreview = useMemo(
    () => expandModules(purgeModules, catalog),
    [catalog, purgeModules],
  )

  const togglePurgeModule = (moduleId: string) => {
    setPurgeModules((current) =>
      current.includes(moduleId)
        ? current.filter((entry) => entry !== moduleId)
        : [...current, moduleId],
    )
  }

  const purgeMutation = useMutation({
    mutationFn: () => settingsApi.purgeData(purgeModules, confirmPhrase),
    onSuccess: (result) => {
      toast.success(`Đã xóa dữ liệu ${result.purgedModules.length} module`)
      setPurgeModules([])
      setConfirmPhrase('')
      setShowConfirmDialog(false)
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Xóa dữ liệu thất bại')
    },
  })

  const handlePurge = () => {
    if (purgeModules.length === 0) {
      toast.error('Cần chọn ít nhất 1 module để xóa dữ liệu')
      return
    }
    setShowConfirmDialog(true)
  }

  const handleConfirmPurge = () => {
    if (confirmPhrase !== 'XOA DU LIEU') {
      toast.error('Cụm xác nhận không chính xác. Nhập "XOA DU LIEU" để xác nhận.')
      return
    }
    purgeMutation.mutate()
  }

  return (
    <section className="space-y-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-rose-400">
            <Trash2 size={16} />
            Xóa dữ liệu demo
          </h3>
          <p className="mt-1 text-xs text-foreground-muted">
            Xóa toàn bộ dữ liệu của module được chọn. Hành động không thể hoàn tác.
          </p>
        </div>
        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400">
          SUPER_ADMIN
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {catalog.map((entry) => {
          const checked = purgeModules.includes(entry.moduleId)
          return (
            <label
              key={entry.moduleId}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-4 transition-colors ${checked
                  ? 'border-rose-500/40 bg-rose-500/10'
                  : 'border-border/40 bg-background-base'
                }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => togglePurgeModule(entry.moduleId)}
                className="mt-1 h-4 w-4 rounded border-border/50 accent-rose-500"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground-base">
                  {entry.label}
                </div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {entry.moduleId} • Phụ thuộc:{' '}
                  {entry.dependencies.length > 0
                    ? entry.dependencies.join(', ')
                    : 'Không có'}
                </div>
              </div>
            </label>
          )
        })}
      </div>

      {purgeModulePreview.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />
            <div>
              <span className="font-bold">Sẽ xóa dữ liệu các module (bao gồm dependency):</span>{' '}
              {purgeModulePreview.join(', ')}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handlePurge}
          disabled={purgeModules.length === 0 || purgeMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 size={16} />
          Xóa dữ liệu
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center app-modal-overlay">
          <div className="w-full max-w-md space-y-5 rounded-3xl border border-rose-500/30 bg-background-secondary p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-rose-500/15 p-3">
                <AlertTriangle size={24} className="text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground-base">
                  Xác nhận xóa dữ liệu
                </h3>
                <p className="mt-1 text-xs text-foreground-muted">
                  Hành động không thể hoàn tác
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-foreground-secondary">
              Sẽ xóa toàn bộ dữ liệu của{' '}
              <span className="font-bold text-rose-400">
                {purgeModulePreview.length} module
              </span>
              : {purgeModulePreview.join(', ')}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground-base">
                Nhập <span className="font-bold text-rose-400">XOA DU LIEU</span> để
                xác nhận
              </label>
              <input
                type="text"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                className={inputClassName}
                placeholder="XOA DU LIEU"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmDialog(false)
                  setConfirmPhrase('')
                }}
                className="rounded-xl border border-border/60 px-4 py-2 text-sm font-semibold text-foreground-base transition-colors hover:bg-background-secondary"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmPurge}
                disabled={
                  confirmPhrase !== 'XOA DU LIEU' || purgeMutation.isPending
                }
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {purgeMutation.isPending ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Xóa dữ liệu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

