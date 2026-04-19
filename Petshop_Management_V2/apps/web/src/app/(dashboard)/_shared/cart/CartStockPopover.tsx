'use client'

import Link from 'next/link'
import { Info } from 'lucide-react'
import type { CartStockPopoverProps } from './cart.types'

/**
 * CartStockPopover — Shared stock info popover cho POS và Orders.
 * Hiển thị tồn kho theo từng chi nhánh khi hover.
 */
export function CartStockPopover({ item, currentTrueVariant, activeBranches }: CartStockPopoverProps) {
    const currentVariantObj = Array.isArray((item as any).variants)
        ? (item as any).variants.find((v: any) => v.id === (item as any).productVariantId)
        : null
    const headerName = currentVariantObj?.name || item.description
    const headerSku = item.sku || currentVariantObj?.sku || currentTrueVariant?.sku || 'N/A'

    return (
        <div className="group/stock relative shrink-0 z-60 flex">
            <Info size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 group-hover/stock:text-[#0089A1] cursor-help transition-all" />
            <div className="absolute top-full left-1/2 -translate-x-[40%] mt-2 w-[340px] opacity-0 invisible group-hover/stock:opacity-100 group-hover/stock:visible group-hover/stock:pointer-events-auto transition-all duration-200 p-0 pointer-events-none before:absolute before:-top-4 before:left-0 before:w-full before:h-4 z-100">
                <div className="bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden w-full h-full">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                        <Link
                            href={item.productId ? `/products/${item.productId}` : '#'}
                            target="_blank"
                            className="font-bold text-[13px] text-gray-800 hover:text-[#0089A1] hover:underline leading-tight block cursor-pointer transition-colors"
                        >
                            {headerName}
                        </Link>
                        <div className="text-[10px] text-gray-500 mt-0.5 font-medium tracking-wide uppercase">
                            {headerSku}
                        </div>
                    </div>

                    <div className="px-4 py-3">
                        <table className="w-full text-xs text-right whitespace-nowrap">
                            <thead>
                                <tr className="border-b border-gray-100 text-gray-500">
                                    <th className="text-left font-semibold pb-2"></th>
                                    <th className="font-semibold pb-2 px-2">TỒN</th>
                                    <th className="font-semibold pb-2 px-2 text-[#0089A1]">KHẢ DỤNG</th>
                                    <th className="font-semibold pb-2 pl-2">ĐỂ BÁN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const target = currentTrueVariant ?? item
                                    const branchStocks = Array.isArray((target as any).branchStocks)
                                        ? (target as any).branchStocks
                                        : []
                                    const isService = item.type !== 'product'
                                    const fallback = isService ? '∞' : '—'

                                    return (
                                        <>
                                            <tr className="border-b border-gray-50">
                                                <td className="text-left py-2.5 font-semibold text-gray-800">Tổng tồn kho</td>
                                                <td className="px-2 py-2.5">{isService ? fallback : (target as any).stock ?? fallback}</td>
                                                <td className="px-2 py-2.5 text-[#0089A1] font-bold">
                                                    {isService
                                                        ? fallback
                                                        : (target as any).availableStock !== undefined
                                                            ? (target as any).availableStock
                                                            : (target as any).stock !== undefined && (target as any).stock !== null
                                                                ? (target as any).stock - ((target as any).trading || (target as any).reserved || 0)
                                                                : fallback}
                                                </td>
                                                <td className="pl-2 py-2.5">{isService ? fallback : (target as any).trading ?? fallback}</td>
                                            </tr>
                                            {activeBranches.map((branch: any) => {
                                                const branchStock = branchStocks.find(
                                                    (s: any) => s.branchId === branch.id || s.branch?.id === branch.id,
                                                )
                                                const stock = branchStock ? branchStock.stock ?? 0 : 0
                                                const reserved = branchStock ? branchStock.reservedStock ?? 0 : 0
                                                const available =
                                                    branchStock?.availableStock !== undefined && branchStock?.availableStock !== null
                                                        ? branchStock.availableStock
                                                        : stock - reserved

                                                return (
                                                    <tr key={branch.id} className="border-b border-gray-50 last:border-0 border-dashed">
                                                        <td className="text-left py-2 font-medium text-gray-600 truncate max-w-[120px]">{branch.name}</td>
                                                        <td className="px-2 py-2">{isService ? fallback : stock}</td>
                                                        <td className="px-2 py-2 text-[#0089A1]/80">{isService ? fallback : available}</td>
                                                        <td className="pl-2 py-2">{fallback}</td>
                                                    </tr>
                                                )
                                            })}
                                        </>
                                    )
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
