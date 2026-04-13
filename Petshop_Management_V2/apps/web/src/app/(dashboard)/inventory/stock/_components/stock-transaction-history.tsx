'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, ArrowDownRight, RefreshCcw, Package } from 'lucide-react'
import { stockApi } from '@/lib/api/stock.api'
import { inventoryApi } from '@/lib/api/inventory.api'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dayjs from 'dayjs'

function getCurrentProductStock(product: any) {
  const variantStocks = Array.isArray(product?.variants)
    ? product.variants.flatMap((variant: any) => (Array.isArray(variant?.branchStocks) ? variant.branchStocks : []))
    : []
  const sourceRows =
    variantStocks.length > 0
      ? variantStocks
      : Array.isArray(product?.branchStocks)
        ? product.branchStocks
        : []

  return sourceRows.reduce((sum: number, row: any) => sum + Number(row?.stock ?? 0), 0)
}

export function StockTransactionHistory({ productId }: { productId: string }) {
  const router = useRouter()

  const { data: resProduct, isLoading: isLoadingProduct } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => inventoryApi.getProduct(productId),
  })

  const { data: resTrans, isLoading: isLoadingTrans } = useQuery({
    queryKey: ['transactions', productId],
    queryFn: () => stockApi.getTransactions(productId),
  })

  const product = (resProduct as any)?.data
  const transactions = Array.isArray((resTrans as any)?.data) ? (resTrans as any).data : []
  const currentStock = product ? getCurrentProductStock(product) : 0

  if (isLoadingProduct || isLoadingTrans) {
    return <div className="p-8 text-center text-foreground-muted animate-pulse">Đang tải lịch sử...</div>
  }

  if (!product) {
    return <div className="p-8 text-center text-error border border-error/20 bg-error/5 rounded-xl">Không tìm thấy mã sản phẩm này.</div>
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'IN': return <div className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center"><ArrowUpRight size={16} /></div>
      case 'OUT': return <div className="w-8 h-8 rounded-full bg-error/10 text-error flex items-center justify-center"><ArrowDownRight size={16} /></div>
      case 'ADJUST': return <div className="w-8 h-8 rounded-full bg-warning/10 text-warning flex items-center justify-center"><RefreshCcw size={16} /></div>
      default: return <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center"><Package size={16} /></div>
    }
  }

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'IN': return <span className="text-success font-semibold">Nhập kho</span>
      case 'OUT': return <span className="text-error font-semibold">Xuất / Bán hàng</span>
      case 'ADJUST': return <span className="text-warning font-semibold">Điều chỉnh kho</span>
      default: return <span>{type}</span>
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 border-b border-border pb-4">
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-background-secondary border border-border flex items-center justify-center hover:bg-border transition-colors text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Lịch sử Kho</h1>
          <p className="text-sm text-foreground-muted">{product.name} (Tồn hiện tại: <strong className="text-primary-600">{currentStock}</strong>)</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="data-table">
            <thead>
            <tr>
              <th>Loại giao dịch</th>
              <th>Số lượng biến động</th>
              <th>Mã tham chiếu</th>
              <th>Ghi chú</th>
              <th>Thời gian</th>
            </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-foreground-muted">
                    Chưa có lịch sử giao dịch nào cho sản phẩm này.
                  </td>
                </tr>
              ) : (
                transactions.map((t: any) => (
                  <tr key={t.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {getTransactionIcon(t.type)}
                        {getTransactionLabel(t.type)}
                      </div>
                    </td>
                    <td>
                      {t.type === 'IN' && <span className="text-success">+{t.quantity}</span>}
                      {t.type === 'OUT' && <span className="text-error">-{t.quantity}</span>}
                      {t.type === 'ADJUST' && <span className="text-warning">{Math.abs(t.quantity)}</span>}
                    </td>
                    <td className="font-mono text-sm">
                      {t.referenceId ? (
                        t.type === 'IN' ? (
                          <Link href={`/inventory/receipts/${t.referenceId}`} className="text-primary-500 hover:underline">
                            {t.referenceId}
                          </Link>
                        ) : (
                          t.referenceId
                        )
                      ) : '-'}
                    </td>
                    <td className="text-sm">
                      {t.reason || '-'}
                    </td>
                    <td className="text-sm text-foreground-muted">
                      {dayjs(t.createdAt).format('DD/MM/YYYY HH:mm')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
