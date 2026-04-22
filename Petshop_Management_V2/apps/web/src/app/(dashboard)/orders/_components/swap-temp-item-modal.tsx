'use client'
import { useState, useEffect } from 'react'
import { X, ArrowLeftRight, Search, AlertCircle, Loader2 } from 'lucide-react'
import { buildProductVariantName, resolveProductVariantLabels } from '@petshop/shared'
import { formatCurrency } from '@/lib/utils'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { orderApi } from '@/lib/api/order.api'
import { toast } from 'sonner'

interface SwapTempItemModalProps {
    isOpen: boolean
    onClose: () => void
    orderId: string
    itemId: string
    itemDescription: string
    targetUnitPrice: number
    onSuccess?: () => void
}

export function SwapTempItemModal({
    isOpen,
    onClose,
    orderId,
    itemId,
    itemDescription,
    targetUnitPrice,
    onSuccess,
}: SwapTempItemModalProps) {
    const [search, setSearch] = useState('')
    const queryClient = useQueryClient()

    const { data: catalogData, isLoading: catalogLoading } = useQuery({
        queryKey: ['pos-catalog-for-swap'],
        queryFn: () => orderApi.getCatalog(),
        enabled: isOpen,
        staleTime: 60_000,
    })

    const swapMutation = useMutation({
        mutationFn: ({ variantId, productId }: { variantId: string; productId: string }) =>
            orderApi.swapTempItem(orderId, itemId, { realProductId: productId, realProductVariantId: variantId }),
        onSuccess: () => {
            toast.success('Đã đổi sang sản phẩm thật')
            // Invalidate cả UUID key lẫn orderNumber key (useOrderWorkspace dùng orderNumber làm queryKey)
            void queryClient.invalidateQueries({ queryKey: ['orders'] })
            void queryClient.invalidateQueries({ queryKey: ['order', orderId] })
            void queryClient.invalidateQueries({ queryKey: ['order-timeline', orderId] })
            void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'order' })
            onSuccess?.()
            onClose()
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message ?? 'Không thể đổi sản phẩm'
            toast.error(msg)
        },
    })

    useEffect(() => {
        if (isOpen) setSearch('')
    }, [isOpen])

    if (!isOpen) return null

    const products: any[] = catalogData?.products ?? []

    // Flatten products + variants
    const allVariants: {
        id: string
        productId: string
        name: string
        displayName: string
        variantLabel?: string | null
        unitLabel?: string | null
        productName: string
        sku?: string
        price: number
        image?: string
    }[] = []
    for (const product of products) {
        if (product.variants?.length > 0) {
            for (const v of product.variants) {
                const labels = resolveProductVariantLabels(product.name, v)
                const displayName = labels.displayName || buildProductVariantName(product.name, labels.variantLabel, labels.unitLabel) || v.name

                allVariants.push({
                    id: v.id,
                    productId: product.id,
                    name: v.name,
                    displayName,
                    variantLabel: labels.variantLabel,
                    unitLabel: labels.unitLabel,
                    productName: product.name,
                    sku: v.sku ?? product.sku,
                    price: v.price ?? product.price,
                    image: v.image ?? product.image,
                })
            }
        } else {
            allVariants.push({
                id: product.id,
                productId: product.id,
                name: product.name,
                displayName: product.name,
                productName: product.name,
                sku: product.sku,
                price: product.price,
                image: product.image,
            })
        }
    }

    const q = search.trim().toLowerCase()

    // Filter: price match AND search query
    const displayList = allVariants.filter((v) => {
        if (Math.abs(v.price - targetUnitPrice) > 0.01) return false
        if (!q) return true
        return (
            v.productName.toLowerCase().includes(q) ||
            v.name.toLowerCase().includes(q) ||
            v.displayName.toLowerCase().includes(q) ||
            (v.variantLabel ?? '').toLowerCase().includes(q) ||
            (v.unitLabel ?? '').toLowerCase().includes(q) ||
            (v.sku ?? '').toLowerCase().includes(q)
        )
    })

    return (
        <div
            className="fixed inset-0 z-999 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                            <ArrowLeftRight size={16} />
                        </div>
                        <div>
                            <h2 className="text-[15px] font-semibold text-gray-900">Đổi sang sản phẩm thật</h2>
                            <p className="text-xs text-gray-400 truncate max-w-[280px]">SP tạm: {itemDescription}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Price constraint notice */}
                <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 shrink-0">
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                    <p className="text-xs text-amber-700">
                        Chỉ hiển thị sản phẩm có giá bằng đúng{' '}
                        <span className="font-bold">{formatCurrency(targetUnitPrice)}</span>.
                        Điều kiện này bắt buộc để không thay đổi tổng đơn.
                    </p>
                </div>

                {/* Search */}
                <div className="px-5 pt-3 pb-2 shrink-0">
                    <div className="relative">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm theo tên hoặc SKU..."
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-8 pr-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 placeholder:text-gray-400 transition-colors"
                        />
                    </div>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto px-5 pb-5">
                    {catalogLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 size={24} className="animate-spin text-primary-500" />
                        </div>
                    ) : displayList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                            <AlertCircle size={28} className="mb-2 opacity-40" />
                            <p className="text-sm font-medium text-gray-600">Không tìm thấy sản phẩm</p>
                            <p className="text-xs mt-1">có giá {formatCurrency(targetUnitPrice)}</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5 mt-1">
                            {displayList.map((variant, idx) => (
                                <button
                                    key={`${variant.id}-${idx}`}
                                    disabled={swapMutation.isPending}
                                    onClick={() => swapMutation.mutate({ variantId: variant.id, productId: variant.productId })}
                                    className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-primary-400 hover:bg-primary-50/30 transition-colors disabled:opacity-50"
                                >
                                    <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center">
                                        {variant.image ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={variant.image} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-base">📦</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold text-gray-900">{variant.displayName}</div>
                                        {(variant.variantLabel || variant.unitLabel) && (
                                            <div className="truncate text-xs text-gray-400">
                                                {[variant.variantLabel, variant.unitLabel].filter(Boolean).join(' • ')}
                                            </div>
                                        )}
                                        {variant.sku && <div className="text-[11px] font-mono text-gray-400">{variant.sku}</div>}
                                    </div>
                                    <div className="shrink-0 text-sm font-bold text-primary-600">
                                        {formatCurrency(variant.price)}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
