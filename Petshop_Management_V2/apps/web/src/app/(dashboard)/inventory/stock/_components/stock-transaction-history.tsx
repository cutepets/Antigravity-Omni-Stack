'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, ArrowDownRight, RefreshCcw, Package } from 'lucide-react'
import Link from 'next/link'
import dayjs from 'dayjs'
import { useRouter } from 'next/navigation'
import { resolveProductVariantLabels } from '@petshop/shared'
import { stockApi } from '@/lib/api/stock.api'
import { inventoryApi } from '@/lib/api/inventory.api'
import { getDisplayBranchStocks, sumBranchStockRows } from '@/lib/inventory-conversion-stock'

function getCurrentStock(product: any, productVariantId?: string | null) {
  return sumBranchStockRows(
    getDisplayBranchStocks(product, productVariantId ?? null) as any[],
    'stock',
  )
}

function getVariant(product: any, productVariantId?: string | null) {
  if (!productVariantId || !Array.isArray(product?.variants)) return null
  return product.variants.find((item: any) => item?.id === productVariantId) ?? null
}

export function StockTransactionHistory({
  productId,
  productVariantId,
}: {
  productId: string
  productVariantId?: string | null
}) {
  const router = useRouter()

  const { data: productResponse, isLoading: isLoadingProduct } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => inventoryApi.getProduct(productId),
  })

  const { data: transactionResponse, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['transactions', productId, productVariantId ?? 'base'],
    queryFn: () => stockApi.getTransactions(productId, productVariantId ? { variantId: productVariantId } : undefined),
  })

  const product = (productResponse as any)?.data
  const transactions = Array.isArray((transactionResponse as any)?.data) ? (transactionResponse as any).data : []
  const variant = useMemo(() => getVariant(product, productVariantId), [product, productVariantId])
  const currentStock = product ? getCurrentStock(product, productVariantId) : 0
  const displayName = product
    ? variant
      ? resolveProductVariantLabels(product.name, variant).displayName || `${product.name} - ${variant.sku || 'Phien ban'}`
      : product.name
    : ''

  if (isLoadingProduct || isLoadingTransactions) {
    return <div className="animate-pulse p-8 text-center text-foreground-muted">Dang tai lich su...</div>
  }

  if (!product) {
    return <div className="rounded-xl border border-error/20 bg-error/5 p-8 text-center text-error">Khong tim thay mat hang nay.</div>
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'IN':
        return <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10 text-success"><ArrowUpRight size={16} /></div>
      case 'OUT':
        return <div className="flex h-8 w-8 items-center justify-center rounded-full bg-error/10 text-error"><ArrowDownRight size={16} /></div>
      case 'ADJUST':
        return <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10 text-warning"><RefreshCcw size={16} /></div>
      default:
        return <div className="flex h-8 w-8 items-center justify-center rounded-full bg-border"><Package size={16} /></div>
    }
  }

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'IN':
        return <span className="font-semibold text-success">Nhap kho</span>
      case 'OUT':
        return <span className="font-semibold text-error">Xuat / Ban hang</span>
      case 'ADJUST':
        return <span className="font-semibold text-warning">Dieu chinh kho</span>
      default:
        return <span>{type}</span>
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 border-b border-border pb-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background-secondary text-foreground-muted transition-colors hover:bg-border hover:text-foreground"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Lich su kho</h1>
          <p className="text-sm text-foreground-muted">
            {displayName} (Ton hien tai: <strong className="text-primary-600">{currentStock}</strong>)
          </p>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="w-full overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Loai giao dich</th>
                <th>So luong bien dong</th>
                <th>Ma tham chieu</th>
                <th>Ghi chu</th>
                <th>Thoi gian</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-foreground-muted">
                    Chua co lich su giao dich cho mat hang nay.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction: any) => (
                  <tr key={transaction.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {getTransactionIcon(transaction.type)}
                        {getTransactionLabel(transaction.type)}
                      </div>
                    </td>
                    <td>
                      {transaction.type === 'IN' && <span className="text-success">+{transaction.quantity}</span>}
                      {transaction.type === 'OUT' && <span className="text-error">-{transaction.quantity}</span>}
                      {transaction.type === 'ADJUST' && <span className="text-warning">{Math.abs(transaction.quantity)}</span>}
                    </td>
                    <td className="font-mono text-sm">
                      {transaction.referenceId ? (
                        transaction.type === 'IN' ? (
                          <Link href={`/inventory/receipts/${transaction.referenceId}`} className="text-primary-500 hover:underline">
                            {transaction.referenceId}
                          </Link>
                        ) : (
                          transaction.referenceId
                        )
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="text-sm">{transaction.reason || '-'}</td>
                    <td className="text-sm text-foreground-muted">{dayjs(transaction.createdAt).format('DD/MM/YYYY HH:mm')}</td>
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
