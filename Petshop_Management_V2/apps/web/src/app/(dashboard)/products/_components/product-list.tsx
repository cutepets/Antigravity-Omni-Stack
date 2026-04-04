'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Plus, Pencil, Trash2,
  Download, Upload, BadgeCheck, AlertCircle, ChevronLeft, ChevronRight, PackageCheck
} from 'lucide-react'
import Link from 'next/link'
import { inventoryApi } from '@/lib/api/inventory.api'
import { ProductFormModal } from './product-form-modal'
import { toast } from 'sonner'

export function ProductList() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, category, page],
    queryFn: () => inventoryApi.getProducts({
      search,
      category: category || undefined,
      page,
      limit: 15,
    }),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => inventoryApi.getCategories()
  })

  const deleteMutation = useMutation({
    mutationFn: inventoryApi.deleteProduct,
    onSuccess: () => {
      toast.success('Đã xoá sản phẩm')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Không thể xoá sản phẩm này'
      toast.error(msg)
    },
  })

  const handleDelete = (p: any) => {
    if (window.confirm(`Xoá sản phẩm "${p.name}"? Hệ thống sẽ báo lỗi nếu sản phẩm này đã được bán.`)) {
      deleteMutation.mutate(p.id)
    }
  }

  const products = (data as any)?.data ?? []
  const total = (data as any)?.total ?? 0
  const totalPages = (data as any)?.totalPages ?? 1

  return (
    <div className="card overflow-hidden p-0">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border flex-wrap">
        <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              placeholder="Tìm theo tên, SKU, Barcode..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="form-input pl-9"
            />
          </div>
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1) }}
            className="form-input w-auto min-w-[160px]"
          >
            <option value="">Tất cả danh mục</option>
            {categories?.data?.map((cat: any) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="btn-outline h-9 px-4 rounded-xl text-sm">
            <Download size={15} /> Export
          </button>
          
          <button
            onClick={() => { setEditingProduct(null); setIsModalOpen(true) }}
            className="btn-primary liquid-button h-9 px-4 rounded-xl text-sm"
          >
            <Plus size={15} /> Thêm sản phẩm
          </button>
        </div>
      </div>

      {/* ── Summary bar ── */}
      <div className="px-4 py-2 bg-background-tertiary border-b border-border text-xs text-foreground-muted">
        Tổng <strong className="text-foreground">{total}</strong> sản phẩm
        {search && <span> · tìm kiếm "<em>{search}</em>"</span>}
      </div>

      {/* ── Table ── */}
      <div className="w-full overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã/Barcode</th>
              <th>Sản phẩm</th>
              <th>Danh mục</th>
              <th>Tồn kho</th>
              <th>Giá vốn / Giá bán</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-foreground-muted text-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-6 w-6 rounded-full border-2 border-border border-t-primary-500 animate-spin" />
                    Đang tải dữ liệu...
                  </div>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-foreground-muted">
                    <Search size={32} className="opacity-30" />
                    <p className="text-sm">Không tìm thấy sản phẩm nào</p>
                  </div>
                </td>
              </tr>
            ) : (
              products.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex flex-col gap-1">
                      {p.sku && <span className="font-mono text-xs font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-md w-fit">SKU: {p.sku}</span>}
                      {p.barcode && <span className="text-xs text-foreground-muted">BC: {p.barcode}</span>}
                      {p.productCode && <span className="text-xs text-foreground-muted">PC: {p.productCode}</span>}
                    </div>
                  </td>

                  <td>
                    <div className="flex items-center gap-3">
                      {p.image ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-background-secondary border border-border">
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-background-secondary border border-border flex-shrink-0 text-foreground-muted">
                          <PackageCheck size={18} />
                        </div>
                      )}
                      <div>
                        <Link href={`/products/${p.id}`} className="font-semibold text-foreground hover:text-primary-500 transition-colors">
                          {p.name}
                        </Link>
                        {p.unit && <div className="text-xs text-foreground-muted mt-0.5">ĐVT: {p.unit} {p.weight ? `(${p.weight})` : ''}</div>}
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="text-sm font-medium">{p.category || '—'}</div>
                    <div className="text-xs text-foreground-muted">{p.brand}</div>
                  </td>

                  <td>
                    <div className={`font-semibold ${(p.branchStocks?.[0]?.stock ?? 0) <= (p.branchStocks?.[0]?.minStock ?? 0) ? 'text-error' : 'text-foreground'}`}>
                      {p.branchStocks?.[0]?.stock ?? 0}
                    </div>
                    {p.variants?.length > 0 && <div className="text-[10px] text-foreground-muted mt-0.5">{p.variants.length} phiên bản</div>}
                  </td>

                  <td>
                    <div className="text-sm font-semibold text-primary-600">
                      B: {(p.price ?? 0).toLocaleString('vi-VN')}₫
                    </div>
                    <div className="text-xs text-foreground-muted mt-0.5">
                      V: {(p.costPrice ?? 0).toLocaleString('vi-VN')}₫
                    </div>
                  </td>

                  <td>
                    {p.isActive !== false ? (
                      <span className="badge badge-success">
                        <BadgeCheck size={11} /> Đang bán
                      </span>
                    ) : (
                      <span className="badge badge-error">
                        <AlertCircle size={11} /> Ngừng bán
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-foreground-muted">Trang {page} / {totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <ProductFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialData={editingProduct}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
        />
      )}
    </div>
  )
}

