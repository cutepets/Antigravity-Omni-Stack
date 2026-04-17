'use client'

import Link from 'next/link'
import { BarChart2 } from 'lucide-react'

interface OrderStockPopoverProps {
    item: any
}

export function OrderStockPopover({ item }: OrderStockPopoverProps) {
    // Chỉ hiển thị cho sản phẩm có productId, không phải service/hotel
    if (!item.productId || item.type === 'hotel' || item.type === 'grooming') return null

    const branchStocks: any[] = Array.isArray(item.branchStocks) ? item.branchStocks : []
    const totalStock = item.stockInfo?.totalStock ?? item.totalStock ?? null

    return (
        <div className="group/stock relative z-60 ml-1 flex shrink-0">
            <BarChart2
                size={13}
                className="cursor-help text-foreground-muted opacity-0 transition-all group-hover:opacity-100 group-hover/stock:text-primary-500"
            />

            {/* Popup */}
            <div className="absolute left-1/2 top-full z-100 mt-2 w-[320px] -translate-x-1/2 opacity-0 invisible pointer-events-none transition-all duration-200 group-hover/stock:opacity-100 group-hover/stock:visible group-hover/stock:pointer-events-auto before:absolute before:-top-4 before:left-0 before:h-4 before:w-full">
                <div className="overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
                    {/* Header */}
                    <div className="border-b border-border bg-background-secondary px-4 py-3">
                        <Link
                            href={`/inventory/products/${item.productId}`}
                            target="_blank"
                            className="block cursor-pointer truncate text-[13px] font-bold text-foreground transition-colors hover:text-primary-500 hover:underline"
                        >
                            {item.description}
                        </Link>
                        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
                            {item.sku || item.productVariantId || 'N/A'}
                        </div>
                    </div>

                    {/* Stock table */}
                    <div className="px-4 py-3">
                        {branchStocks.length > 0 ? (
                            <table className="w-full whitespace-nowrap text-right text-xs">
                                <thead>
                                    <tr className="border-b border-border text-foreground-muted">
                                        <th className="pb-2 text-left font-semibold">Chi nhánh</th>
                                        <th className="px-2 pb-2 font-semibold">Tổng tồn</th>
                                        <th className="pb-2 pl-2 font-semibold text-primary-500">Khả dụng</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {totalStock !== null && (
                                        <tr className="border-b border-border/50">
                                            <td className="py-2.5 text-left font-semibold text-foreground">Tổng</td>
                                            <td className="px-2 py-2.5">{totalStock}</td>
                                            <td className="py-2.5 pl-2 font-bold text-primary-500">{totalStock}</td>
                                        </tr>
                                    )}
                                    {branchStocks.map((bs: any, idx: number) => {
                                        const stock = bs.stock ?? 0
                                        const reserved = bs.reservedStock ?? 0
                                        const available =
                                            bs.availableStock !== undefined && bs.availableStock !== null
                                                ? bs.availableStock
                                                : stock - reserved
                                        return (
                                            <tr key={bs.branchId ?? idx} className="border-b border-dashed border-border/30 last:border-0">
                                                <td className="max-w-[120px] truncate py-2 text-left font-medium text-foreground-muted">
                                                    {bs.branchName ?? bs.branch?.name ?? `Chi nhánh ${idx + 1}`}
                                                </td>
                                                <td className="px-2 py-2">{stock}</td>
                                                <td className={`py-2 pl-2 font-semibold ${available <= 0 ? 'text-error' : 'text-primary-500/80'}`}>
                                                    {available}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex items-center justify-between text-xs text-foreground-muted">
                                <span>Chưa có dữ liệu tồn kho</span>
                                <Link
                                    href={`/inventory/products/${item.productId}`}
                                    target="_blank"
                                    className="text-primary-500 hover:underline"
                                >
                                    Xem sản phẩm →
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
