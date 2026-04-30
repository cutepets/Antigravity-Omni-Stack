'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileSpreadsheet, RefreshCw, Upload, X } from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { crmApi, type CrmExcelPreviewResult } from '@/lib/api/crm.api'
import { cn } from '@/lib/utils'

export function CrmImportExportDropdown({
  canImport,
  onImported,
}: {
  canImport: boolean
  onImported: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isTemplateLoading, setIsTemplateLoading] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CrmExcelPreviewResult | null>(null)

  const handleExport = async () => {
    setIsOpen(false)
    setIsExporting(true)
    try {
      await crmApi.exportExcel('all')
      toast.success('Đã tải file Excel Khách hàng/Pet')
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không xuất được file Excel')
    } finally {
      setIsExporting(false)
    }
  }

  const handleTemplate = async () => {
    setIsOpen(false)
    setIsTemplateLoading(true)
    try {
      await crmApi.downloadTemplate()
      toast.success('Đã tải mẫu nhập CRM')
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không tải được mẫu nhập')
    } finally {
      setIsTemplateLoading(false)
    }
  }

  const handlePreviewFile = async (file: File) => {
    setSelectedFile(file)
    setPreview(null)
    setIsPreviewing(true)
    try {
      const result = await crmApi.previewImport(file)
      setPreview(result)
      if (result.summary.errorCount > 0) {
        toast.error(`File Excel có ${result.summary.errorCount} lỗi, chưa thể áp dụng`)
      } else {
        toast.success('Preview Excel hợp lệ, có thể áp dụng import')
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không đọc được file Excel')
      setSelectedFile(null)
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleApply = async () => {
    if (!selectedFile || !preview || preview.summary.errorCount > 0) return
    setIsApplying(true)
    try {
      const result = await crmApi.applyImport(selectedFile)
      setPreview(result)
      if (result.summary.errorCount > 0) {
        toast.error(`File Excel có ${result.summary.errorCount} lỗi, chưa thể áp dụng`)
        return
      }
      toast.success('Đã áp dụng dữ liệu Khách hàng/Pet từ Excel')
      setPreview(null)
      setSelectedFile(null)
      onImported()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không áp dụng được file Excel')
    } finally {
      setIsApplying(false)
    }
  }

  const isBusy = isExporting || isTemplateLoading || isPreviewing
  const issueLines = [...(preview?.errors ?? []), ...(preview?.warnings ?? [])]

  return (
    <>
      <div className="relative">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setIsOpen((value) => !value)}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-background-secondary px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary-500/60 disabled:opacity-50"
        >
          {isBusy ? <RefreshCw size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
          Xuất/Nhập
          <ChevronDown size={15} />
        </button>

        {isOpen ? (
          <div className="absolute right-0 top-12 z-30 w-52 overflow-hidden rounded-xl border border-border bg-background-base shadow-xl">
            <button type="button" onClick={handleExport} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-background-secondary">
              <Download size={15} />
              Xuất Excel
            </button>
            <button type="button" onClick={handleTemplate} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-background-secondary">
              <FileSpreadsheet size={15} />
              Tải mẫu nhập
            </button>
            <button
              type="button"
              disabled={!canImport}
              onClick={() => {
                setIsOpen(false)
                fileInputRef.current?.click()
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-background-secondary disabled:opacity-50"
            >
              <Upload size={15} />
              Nhập Excel
            </button>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void handlePreviewFile(file)
          }}
        />
      </div>

      {selectedFile || preview || isPreviewing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background-base shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-base font-black text-foreground">Preview nhập Excel</h3>
                <p className="mt-1 text-xs font-semibold text-foreground-muted">{selectedFile?.name ?? 'Đang đọc file...'}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isApplying) return
                  setPreview(null)
                  setSelectedFile(null)
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              {isPreviewing ? (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background-secondary px-3 py-3 text-sm font-semibold text-foreground-muted">
                  <RefreshCw size={16} className="animate-spin" />
                  Đang phân tích file Excel
                </div>
              ) : preview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ['KH mới', preview.summary.customerCreateCount],
                      ['KH cập nhật', preview.summary.customerUpdateCount],
                      ['Pet mới', preview.summary.petCreateCount],
                      ['Pet cập nhật', preview.summary.petUpdateCount],
                      ['Bỏ qua', preview.summary.skippedCount],
                      ['Lỗi', preview.summary.errorCount],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-border bg-background-secondary px-3 py-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-foreground-muted">{label}</p>
                        <p className="mt-1 text-lg font-black text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className={cn(
                    'flex items-start gap-2 rounded-xl border px-3 py-3 text-sm font-semibold',
                    preview.summary.errorCount > 0
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
                  )}>
                    {preview.summary.errorCount > 0 ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
                    {preview.summary.errorCount > 0
                      ? 'File còn lỗi. Sửa Excel rồi nhập lại trước khi áp dụng.'
                      : 'File hợp lệ. Áp dụng sẽ thêm mới/cập nhật hồ sơ Khách hàng và Pet.'}
                  </div>

                  {issueLines.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-border">
                      {issueLines.map((issue, index) => (
                        <div key={`${issue.sheet}:${issue.row ?? index}:${issue.column ?? ''}`} className="border-b border-border px-3 py-2 text-sm last:border-b-0">
                          <span className="font-bold text-foreground">{issue.sheet}</span>
                          {issue.row ? <span className="text-foreground-muted"> dòng {issue.row}</span> : null}
                          {issue.column ? <span className="text-foreground-muted"> cột {issue.column}</span> : null}
                          <span className="text-foreground-muted"> - {issue.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setPreview(null)
                  setSelectedFile(null)
                }}
                disabled={isApplying}
                className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-bold text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!preview || preview.summary.errorCount > 0 || isApplying}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {isApplying ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />}
                Áp dụng import
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

