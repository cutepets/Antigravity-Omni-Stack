'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save, FileDown, Plus } from 'lucide-react'
import { stockApi } from '@/lib/api/stock.api'

// Simplistic receipt detail placeholder
export function ReceiptDetail({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preloadProductId = searchParams.get('productId')
  const isNew = id === 'new'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-background-secondary border border-border flex items-center justify-center hover:bg-border transition-colors text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isNew ? 'Tạo phiếu nhập mới' : `Chi tiết phiếu nhập #${id.substring(0,8)}`}
          </h1>
          <p className="text-sm text-foreground-muted">Quản lý các mặt hàng nhập và nhà cung cấp</p>
        </div>
      </div>

      <div className="card">
        {preloadProductId && (
          <div className="p-3 mb-4 bg-primary-500/10 border border-primary-500/30 text-primary-600 rounded-lg text-sm">
            Tự động load sản phẩm: {preloadProductId}
          </div>
        )}
        <div className="text-center py-20 text-foreground-muted border-2 border-dashed border-border rounded-xl">
          <FileDown size={48} className="mx-auto mb-4 opacity-20" />
          <p className="mb-4">Giao diện thêm sản phẩm vào phiếu nhập và chọn nhà cung cấp.</p>
          <button className="btn-primary liquid-button h-10 px-6 rounded-xl text-sm mx-auto">
             <Save size={16} className="mr-2" /> Lưu nháp
          </button>
        </div>
      </div>
    </div>
  )
}
