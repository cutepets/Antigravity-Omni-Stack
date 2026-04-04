'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, AlertCircle, PackageCheck, Download } from 'lucide-react'
import { inventoryApi } from '@/lib/api/inventory.api'
import { useRouter } from 'next/navigation'

export function StockList() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL') // ALL, LOW_STOCK
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['products-stock', search, filterType, page],
    queryFn: () => inventoryApi.getProducts({
      search,
      page,
      limit: 20,
    }),
  })

  // In real app, there might be a specific endpoint for LOW_STOCK or we filter client side
  const rawProducts = (data as any)?.data ?? []
  const products = filterType === 'LOW_STOCK' ? rawProducts.filter((p: any) => p.stock <= p.minStock) : rawProducts

  const total = products.length

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border flex-wrap">
        <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              placeholder="Tìm tên sản phẩm, SKU..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="form-input pl-9"
            />
          </div>
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1) }}
            className="form-input w-auto min-w-[160px]"
          >
            <option value="ALL">Tất cả sản phẩm</option>
            <option value="LOW_STOCK">Sắp hết hàng</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="btn-outline h-9 px-4 rounded-xl text-sm">
            <Download size={15} /> Xuất kho
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã SP</th>
              <th>Sản phẩm</th>
              <th className="text-right">Định mức tối thiểu</th>
              <th className="text-right">Tồn kho hiện tại</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-foreground-muted text-sm">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-foreground-muted">
                  Không có dữ liệu tồn kho.
                </td>
              </tr>
            ) : (
              products.map((p: any) => {
                const isLowStock = p.stock <= p.minStock
                return (
                  <tr key={p.id}>
                    <td>
                      {p.sku && <span className="font-mono text-xs font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-md w-fit">{p.sku}</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        {p.image ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-background-secondary border border-border">
                            <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-background-secondary border border-border text-foreground-muted">
                            <PackageCheck size={18} />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-foreground">{p.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right text-sm text-foreground-muted">{p.minStock ?? 0}</td>
                    <td className={`text-right font-bold text-lg ${isLowStock ? 'text-error' : 'text-emerald-500'}`}>
                      {p.stock ?? 0}
                    </td>
                    <td>
                      {isLowStock ? (
                         <span className="badge badge-error"><AlertCircle size={11} /> Sắp hết</span>
                      ) : (
                         <span className="badge badge-success">Bình thường</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/inventory/stock/${p.id}`)}
                          className="text-xs font-medium bg-background-tertiary hover:bg-border px-3 py-1.5 rounded-lg border border-border"
                        >
                          Lịch sử
                        </button>
                        <button
                          onClick={() => router.push(`/inventory/receipts/new?productId=${p.id}`)}
                          className="text-xs font-medium bg-background-tertiary hover:bg-border px-3 py-1.5 rounded-lg border border-border text-primary-600"
                        >
                          Nhập
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
