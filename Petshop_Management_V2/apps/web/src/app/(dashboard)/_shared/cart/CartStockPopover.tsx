'use client'

import Link from 'next/link'
import { Info } from 'lucide-react'
import type { CartStockPopoverProps } from './cart.types'

function getBranchId(row: any) {
    return row.branchId ?? row.branch?.id
}

function getBranchStock(row: any) {
    return Number(row.stock ?? 0)
}

function getBranchReserved(row: any) {
    return Number(row.reservedStock ?? row.reserved ?? 0)
}

function getBranchAvailable(row: any) {
    if (row.availableStock !== undefined && row.availableStock !== null) {
        return Math.max(0, Number(row.availableStock) || 0)
    }

    return Math.max(0, getBranchStock(row) - getBranchReserved(row))
}

export function CartStockPopover({ item, currentTrueVariant, activeBranches }: CartStockPopoverProps) {
    const currentVariantObj = Array.isArray(item.variants)
        ? item.variants.find((variant) => variant.id === item.productVariantId)
        : null
    const headerName = currentVariantObj?.name || item.description
    const headerSku = item.sku || currentVariantObj?.sku || currentTrueVariant?.sku || 'N/A'
    const rawTarget = currentTrueVariant ?? item
    const hasTargetBranchStocks = Array.isArray(rawTarget.branchStocks) && rawTarget.branchStocks.length > 0
    const target = hasTargetBranchStocks
        ? rawTarget
        : {
            ...rawTarget,
            branchStocks: item.branchStocks,
            stock: rawTarget.stock ?? item.stock,
            availableStock: rawTarget.availableStock ?? item.availableStock,
            trading: rawTarget.trading ?? item.trading,
            reserved: rawTarget.reserved ?? item.reserved,
            reservedStock: rawTarget.reservedStock ?? (item as any).reservedStock,
        }
    const branchStocks = Array.isArray(target.branchStocks) ? target.branchStocks : []
    const isService = item.type !== 'product'
    const fallback = isService ? '∞' : '—'
    const totalStock = target.stock ?? (
        branchStocks.length > 0
            ? branchStocks.reduce((sum: number, row: any) => sum + getBranchStock(row), 0)
            : undefined
    )
    const totalAvailable = target.availableStock ?? (
        branchStocks.length > 0
            ? branchStocks.reduce((sum: number, row: any) => sum + getBranchAvailable(row), 0)
            : undefined
    )

    return (
        <div className="group/stock relative z-60 flex shrink-0">
            <Info size={16} className="cursor-help text-foreground-muted opacity-0 transition-all group-hover:opacity-100 group-hover/stock:text-primary-500" />
            <div className="invisible pointer-events-none absolute left-1/2 top-full z-100 mt-2 w-[340px] -translate-x-[40%] p-0 opacity-0 transition-all duration-200 before:absolute before:-top-4 before:left-0 before:h-4 before:w-full group-hover/stock:visible group-hover/stock:pointer-events-auto group-hover/stock:opacity-100">
                <div className="h-full w-full overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
                    <div className="border-b border-border bg-background-secondary/80 px-4 py-3">
                        <Link
                            href={item.productId ? `/products/${item.productId}` : '#'}
                            target="_blank"
                            className="block cursor-pointer text-[13px] font-bold leading-tight text-foreground transition-colors hover:text-primary-500 hover:underline"
                        >
                            {headerName}
                        </Link>
                        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
                            {headerSku}
                        </div>
                    </div>

                    <div className="px-4 py-3">
                        <table className="w-full whitespace-nowrap text-right text-xs">
                            <thead>
                                <tr className="border-b border-border/70 text-foreground-muted">
                                    <th className="pb-2 text-left font-semibold"></th>
                                    <th className="px-2 pb-2 font-semibold">TỒN</th>
                                    <th className="px-2 pb-2 font-semibold text-primary-500">KHẢ DỤNG</th>
                                    <th className="pb-2 pl-2 font-semibold">ĐỂ BÁN</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-border/60">
                                    <td className="py-2.5 text-left font-semibold text-foreground">Tổng tồn kho</td>
                                    <td className="px-2 py-2.5">{isService ? fallback : totalStock ?? fallback}</td>
                                    <td className="px-2 py-2.5 font-bold text-primary-500">
                                        {isService ? fallback : totalAvailable ?? fallback}
                                    </td>
                                    <td className="py-2.5 pl-2">{isService ? fallback : target.trading ?? fallback}</td>
                                </tr>
                                {activeBranches.map((branch) => {
                                    const branchStock = branchStocks.find((row: any) => getBranchId(row) === branch.id)
                                    const stock = branchStock ? getBranchStock(branchStock) : 0
                                    const available = branchStock ? getBranchAvailable(branchStock) : 0

                                    return (
                                        <tr key={branch.id} className="border-b border-dashed border-border/35 last:border-0">
                                            <td className="max-w-[120px] truncate py-2 text-left font-medium text-foreground-muted">{branch.name}</td>
                                            <td className="px-2 py-2">{isService ? fallback : stock}</td>
                                            <td className="px-2 py-2 text-primary-500/80">{isService ? fallback : available}</td>
                                            <td className="py-2 pl-2">{fallback}</td>
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
