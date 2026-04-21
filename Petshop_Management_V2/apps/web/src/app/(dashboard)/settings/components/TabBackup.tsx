'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  RefreshCw,
  RotateCcw,
  Save,
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
        toast.success('Da tao file backup .appbak de tai xuong')
        return
      }

      toast.success(`Da luu backup len Google Drive: ${result.data.fileName}`)
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Khong tao duoc file backup')
    },
  })

  const inspectMutation = useMutation({
    mutationFn: async () => {
      if (!backupFile) {
        throw new Error('Can chon file backup de kiem tra')
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
      toast.success('Da giai ma file backup va doc duoc manifest')
    },
    onError: (error: any) => {
      setInspectedBackup(null)
      setRestoreModules([])
      toast.error(error?.message || 'Khong doc duoc file backup')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!backupFile) {
        throw new Error('Can chon file backup de khoi phuc')
      }

      return settingsApi.restoreBackup({
        file: backupFile,
        password: restorePassword,
        modules: restoreModules,
        strategy: 'replace_selected',
      })
    },
    onSuccess: (result) => {
      toast.success(`Da khoi phuc ${result.restoredModules.length} module`)
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Khoi phuc that bai')
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
      toast.error('Can chon it nhat 1 module de backup')
      return
    }
    if (exportPassword.length < 8) {
      toast.error('Mat khau backup phai co it nhat 8 ky tu')
      return
    }
    if (exportPassword !== exportPasswordConfirm) {
      toast.error('Mat khau xac nhan chua khop')
      return
    }
    if (destination === 'google_drive' && !configQuery.data?.googleDriveEnabled) {
      toast.error('Google Drive chua duoc bat trong cau hinh he thong')
      return
    }

    exportMutation.mutate()
  }

  const handleInspect = () => {
    if (!canManageBackup) return
    if (!backupFile) {
      toast.error('Can chon file .appbak')
      return
    }
    if (restorePassword.length < 8) {
      toast.error('Mat khau backup phai co it nhat 8 ky tu')
      return
    }

    inspectMutation.mutate()
  }

  const handleRestore = () => {
    if (!canManageBackup) return
    if (!inspectedBackup) {
      toast.error('Can inspect file backup truoc khi khoi phuc')
      return
    }
    if (restoreModules.length === 0) {
      toast.error('Can chon it nhat 1 module de khoi phuc')
      return
    }
    if (restoreBlockers.length > 0) {
      toast.error('Tap module khoi phuc hien tai chua hop le vi thieu module phu thuoc nguoc')
      return
    }
    if (incompatibleRestoreModules.length > 0) {
      toast.error('Co module khong tuong thich voi app hien tai')
      return
    }

    restoreMutation.mutate()
  }

  if (!canManageBackup) {
    return (
      <div className="flex h-40 items-center justify-center gap-3 text-foreground-muted">
        <AlertCircle size={18} />
        Tinh nang backup chi danh cho SUPER_ADMIN.
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
              Backup va khoi phuc mot-file
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Tao file `.appbak` da nen + ma hoa. Khong bao gom anh hoac tai lieu nhi phan.
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
              <h3 className="text-sm font-bold text-foreground-base">Tao backup</h3>
              <p className="mt-1 text-xs text-foreground-muted">
                Chon module can dong goi. He thong tu dong kem module tien de bat buoc.
              </p>
            </div>

            <button
              type="button"
              onClick={() => catalogQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-semibold text-foreground-base transition-colors hover:bg-background-secondary"
            >
              <RefreshCw size={16} className={catalogQuery.isFetching ? 'animate-spin' : ''} />
              Lam moi danh muc
            </button>
          </div>

          {catalogQuery.isLoading ? (
            <div className="flex items-center gap-3 text-sm text-foreground-muted">
              <RefreshCw size={16} className="animate-spin" />
              Dang tai danh muc module backup...
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
                        Phu thuoc: {entry.dependencies.length > 0 ? entry.dependencies.join(', ') : 'Khong co'}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Field label="Dich den backup">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDestination('download')}
                  className={`rounded-2xl border px-4 py-4 text-left ${
                    destination === 'download'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-border/40 bg-background-base'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground-base">
                    <Download size={16} />
                    Tai xuong may
                  </div>
                  <div className="mt-2 text-xs text-foreground-muted">
                    Nhan 1 file `.appbak` de luu tru ngoai he thong.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDestination('google_drive')}
                  disabled={!configQuery.data?.googleDriveEnabled}
                  className={`rounded-2xl border px-4 py-4 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
                    destination === 'google_drive'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-border/40 bg-background-base'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground-base">
                    <Cloud size={16} />
                    Luu Google Drive
                  </div>
                  <div className="mt-2 text-xs text-foreground-muted">
                    Dung folder backup da cau hinh trong he thong.
                  </div>
                </button>
              </div>
            </Field>

            <Field label="Module se duoc dong goi">
              <div className="rounded-2xl border border-border/40 bg-background-base px-4 py-4 text-sm text-foreground-base">
                {exportModulePreview.length > 0 ? (
                  <div className="space-y-2">
                    <div>{exportModulePreview.join(', ')}</div>
                    <div className="text-xs text-foreground-muted">
                      He thong tu dong mo rong dependency de file backup co the dung lai an toan hon.
                    </div>
                  </div>
                ) : (
                  <div className="text-foreground-muted">Chua chon module nao.</div>
                )}
              </div>
            </Field>

            <Field label="Mat khau backup">
              <input
                type="password"
                value={exportPassword}
                onChange={(event) => setExportPassword(event.target.value)}
                className={inputClassName}
                placeholder="Nhap mat khau de ma hoa file .appbak"
              />
            </Field>

            <Field label="Xac nhan mat khau">
              <input
                type="password"
                value={exportPasswordConfirm}
                onChange={(event) => setExportPasswordConfirm(event.target.value)}
                className={inputClassName}
                placeholder="Nhap lai mat khau"
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100">
            File backup chi giu du lieu va tham chieu URL/path. Anh, tai lieu upload, va noi dung file tren Google Drive khong nam trong `.appbak`.
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
              Tao backup
            </button>
          </div>
        </section>

        <section className="space-y-6 rounded-2xl border border-border/50 bg-background-elevated/60 p-6">
          <div>
            <h3 className="text-sm font-bold text-foreground-base">Khoi phuc tu file `.appbak`</h3>
            <p className="mt-1 text-xs text-foreground-muted">
              Kiem tra manifest truoc, sau do chon module can replace.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Field label="Chon file backup">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/40 bg-background-base px-4 py-4">
                <Upload size={18} className="text-foreground-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground-base">
                    {backupFile?.name || 'Bam de chon file .appbak'}
                  </div>
                  <div className="mt-1 text-xs text-foreground-muted">
                    Chi doc file backup mot-file da ma hoa.
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

            <Field label="Mat khau backup">
              <input
                type="password"
                value={restorePassword}
                onChange={(event) => setRestorePassword(event.target.value)}
                className={inputClassName}
                placeholder="Nhap mat khau de inspect va restore"
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
                <InfoTile label="Tao luc" value={new Date(inspectedBackup.manifest.createdAt).toLocaleString()} />
              </div>

              <div className="space-y-3 rounded-2xl border border-border/40 bg-background-base p-4">
                <div className="text-sm font-semibold text-foreground-base">Canh bao tu file backup</div>
                {inspectedBackup.warnings.length > 0 ? (
                  inspectedBackup.warnings.map((warning) => (
                    <div key={warning} className="flex items-start gap-2 text-sm text-amber-100">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-300" />
                      <span>{warning}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-foreground-muted">Khong co canh bao bo sung.</div>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-foreground-base">Chon module can khoi phuc</div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {inspectedBackup.modules.map((entry) => {
                    const checked = restoreModules.includes(entry.moduleId)
                    const totalRecords = sumRecordCounts(entry.recordCounts)
                    return (
                      <label
                        key={entry.moduleId}
                        className={`flex items-start gap-3 rounded-2xl border px-4 py-4 ${
                          checked
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
                            {totalRecords} ban ghi • Phu thuoc: {entry.dependencies.length > 0 ? entry.dependencies.join(', ') : 'Khong co'}
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
                    Tap module se duoc restore
                  </div>
                  <div className="mt-2 text-sm text-foreground-base">
                    {restoreModulePreview.length > 0
                      ? restoreModulePreview.join(', ')
                      : 'Chua chon module nao.'}
                  </div>
                  <div className="mt-2 text-xs text-foreground-muted">
                    Backend se tu dong mo rong dependency truoc khi xoa/nap lai du lieu.
                  </div>
                </div>

                <div className="rounded-2xl border border-border/40 bg-background-base p-4">
                  <div className="text-sm font-semibold text-foreground-base">
                    Dieu kien truoc khi restore
                  </div>
                  {restoreBlockers.length > 0 ? (
                    <div className="mt-2 space-y-2 text-sm text-rose-300">
                      {restoreBlockers.map((entry) => (
                        <div key={entry.moduleId}>
                          {entry.moduleId} can chon kem: {entry.blockers.join(', ')}
                        </div>
                      ))}
                    </div>
                  ) : incompatibleRestoreModules.length > 0 ? (
                    <div className="mt-2 space-y-2 text-sm text-rose-300">
                      {incompatibleRestoreModules.map((moduleId) => (
                        <div key={moduleId}>{moduleId} chua co adapter import tu version trong file.</div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2 text-sm text-emerald-300">
                      <CheckCircle2 size={16} />
                      Tap module restore hop le theo ranh gioi version va dependency hien tai.
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
                  Khoi phuc du lieu
                </button>
              </div>
            </div>
          ) : null}
        </section>
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
