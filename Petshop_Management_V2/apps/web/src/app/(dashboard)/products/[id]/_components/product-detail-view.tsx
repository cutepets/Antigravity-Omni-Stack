'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Copy, Pencil, Trash2, Box, Layers, History, Package, RefreshCw } from 'lucide-react'
import { inventoryApi } from '@/lib/api/inventory.api'
import { ProductFormModal } from '../../_components/product-form-modal'
import { toast } from 'sonner'
import dayjs from 'dayjs'

export function ProductDetailView({ productId }: { productId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['product-detail', productId],
    queryFn: () => inventoryApi.getProduct(productId)
  })

  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory')
  const [selectedVariantId, setSelectedVariantId] = useState<string>('all')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)

  // ⚠️ useMutation must be declared before any early returns (Rules of Hooks)
  const deleteMutation = useMutation({
    mutationFn: () => inventoryApi.deleteProduct(productId),
    onSuccess: () => {
      toast.success('Đã xoá sản phẩm')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      router.push('/products')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Không thể xoá sản phẩm')
    }
  })

  const product = data?.data

  if (isLoading) {
    return <div className="p-6 text-foreground-muted flex items-center justify-center h-40">Đang tải chi tiết...</div>
  }

  if (!product) {
    return <div className="p-6 text-error text-center">Không tìm thấy sản phẩm</div>
  }

  const handleDelete = () => {
    if (window.confirm(`Xoá sản phẩm "${product.name}"?`)) {
      deleteMutation.mutate()
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 pb-20 max-w-7xl mx-auto w-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Link href="/products" className="hover:text-primary-500 flex items-center gap-1 transition-colors">
            <ArrowLeft size={16} /> Kho hàng
          </Link>
          <span className="text-border">/</span>
          <span className="text-foreground font-semibold">{product.name}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCopyModalOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary text-foreground-muted transition-colors"
            title="Tạo bản sao sản phẩm này"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="h-9 px-4 flex items-center gap-2 rounded-lg border border-border bg-primary-500 text-white hover:bg-primary-600 transition-colors"
          >
            <Pencil size={15} /> <span className="text-sm font-medium">Sửa thông tin</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-error/30 bg-error/10 hover:bg-error/20 text-error transition-colors disabled:opacity-50"
            title="Xoá sản phẩm"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* ── Summary Info ── */}
      <div className="card p-6 border border-border rounded-2xl flex flex-col md:flex-row gap-8 bg-background-secondary/30">
        <div className="flex gap-6 min-w-[300px]">
          <div className="w-24 h-24 rounded-xl border border-border bg-background-tertiary flex items-center justify-center overflow-hidden flex-shrink-0">
            {product.image ? (
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Box size={32} className="text-foreground-muted/50" />
            )}
          </div>
          <div className="flex flex-col justify-center gap-2">
            <h1 className="text-xl font-bold flex items-center gap-3">
              {product.name}
              {product.isActive !== false && (
                <span className="badge badge-success text-[10px] px-2 py-0.5 rounded-full uppercase">Đang bán</span>
              )}
            </h1>
            <div className="text-primary-500 font-semibold">{(product.price ?? 0).toLocaleString('vi-VN')}₫</div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm items-start border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8">
          <div className="flex flex-col gap-4">
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">Mã SP</div><div className="font-medium">{product.productCode || '—'}</div></div>
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">Phân loại</div><div className="font-medium">{product.category || '—'}</div></div>
          </div>
          <div className="flex flex-col gap-4">
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">SKU</div><div className="font-medium">{product.sku || '—'}</div></div>
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">Đơn vị</div><div className="font-medium">{product.unit || '—'}</div></div>
          </div>
          <div className="flex flex-col gap-4">
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">Barcode</div><div className="font-medium">{product.barcode || '—'}</div></div>
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">Trọng lượng</div><div className="font-medium">{product.weight || '—'}</div></div>
          </div>
          <div className="flex flex-col gap-4">
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">Nhãn hiệu</div><div className="font-medium">{product.brand || '—'}</div></div>
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">VAT</div><div className="font-medium">0%</div></div>
          </div>
        </div>
      </div>

      {/* ── Main Details Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Variants */}
        <div className="lg:col-span-5 card p-0 overflow-hidden border border-border rounded-2xl flex flex-col self-stretch">
          <div className="p-4 border-b border-border font-semibold flex items-center justify-between text-[13px] tracking-wide uppercase text-foreground-muted bg-background-secondary/50">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-primary-500" /> Phiên bản & Quy đổi
            </div>
            <span className="w-5 h-5 rounded-full bg-background-tertiary border border-border flex items-center justify-center text-xs text-foreground">{product.variants?.length || 1}</span>
          </div>
          
          <div className="p-4 flex flex-col gap-4 overflow-y-auto">
             <div className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted mb-2">Tên</div>
             
             {/* Main logic is complex for tree view. As placeholder, rendering basic variant list */}
             <div className="relative pl-3 border-l-2 border-primary-500">
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-background-tertiary flex items-center justify-center flex-shrink-0 text-primary-500 relative">
                   <Package size={16} />
                   <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full border-2 border-background"></div>
                 </div>
                 <div className="flex flex-col">
                   <div className="text-sm font-semibold text-primary-500">{product.name}</div>
                   <div className="text-[10px] text-foreground-muted">{product.sku || 'SKU N/A'}</div>
                 </div>
               </div>

               {product.variants?.length > 0 && (
                 <div className="mt-4 flex flex-col gap-3 pl-5 relative">
                   {/* Vertical connective line */}
                   <div className="absolute top-0 bottom-6 left-0 w-px bg-border"></div>
                   
                   {product.variants.map((v: any, idx: number) => (
                     <div key={v.id} className="flex gap-4 items-center relative">
                        {/* Horizontal branch line */}
                        <div className="absolute top-1/2 left-0 w-4 h-px border-t border-border -ml-5"></div>
                        <div className="absolute top-1/2 left-0 w-px h-1/2 border-l border-border -ml-5 -mt-3 rounded-bl-sm"></div>
                        
                        <div className="w-7 h-7 rounded-md bg-background-secondary border border-border flex items-center justify-center text-foreground-muted">
                           <RefreshCw size={12} />
                        </div>
                        <div className="flex flex-col leading-tight">
                           <div className="text-sm font-medium text-foreground">{v.name}</div>
                           <div className="text-[10px] text-foreground-muted mt-0.5">{v.conversionRate} {product.unit} = 1 {v.unit}</div>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* Right Column: Tabs (Inventory & History) */}
        <div className="lg:col-span-7 card overflow-hidden border border-border rounded-2xl flex flex-col self-stretch">
          {/* Custom Tabs Header */}
          <div className="flex items-center justify-between border-b border-border bg-background-secondary/50 px-2 pt-2">
            <div className="flex">
              <button 
                onClick={() => setActiveTab('inventory')}
                className={`px-5 py-3 text-[13px] font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'inventory' ? 'border-primary-500 text-primary-500' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
              >
                <Package size={15} /> Tồn kho
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`px-5 py-3 text-[13px] font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'history' ? 'border-primary-500 text-primary-500' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
              >
                <History size={15} /> Lịch sử
              </button>
            </div>
            
            {/* Version dropdown */}
            <div className="pr-4 py-2 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-foreground-muted tracking-wider bg-background-tertiary px-2 py-1 rounded-md border border-border">Phiên bản</span>
              <select 
                value={selectedVariantId}
                onChange={e => setSelectedVariantId(e.target.value)}
                className="form-input h-7 py-0.5 px-2 text-xs w-auto focus:ring-0 rounded-md bg-background shadow-xs appearance-none border-transparent font-medium"
              >
                <option value="all">{product.name}</option>
                {product.variants?.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tab Content */}
          <div className="w-full flex-1 overflow-x-auto">
            {activeTab === 'inventory' && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="py-3 px-4 text-[11px]">CHI NHÁNH</th>
                    <th className="py-3 px-4 text-[11px] text-right">TỒN KHO</th>
                    <th className="py-3 px-4 text-[11px] text-right">CÓ THỂ BÁN</th>
                    <th className="py-3 px-4 text-[11px] text-right">TỒN TỐI THIỂU</th>
                  </tr>
                </thead>
                <tbody>
                  {product.branchStocks?.length > 0 ? (
                    product.branchStocks.map((bs: any) => (
                      <tr key={bs.id}>
                        <td className="py-3 px-4 font-semibold text-sm">{bs.branch?.name || 'Chi nhánh mặc định'}</td>
                        <td className="py-3 px-4 text-right font-semibold text-error">{bs.stock}</td>
                        <td className="py-3 px-4 text-right text-sm">{bs.stock}</td>
                        <td className="py-3 px-4 text-right text-sm">{bs.minStock}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-foreground-muted">Chưa có dữ liệu tồn kho các chi nhánh</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'history' && (
              <ProductHistoryTab productId={productId} />
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <ProductFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialData={product}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['product-detail', productId] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
          }}
        />
      )}

      {/* Copy Modal — same data but no id (creates new) */}
      {isCopyModalOpen && (
        <ProductFormModal
          isOpen={isCopyModalOpen}
          onClose={() => setIsCopyModalOpen(false)}
          initialData={{
            ...product,
            id: undefined,
            name: `${product.name} (bản sao)`,
            sku: '',
            barcode: '',
            productCode: '',
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            setIsCopyModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

function ProductHistoryTab({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-history', productId],
    queryFn: () => inventoryApi.getProductTransactions(productId)
  })

  if (isLoading) return <div className="p-8 text-center text-sm text-foreground-muted">Đang tải lịch sử...</div>

  const txs = data?.data || []

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th className="py-3 px-4 text-[11px]">THỜI GIAN</th>
          <th className="py-3 px-4 text-[11px]">HÀNH ĐỘNG</th>
          <th className="py-3 px-4 text-[11px] text-right">SỐ LƯỢNG</th>
          <th className="py-3 px-4 text-[11px]">LOẠI</th>
        </tr>
      </thead>
      <tbody>
        {txs.length === 0 ? (
          <tr>
            <td colSpan={4} className="py-8 text-center text-sm text-foreground-muted">Chưa có lịch sử giao dịch</td>
          </tr>
        ) : (
          txs.map((tx: any) => (
            <tr key={tx.id}>
              <td className="py-3 px-4 text-sm text-foreground-muted">{dayjs(tx.createdAt).format('DD/MM/YYYY HH:mm')}</td>
              <td className="py-3 px-4 text-sm max-w-[200px] truncate">{tx.reason || '—'}</td>
              <td className={`py-3 px-4 text-right font-semibold ${tx.type === 'IN' ? 'text-success' : 'text-error'}`}>
                {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
              </td>
              <td className="py-3 px-4">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tx.type === 'IN' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                  {tx.type === 'IN' ? 'Nhập kho' : 'Xuất kho'}
                </span>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
