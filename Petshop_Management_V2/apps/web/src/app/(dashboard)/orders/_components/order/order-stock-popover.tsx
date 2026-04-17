'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/lib/api/inventory.api'

interface StockPopoverProps {
    productId: string
    productName: string
    sku?: string
    branchStocks?: any[]
    totalStock?: number | null
    totalTrading?: number | null
}

function computeBranchRow(bs: any) {
    const stock = Number(bs.stock ?? 0)
    const trading = Number(bs.trading ?? bs.tradingStock ?? 0)
    const reserved = Number(bs.reservedStock ?? bs.reserved ?? 0)
    const available =
        bs.availableStock !== undefined && bs.availableStock !== null
            ? Number(bs.availableStock)
            : stock - reserved - trading
    return {
        branchName: bs.branchName ?? bs.branch?.name ?? 'Chi nhánh',
        stock,
        available: Math.max(0, available),
        trading: trading > 0 ? trading : null,
    }
}

function NumCell({ value, highlight = false, dimZero = false }: { value: number | null, highlight?: boolean, dimZero?: boolean }) {
    if (value === null || value === undefined) {
        return <td className="py-2.5 pl-3 text-right text-xs text-foreground-muted/40">—</td>
    }
    const isZero = value === 0
    return (
        <td className={`py-2.5 pl-3 text-right text-xs font-semibold tabular-nums ${highlight ? (isZero ? 'text-foreground-muted' : 'text-primary-500') : dimZero && isZero ? 'text-foreground-muted' : 'text-foreground'}`}>
            {value}
        </td>
    )
}

export function StockBranchPopover({
    productId,
    productName,
    sku,
    branchStocks = [],
    totalStock = null,
}: StockPopoverProps) {
    const rows = branchStocks.map(computeBranchRow)
    const hasTrading = rows.some((r) => r.trading !== null)

    // Compute totals
    const computedTotalStock = totalStock ?? (rows.length > 0 ? rows.reduce((s, r) => s + r.stock, 0) : null)
    const computedTotalAvailable = rows.length > 0 ? rows.reduce((s, r) => s + r.available, 0) : null
    const computedTotalTrading = hasTrading ? rows.reduce((s, r) => s + (r.trading ?? 0), 0) : null

    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
            {/* Header */}
            <div className="border-b border-border bg-background-secondary/60 px-4 py-3">
                <Link
                    href={`/inventory/products/${productId}`}
                    target="_blank"
                    className="block cursor-pointer truncate text-[13px] font-bold text-foreground transition-colors hover:text-primary-500 hover:underline"
                >
                    {productName}
                </Link>
                {sku && (
                    <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
                        {sku}
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="px-4 py-3">
                {branchStocks.length > 0 ? (
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border/60">
                                <th className="pb-2 text-left font-semibold text-foreground-muted">Chi nhánh</th>
                                <th className="pb-2 pl-3 text-right font-semibold text-foreground-muted">TỒN</th>
                                <th className="pb-2 pl-3 text-right font-semibold text-primary-500">KHẢ DỤNG</th>
                                {hasTrading && (
                                    <th className="pb-2 pl-3 text-right font-semibold text-foreground-muted">ĐỂ BÁN</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Total row */}
                            <tr className="border-b border-border/60">
                                <td className="py-2.5 text-left font-semibold text-foreground">Tổng tồn kho</td>
                                <NumCell value={computedTotalStock} />
                                <NumCell value={computedTotalAvailable} highlight />
                                {hasTrading && <NumCell value={computedTotalTrading} />}
                            </tr>
                            {/* Branch rows */}
                            {rows.map((row, idx) => (
                                <tr key={idx} className="border-b border-dashed border-border/30 last:border-0">
                                    <td className="max-w-[110px] truncate py-2 text-left font-medium text-foreground-muted">
                                        {row.branchName}
                                    </td>
                                    <NumCell value={row.stock} dimZero />
                                    <NumCell value={row.available} highlight />
                                    {hasTrading && <NumCell value={row.trading} />}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="flex items-center justify-between text-xs text-foreground-muted">
                        <span>Chưa có dữ liệu tồn kho</span>
                        <Link href={`/inventory/products/${productId}`} target="_blank" className="text-primary-500 hover:underline">
                            Xem sản phẩm →
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Wrapper dùng trong Order items table ──────────────────────────────────────
interface OrderStockPopoverProps {
    item: any
}

// Inner component để hooks luôn gọi unconditionally
function OrderStockPopoverInner({ item }: OrderStockPopoverProps) {
    const [isVisible, setIsVisible] = useState(false)

    // Lazy fetch: chỉ fetch khi popover được hover lần đầu
    const productId = item.productId as string
    const { data: productDetail } = useQuery({
        queryKey: ['inventory-product-stock', productId],
        queryFn: () => inventoryApi.getProduct(productId),
        enabled: isVisible,
        staleTime: 60_000,
    })

    // Ưu tiên data fresh từ API, fallback về data từ item (nếu có)
    const branchStocks: any[] = Array.isArray(productDetail?.branchStocks)
        ? productDetail.branchStocks
        : Array.isArray(item.branchStocks)
            ? item.branchStocks
            : []
    const totalStock = productDetail?.totalStock ?? productDetail?.stock ?? item.totalStock ?? item.stock ?? null

    return (
        <div
            className="group/stock relative z-60 ml-1 flex shrink-0"
            onMouseEnter={() => setIsVisible(true)}
        >
            <BarChart2
                size={13}
                className="cursor-help text-foreground-muted opacity-0 transition-all group-hover:opacity-100 group-hover/stock:text-primary-500"
            />
            <div className="absolute left-1/2 top-full z-100 mt-2 w-[340px] -translate-x-1/2 invisible opacity-0 pointer-events-none transition-all duration-200 group-hover/stock:opacity-100 group-hover/stock:visible group-hover/stock:pointer-events-auto before:absolute before:-top-4 before:left-0 before:h-4 before:w-full">
                <StockBranchPopover
                    productId={item.productId}
                    productName={item.description}
                    sku={item.sku || item.productVariantId}
                    branchStocks={branchStocks}
                    totalStock={totalStock}
                />
            </div>
        </div>
    )
}

export function OrderStockPopover({ item }: OrderStockPopoverProps) {
    if (!item.productId || item.type === 'hotel' || item.type === 'grooming') return null
    return <OrderStockPopoverInner item={item} />
}
