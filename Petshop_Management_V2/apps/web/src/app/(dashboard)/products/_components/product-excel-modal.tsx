'use client'

import { useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, FileSpreadsheet, Loader2, UploadCloud, X } from 'lucide-react'
import {
  inventoryApi,
  type ProductImportMode,
  type ProductImportPreviewResult,
  type ProductImportRequest,
} from '@/lib/api/inventory.api'
import { parseProductExcel, type ParsedProductExcelFile } from './product-excel'
import { toast } from 'sonner'

interface ProductExcelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const MODE_OPTIONS: Array<{ value: ProductImportMode; label: string; description: string }> = [
  {
    value: 'update',
    label: 'Cập nhật theo SKU',
    description: 'So khớp theo SKU để cập nhật dữ liệu hiện có. Ô trống sẽ được bỏ qua.',
  },
  {
    value: 'create',
    label: 'Thêm mới',
    description: 'Tạo mới theo Mã nhóm SP và SKU dòng. SKU đã tồn tại sẽ bị báo lỗi và bỏ qua.',
  },
]

export function ProductExcelModal({ isOpen, onClose, onSuccess }: ProductExcelModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ProductImportMode>('update')
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedFile, setParsedFile] = useState<ParsedProductExcelFile | null>(null)
  const [preview, setPreview] = useState<ProductImportPreviewResult | null>(null)

  const previewMutation = useMutation({
    mutationFn: async (payload: ProductImportRequest) => inventoryApi.previewProductImport(payload),
    onSuccess: (result) => {
      setPreview(result?.data ?? null)
    },
    onError: (error: any) => {
      setPreview(null)
      toast.error(error?.response?.data?.message || 'Khong the preview file Excel.')
    },
  })

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!parsedFile) throw new Error('Chua co du lieu de nhap.')
      return inventoryApi.commitProductImport({
        mode,
        rows: parsedFile.rows,
        includedColumns: parsedFile.includedColumns,
        priceBookHeaders: parsedFile.priceBookHeaders,
      })
    },
    onSuccess: (result) => {
      toast.success(result?.message || 'Da nhap Excel san pham thanh cong.')
      resetState()
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'Khong the nhap Excel san pham.')
    },
  })

  const previewItems = useMemo(() => preview?.items.slice(0, 12) ?? [], [preview])

  if (!isOpen) return null

  const resetState = () => {
    setFileName(null)
    setParsedFile(null)
    setPreview(null)
    setIsDragOver(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const requestPreview = async (nextMode: ProductImportMode, nextFile: ParsedProductExcelFile) => {
    await previewMutation.mutateAsync({
      mode: nextMode,
      rows: nextFile.rows,
      includedColumns: nextFile.includedColumns,
      priceBookHeaders: nextFile.priceBookHeaders,
    })
  }

  const processFile = async (file: File) => {
    setFileName(file.name)
    const nextFile = await parseProductExcel(file)
    if (nextFile.rows.length === 0) {
      setParsedFile(null)
      setPreview(null)
      throw new Error('File Excel khong co du lieu hop le.')
    }

    setParsedFile(nextFile)
    await requestPreview(mode, nextFile)
  }

  const handleFileSelect = async (file?: File | null) => {
    if (!file) return
    try {
      await processFile(file)
    } catch (error: any) {
      toast.error(error?.message || 'Khong the doc file Excel.')
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center app-modal-overlay px-4 py-6">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold text-foreground">
              <FileSpreadsheet size={18} className="text-primary-500" />
              Nhap san pham tu Excel
            </div>
            <p className="mt-1 text-sm text-foreground-muted">
              Import nhan dien theo ten cot. Co the giu lai cot bat buoc va cot can cap nhat de file gon hon.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetState()
              onClose()
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-hidden px-6 py-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-background-secondary/20 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-foreground-muted">Bước 1</div>
              <div className="mt-3 space-y-3">
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={async () => {
                      setMode(option.value)
                      if (parsedFile) {
                        await requestPreview(option.value, parsedFile)
                      }
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                      mode === option.value
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-border bg-background hover:border-primary-500/40'
                    }`}
                  >
                    <div className="font-semibold text-foreground">{option.label}</div>
                    <div className="mt-1 text-xs leading-5 text-foreground-muted">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background-secondary/20 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-foreground-muted">Bước 2</div>
              <div
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDragOver(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  setIsDragOver(false)
                }}
                onDrop={async (event) => {
                  event.preventDefault()
                  setIsDragOver(false)
                  await handleFileSelect(event.dataTransfer.files?.[0])
                }}
                className={`mt-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                  isDragOver
                    ? 'border-primary-500 bg-primary-500/5'
                    : 'border-border bg-background hover:border-primary-500/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={async (event) => {
                    await handleFileSelect(event.target.files?.[0])
                  }}
                />
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background-secondary text-foreground-muted">
                  <UploadCloud size={24} />
                </div>
                <div className="mt-4 text-sm font-semibold text-foreground">Bam chon file hoac keo tha vao day</div>
                <div className="mt-1 text-xs text-foreground-muted">Chi ho tro dinh dang `.xlsx`</div>
                {fileName ? (
                  <div className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground">
                    File hien tai: <span className="font-semibold">{fileName}</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Chon file Excel
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-primary-500/20 bg-primary-500/5 p-4 text-sm text-foreground">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-primary-500" />
                <div className="space-y-1 text-xs leading-5 text-foreground-muted">
                  <p>Moi dong la 1 SKU van hanh: VARIANT hoac CONVERSION.</p>
                  <p>CONVERSION phai co SKU nguon quy doi tro ve 1 VARIANT cung Ma nhom SP.</p>
                  <p>Cot gia dong duoc nhan dien theo ten bang gia hien co trong cai dat.</p>
                  <p>Trong mode update, co the xoa bot cot khong can cap nhat nhung phai giu Ma nhom SP, Loai dong va SKU.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-hidden rounded-2xl border border-border bg-background-secondary/10">
            <div className="border-b border-border px-5 py-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-foreground-muted">Bước 3</div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                <div className="rounded-xl bg-background px-3 py-2 text-foreground">
                  Tổng dòng: <span className="font-semibold">{preview?.summary.totalRows ?? parsedFile?.rows.length ?? 0}</span>
                </div>
                <div className="rounded-xl bg-background px-3 py-2 text-foreground">
                  Hợp lệ: <span className="font-semibold text-emerald-500">{preview?.summary.validRows ?? 0}</span>
                </div>
                <div className="rounded-xl bg-background px-3 py-2 text-foreground">
                  Bỏ qua: <span className="font-semibold text-amber-500">{preview?.summary.skippedRows ?? 0}</span>
                </div>
                <div className="rounded-xl bg-background px-3 py-2 text-foreground">
                  Lỗi: <span className="font-semibold text-red-500">{preview?.summary.errorCount ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-auto px-5 py-4">
              {previewMutation.isPending ? (
                <div className="flex h-full min-h-[260px] items-center justify-center text-foreground-muted">
                  <Loader2 size={20} className="mr-2 animate-spin" />
                  Dang phan tich file Excel...
                </div>
              ) : preview ? (
                <div className="space-y-4">
                  {preview.groups.some((group) => !group.valid) ? (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
                      Co nhom du lieu khong hop le. Cac nhom nay se bi bo qua khi xac nhan.
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-2xl border border-border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-background">
                        <tr className="text-left text-xs uppercase tracking-[0.16em] text-foreground-muted">
                          <th className="px-4 py-3">Dong</th>
                          <th className="px-4 py-3">Ma nhom SP</th>
                          <th className="px-4 py-3">SKU</th>
                          <th className="px-4 py-3">Loai</th>
                          <th className="px-4 py-3">Ket qua</th>
                          <th className="px-4 py-3">Chi tiet</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {previewItems.map((item) => (
                          <tr key={`${item.rowNumber}-${item.sku}`} className="align-top">
                            <td className="px-4 py-3 text-foreground-muted">{item.rowNumber}</td>
                            <td className="px-4 py-3 font-medium text-foreground">{item.groupCode}</td>
                            <td className="px-4 py-3 font-mono text-xs text-foreground">{item.sku}</td>
                            <td className="px-4 py-3 text-foreground">{item.rowType}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  item.action === 'create' || item.action === 'update'
                                    ? 'bg-emerald-500/10 text-emerald-500'
                                    : 'bg-amber-500/10 text-amber-500'
                                }`}
                              >
                                {item.action === 'create' ? 'Tạo mới' : item.action === 'update' ? 'Cập nhật' : 'Bỏ qua'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs leading-5 text-foreground-muted">
                              {item.messages.length > 0 ? item.messages.join(' ') : 'Hợp lệ.'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.items.length > previewItems.length ? (
                    <div className="text-xs text-foreground-muted">
                      Dang hien thi {previewItems.length}/{preview.items.length} dong preview dau tien.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex h-full min-h-[260px] items-center justify-center text-center text-sm text-foreground-muted">
                  Chua co preview. Hay chon file Excel de he thong phan tich truoc khi nhap.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-background px-6 py-4">
          <button
            type="button"
            onClick={resetState}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-background-secondary"
          >
            Xoa file hien tai
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                resetState()
                onClose()
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-background-secondary"
            >
              Huy
            </button>
            <button
              type="button"
              onClick={() => commitMutation.mutate()}
              disabled={!preview?.canCommit || commitMutation.isPending || previewMutation.isPending}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary-500 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {commitMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Xac nhan nhap'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
