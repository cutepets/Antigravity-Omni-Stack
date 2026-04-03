'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Clock, CheckCircle2, XCircle, Search } from 'lucide-react'
import { stockApi } from '@/lib/api/stock.api'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'

export function ReceiptList() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', search, page],
    queryFn: () => stockApi.getReceipts({
      search,
      page,
      limit: 15,
    }),
  })

  const receipts = (data as any)?.data ?? []

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <span className="badge badge-warning"><Clock size={11} /> Bản nháp</span>
      case 'RECEIVED': return <span className="badge badge-success"><CheckCircle2 size={11} /> Hoàn thành</span>
      case 'CANCELLED': return <span className="badge badge-error"><XCircle size={11} /> Đã hủy</span>
      default: return <span className="badge">{status}</span>
    }
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            placeholder="Tìm theo mã phiếu nhập..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="form-input pl-9 w-full"
          />
        </div>

        <button 
          onClick={() => router.push('/inventory/receipts/new')}
          className="btn-primary liquid-button h-9 px-4 rounded-xl text-sm"
        >
          <Plus size={15} /> Tạo phiếu nhập
        </button>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="data-table relative">
          <thead>
            <tr>
              <th>Mã hóa đơn</th>
              <th>Ngày nhập</th>
              <th>Nhà cung cấp</th>
              <th className="text-right">Tổng tiền</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-foreground-muted text-sm">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : receipts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-foreground-muted">
                  Không có phiếu nhập nào.
                </td>
              </tr>
            ) : (
              receipts.map((r: any) => (
                <tr 
                  key={r.id} 
                  className="cursor-pointer hover:bg-background-secondary/50 group"
                  onClick={() => router.push(`/inventory/receipts/${r.id}`)}
                >
                  <td>
                    <span className="font-mono font-medium text-primary-500 group-hover:underline">
                      {r.invoiceCode || r.id.substring(0,8).toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {dayjs(r.receiveDate || r.createdAt).format('DD/MM/YYYY HH:mm')}
                  </td>
                  <td>
                    <div className="font-medium text-foreground">{r.supplier?.name || "Khách lẻ / Không rõ"}</div>
                  </td>
                  <td className="text-right">
                    <span className="font-bold text-foreground">
                      {(r.totalAmount || 0).toLocaleString('vi-VN')}₫
                    </span>
                  </td>
                  <td>
                    {getStatusBadge(r.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
