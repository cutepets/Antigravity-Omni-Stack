'use client'

import React, { useState, useRef } from 'react'
import { FileUp, Download, X, AlertCircle } from 'lucide-react'
import { downloadReceiptTemplate, parseReceiptExcel, ParsedExcelRow } from './receipt-excel'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { inventoryApi } from '@/lib/api/inventory.api'
import type { SelectedItem } from './receipt.types'

interface ReceiptExcelModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: (items: SelectedItem[]) => void
}

export function ReceiptExcelModal({ isOpen, onClose, onImported }: ReceiptExcelModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleDownloadTemplate = async () => {
    try {
      await downloadReceiptTemplate()
    } catch (error) {
      console.error('Lỗi tải template:', error)
      toast.error('Có lỗi xảy ra khi tạo template.')
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    try {
      const parsedRows = await parseReceiptExcel(file)
      if (parsedRows.length === 0) {
        toast.error('File Excel không có dữ liệu.')
        setIsProcessing(false)
        return
      }

      const skus = Array.from(new Set(parsedRows.map((r) => r.sku)))

      // Batch fetch products by SKUs
      // Use chunks of 10 SKUs to not exceed URL length limits in case of huge files
      const chunkSize = 20
      const matchedProducts: any[] = []

      for (let i = 0; i < skus.length; i += chunkSize) {
        const chunk = skus.slice(i, i + chunkSize)
        const res = await inventoryApi.getProducts({ search: chunk.join(' '), limit: 50 }, { timeout: 30000 })
        if (res.success && res.data) {
          matchedProducts.push(...res.data)
        }
      }

      // Map rows to SelectedItems
      const newItems: SelectedItem[] = []
      const unknownSkus: string[] = []

      for (const row of parsedRows) {
        // Find matching product or variant
        // Since getProducts returns products which may have variants
        let matchedProduct = null
        let matchedVariant = null

        // Try to match product Level SKU
        matchedProduct = matchedProducts.find(p => p.sku === row.sku || p.barcode === row.sku)

        // If not found at product level, maybe it's a variant SKU
        if (!matchedProduct) {
          for (const p of matchedProducts) {
            const v = p.variants?.find((v: any) => v.sku === row.sku || v.barcode === row.sku)
            if (v) {
              matchedProduct = p
              matchedVariant = v
              break
            }
          }
        }

        if (!matchedProduct) {
          unknownSkus.push(row.sku)
          continue
        }

        // Base unit/name logic
        const unit = matchedProduct.unit ?? ''

        // Construct the item
        newItems.push({
          lineId: Math.random().toString(36).substring(7),
          productId: matchedProduct.id,
          productVariantId: matchedVariant?.id,
          sku: matchedVariant?.sku || matchedProduct.sku || '',
          barcode: matchedVariant?.barcode || matchedProduct.barcode || '',
          name: matchedProduct.name,
          variantName: matchedVariant?.name,
          unit,
          quantity: row.quantity,
          unitCost: row.unitCost || matchedProduct.costPrice || 0,
          discount: row.discount || 0,
          sellingPrice: matchedVariant?.sellingPrice || matchedProduct.sellingPrice || 0,
          note: '',
          variants: matchedProduct.variants,
        })
      }

      if (unknownSkus.length > 0) {
        if (newItems.length > 0) {
          toast.warning(`Đã bỏ qua ${unknownSkus.length} mã SP không tồn tại: ${unknownSkus.slice(0, 5).join(', ')}${unknownSkus.length > 5 ? '...' : ''}`)
        } else {
          toast.error('Không tìm thấy bất kỳ mã SP nào trong hệ thống!')
          setIsProcessing(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }
      }

      onImported(newItems)
      onClose()

      const successCount = newItems.length
      toast.success(`Đã nhập thành công ${successCount} dòng sản phẩm.`)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Lỗi đọc file Excel.')
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <FileUp size={18} className="text-primary-500" />
            Nhập sản phẩm từ Excel
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-6">
          <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-4 flex gap-3">
            <AlertCircle size={20} className="text-primary-500 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              <span className="font-semibold text-primary-500">Tải file mẫu về</span> để nhập liệu.
              Đảm bảo các Mã SP (SKU) chính xác với hệ thống để tự động tìm kiếm và cộng số lượng.
              <button
                onClick={handleDownloadTemplate}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary-500 hover:text-primary-600 transition-colors"
              >
                <Download size={14} /> Tải file excel mẫu (Template)
              </button>
            </div>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary-500 hover:bg-primary-500/5 transition-colors relative"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            {isProcessing ? (
              <div className="text-sm font-medium text-primary-500 animate-pulse">
                Đang xử lý dữ liệu...
              </div>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-background-secondary flex items-center justify-center mb-3 text-foreground-muted border border-border">
                  <FileUp size={24} />
                </div>
                <div className="text-sm font-medium text-foreground">
                  Bấm chọn để tải lên file Excel
                </div>
                <div className="text-xs text-foreground-muted mt-1">
                  Chỉ nhận định dạng .xlsx
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-t border-border px-4 py-3 bg-background-secondary/50 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline flex-1 rounded-xl py-2.5 text-sm"
          >
            Huỷ bỏ
          </button>
        </div>
      </div>
    </div>
  )
}
