'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, MapPin, Phone, Building2 } from 'lucide-react'
import { stockApi } from '@/lib/api/stock.api'
import { SupplierFormModal } from './supplier-form-modal'

export function SupplierList() {
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null)

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => stockApi.getSuppliers(),
  })

  // The API returns { success: true, data: [...] }
  const suppliersData = (suppliers as any)?.data?.data ?? []

  const filteredSuppliers = suppliersData.filter((s: any) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  )

  const handleCreate = () => {
    setSelectedSupplier(null)
    setIsModalOpen(true)
  }

  const handleEdit = (supplier: any) => {
    setSelectedSupplier(supplier)
    setIsModalOpen(true)
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            placeholder="Tìm tên nhà cung cấp, số điện thoại..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-9 w-full"
          />
        </div>

        <button onClick={handleCreate} className="btn-primary liquid-button h-9 px-4 rounded-xl text-sm">
          <Plus size={15} /> Thêm nhà cung cấp
        </button>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nhà cung cấp</th>
              <th>Liên hệ</th>
              <th>Địa chỉ</th>
              <th>Công nợ hiện tại</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-16 text-center text-foreground-muted text-sm">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-16 text-center text-foreground-muted">
                  Không tìm thấy nhà cung cấp nào.
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((s: any) => (
                <tr key={s.id} onClick={() => handleEdit(s)} className="cursor-pointer hover:bg-background-secondary/50">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center flex-shrink-0">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{s.name}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1 text-sm">
                      {s.phone && <div className="flex items-center gap-1.5 text-foreground-muted"><Phone size={13} /> {s.phone}</div>}
                    </div>
                  </td>
                  <td>
                    {s.address && (
                      <div className="flex items-start gap-1.5 text-sm text-foreground-muted">
                        <MapPin size={13} className="mt-0.5 flex-shrink-0" />
                        <span className="truncate max-w-[200px]">{s.address}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className={`font-bold ${s.debt > 0 ? 'text-error' : 'text-foreground'}`}>
                      {s.debt > 0 ? `${s.debt.toLocaleString('vi-VN')}₫` : '0₫'}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SupplierFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialData={selectedSupplier}
      />
    </div>
  )
}
