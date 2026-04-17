'use client'

import Link from 'next/link'
import { Info } from 'lucide-react'
import type { BranchStock, SelectedItem } from './receipt.types'
import { getVariantSnapshot } from './receipt.utils'

interface StockPopoverProps {
  item: SelectedItem
  branches: any[]
}

export function StockPopover({ item, branches }: StockPopoverProps) {
  const snapshot = getVariantSnapshot(item)
  const branchStocks: BranchStock[] = Array.isArray(snapshot.branchStocks) ? snapshot.branchStocks : []
  const productHref = item.productId ? `/products/${item.productId}` : null

  return (
    <div className="group/stock relative z-60 flex shrink-0">
      {/* Trigger: Info icon — hidden until row is hovered */}
      <Info
        size={15}
        className="text-foreground-muted opacity-0 group-hover:opacity-100 group-hover/stock:text-primary-500 cursor-help transition-all"
      />

      {/* Popup */}
      <div className="absolute top-full left-1/2 -translate-x-[40%] mt-2 w-[340px] opacity-0 invisible group-hover/stock:opacity-100 group-hover/stock:visible transition-all duration-200 pointer-events-none group-hover/stock:pointer-events-auto before:absolute before:-top-4 before:left-0 before:w-full before:h-4 z-100">
        <div className="bg-background-secondary border border-border shadow-2xl rounded-xl overflow-hidden">
          {/* Header: product name (link) + SKU */}
          <div className="bg-background-tertiary px-4 py-3 border-b border-border">
            {productHref ? (
              <Link
                href={productHref}
                target="_blank"
                className="font-bold text-[13px] text-foreground hover:text-primary-500 hover:underline leading-tight block cursor-pointer transition-colors"
              >
                {snapshot.displayName}
              </Link>
            ) : (
              <div className="font-bold text-[13px] leading-tight text-foreground">
                {snapshot.displayName}
              </div>
            )}
            <div className="text-[10px] text-foreground-muted mt-0.5 font-medium tracking-wide uppercase">
              {snapshot.displaySku || snapshot.displayBarcode || 'N/A'}
            </div>
          </div>

          {/* Stock table */}
          <div className="px-4 py-3">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead>
                <tr className="border-b border-border text-foreground-muted">
                  <th className="text-left font-semibold pb-2"></th>
                  <th className="font-semibold pb-2 px-2">TỒN</th>
                  <th className="font-semibold pb-2 px-2 text-primary-500">KHẢ DỤNG</th>
                  <th className="font-semibold pb-2 pl-2">ĐÃ BÁN</th>
                </tr>
              </thead>
              <tbody>
                {/* Total row */}
                <tr className="border-b border-border/50">
                  <td className="text-left py-2.5 font-semibold text-foreground">Tổng tồn kho</td>
                  <td className="px-2 py-2.5">{snapshot.totalStock ?? '—'}</td>
                  <td className="px-2 py-2.5 text-primary-500 font-bold">{snapshot.totalStock ?? '—'}</td>
                  <td className="pl-2 py-2.5 text-foreground-muted">—</td>
                </tr>

                {/* Per-branch rows */}
                {branches.filter((b: any) => b.isActive !== false).map((b: any) => {
                  const bs = branchStocks.find(
                    (s) => s.branchId === b.id || s.branch?.id === b.id,
                  )
                  const stock = bs ? (bs.stock ?? 0) : 0
                  const reserved = bs ? (bs.reservedStock ?? 0) : 0
                  const available =
                    bs !== undefined && bs !== null && bs.availableStock !== undefined && bs.availableStock !== null
                      ? bs.availableStock
                      : stock - reserved

                  return (
                    <tr key={b.id} className="border-b border-border/30 border-dashed last:border-0">
                      <td className="text-left py-2 font-medium text-foreground-secondary truncate max-w-[120px]">
                        {b.name}
                      </td>
                      <td className="px-2 py-2">{stock}</td>
                      <td className={`px-2 py-2 font-semibold ${available <= 0 ? 'text-error' : 'text-primary-500/80'}`}>
                        {available}
                      </td>
                      <td className="pl-2 py-2 text-foreground-muted">—</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
