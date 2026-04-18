'use client'
import Image from 'next/image';

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Box, Copy, History, Layers, Package, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { getProductVariantGroupKey } from '@petshop/shared'
import { inventoryApi } from '@/lib/api/inventory.api'
import { getDisplayBranchStocks, getResolvedVariantLabels, parseConversionRate } from '@/lib/inventory-conversion-stock'
import { ProductFormModal } from '../../_components/product-form-modal'
import { settingsApi } from '@/lib/api'
import { useAuthorization } from '@/hooks/useAuthorization'


type BranchStockRow = {
  id?: string
  branchId?: string | null
  productVariantId?: string | null
  stock?: number | null
  reservedStock?: number | null
  minStock?: number | null
  incomingStock?: number | null
  incoming?: number | null
  onTheWay?: number | null
  branch?: {
    id?: string
    name?: string
  } | null
}

type BranchOption = {
  id: string
  name: string
}

type DetailItemKind = 'product' | 'variant' | 'conversion'

type DetailItem = {
  key: string
  id: string
  kind: DetailItemKind
  name: string
  sku?: string | null
  barcode?: string | null
  image?: string | null
  price?: number | null
  priceBookPrices?: Record<string, number> | null
  displayUnit?: string | null
  conversionRate?: number | null
  formula?: string | null
  branchStocks: BranchStockRow[]
}

function parsePriceBookPrices(raw?: string | null) {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const TARGET_SPECIES_MAP: Record<string, string> = {
  DOG: 'Chó',
  CAT: 'Mèo',
  BOTH: 'Chó & Mèo',
  OTHER: 'Khác',
}

const DAY_MAP: Record<string, string> = {
  MON: 'Thứ 2', TUE: 'Thứ 3', WED: 'Thứ 4', THU: 'Thứ 5', FRI: 'Thứ 6', SAT: 'Thứ 7', SUN: 'Chủ nhật',
}

function formatShift(shift?: string | null) {
  if (!shift) return '—';
  const [day, ca] = shift.split('_');
  return `${DAY_MAP[day] || day} - Ca ${ca}`;
}


function getIncomingStock(row: BranchStockRow) {
  const value = Number(row.incomingStock ?? row.incoming ?? row.onTheWay ?? 0)
  return Number.isFinite(value) ? value : 0
}

function normalizeBranchStocks(rows: BranchStockRow[] | undefined) {
  return Array.isArray(rows) ? rows : []
}

function mergeBranchRowsWithBranches(rows: BranchStockRow[], branches: BranchOption[]) {
  if (branches.length === 0) {
    return rows
  }

  const rowMap = new Map<string, BranchStockRow>()

  rows.forEach((row) => {
    const key = row.branch?.id ?? row.branchId
    if (!key) {
      return
    }

    rowMap.set(key, {
      ...row,
      branchId: row.branchId ?? key,
      branch: row.branch ?? { id: key, name: `Chi nhánh ${key}` },
      stock: row.stock ?? 0,
      reservedStock: row.reservedStock ?? 0,
      minStock: row.minStock ?? 0,
      incomingStock: getIncomingStock(row),
    })
  })

  return branches.map((branch) => {
    const existing = rowMap.get(branch.id)
    if (existing) {
      return {
        ...existing,
        branchId: existing.branchId ?? branch.id,
        branch: {
          id: branch.id,
          name: branch.name,
        },
      }
    }

    return {
      id: `branch-${branch.id}`,
      branchId: branch.id,
      productVariantId: null,
      stock: 0,
      reservedStock: 0,
      minStock: 0,
      incomingStock: 0,
      branch: {
        id: branch.id,
        name: branch.name,
      },
    } satisfies BranchStockRow
  })
}

function buildDetailTree(product: any) {
  const rootBranchStocks = normalizeBranchStocks(getDisplayBranchStocks(product) as BranchStockRow[])
  const rawVariants = Array.isArray(product.variants) ? product.variants : []

  const detailItems: DetailItem[] = rawVariants.map((variant: any) => {
    const conversionRate = parseConversionRate(variant.conversions)
    const branchStocks = normalizeBranchStocks(getDisplayBranchStocks(product, variant.id) as BranchStockRow[])
    const { variantLabel, unitLabel } = getResolvedVariantLabels(product.name, variant)
    const displayUnit = conversionRate ? unitLabel || product.unit : product.unit
    const formula = conversionRate ? `${conversionRate} ${product.unit} = 1 ${displayUnit}` : null

    return {
      key: `variant:${variant.id}`,
      id: variant.id,
      kind: conversionRate ? 'conversion' : 'variant',
      name: variantLabel || variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      image: variant.image ?? product.image,
      price: variant.price ?? product.price,
      priceBookPrices: parsePriceBookPrices(variant.priceBookPrices ?? product.priceBookPrices),
      displayUnit,
      conversionRate,
      formula,
      branchStocks,
    } satisfies DetailItem
  })

  const rootItem = {
    key: `product:${product.id}`,
    id: product.id,
    kind: 'product',
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    image: product.image,
    price: product.price,
    priceBookPrices: parsePriceBookPrices(product.priceBookPrices),
    displayUnit: product.unit,
    conversionRate: null,
    formula: null,
    branchStocks: rootBranchStocks,
  } satisfies DetailItem

  const variantItems: DetailItem[] = detailItems.filter((item: DetailItem) => item.kind === 'variant')
  const conversionItems: DetailItem[] = detailItems.filter((item: DetailItem) => item.kind === 'conversion')
  const assignedConversions = new Set<string>()

  const groups: Array<{ item: DetailItem; children: DetailItem[] }> = variantItems.map((item: DetailItem) => {
    const children = conversionItems.filter(
      (child: DetailItem) => getProductVariantGroupKey(product.name, child) === getProductVariantGroupKey(product.name, item),
    )
    children.forEach((child: DetailItem) => assignedConversions.add(child.key))
    return { item, children }
  })

  const looseConversions: DetailItem[] = conversionItems.filter((item: DetailItem) => !assignedConversions.has(item.key))
  const itemMap = new Map<string, DetailItem>([
    [rootItem.key, rootItem],
    ...detailItems.map((item: DetailItem) => [item.key, item] as const),
  ])

  return {
    rootItem,
    groups,
    looseConversions,
    itemMap,
    count: itemMap.size,
  }
}

export function ProductDetailView({ productId }: { productId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: isAuthLoading } = useAuthorization()
  const canReadProducts = hasPermission('product.read')
  const canCreateProduct = hasPermission('product.create')
  const canUpdateProduct = hasPermission('product.update')
  const canDeleteProduct = hasPermission('product.delete')
  const { data, isLoading } = useQuery({
    queryKey: ['product-detail', productId],
    queryFn: () => inventoryApi.getProduct(productId),
  })
  const { data: pbData } = useQuery({
    queryKey: ['inventory', 'price-books'],
    queryFn: inventoryApi.getPriceBooks,
    staleTime: 5 * 60 * 1000,
  })
  const { data: branchesData = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: settingsApi.getBranches,
    staleTime: 5 * 60 * 1000,
  })


  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory')
  const [selectedItemKey, setSelectedItemKey] = useState<string>('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)

  useEffect(() => {
    if (isAuthLoading) return
    if (!canReadProducts) {
      router.replace('/dashboard')
    }
  }, [canReadProducts, isAuthLoading, router])

  const deleteMutation = useMutation({
    mutationFn: () => inventoryApi.deleteProduct(productId),
    onSuccess: () => {
      toast.success('Đã xoá sản phẩm')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      router.push('/products')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Không thể xoá sản phẩm')
    },
  })

  const product = data?.data
  const detailTree = useMemo(() => (product ? buildDetailTree(product) : null), [product])
  const hasComplexVariants = detailTree ? (detailTree.groups.length > 1 || (detailTree.groups[0]?.children.length ?? 0) > 0 || detailTree.looseConversions.length > 0) : false
  const visualCount = hasComplexVariants && detailTree ? detailTree.count : 1

  if (isAuthLoading) {
    return <div className="p-6 text-foreground-muted flex items-center justify-center h-40">Dang kiem tra quyen truy cap...</div>
  }

  if (!canReadProducts) {
    return <div className="p-6 text-foreground-muted flex items-center justify-center h-40">Dang chuyen huong...</div>
  }

  if (isLoading) {
    return <div className="p-6 text-foreground-muted flex items-center justify-center h-40">Đang tải chi tiết...</div>
  }

  if (!product || !detailTree) {
    return <div className="p-6 text-error text-center">Không tìm thấy sản phẩm</div>
  }

  const handleDelete = () => {
    if (window.confirm(`Xoá sản phẩm "${product.name}"?`)) {
      deleteMutation.mutate()
    }
  }

  const activeItem = detailTree.itemMap.get(selectedItemKey) ?? detailTree.rootItem
  const branches = Array.isArray(branchesData)
    ? branchesData
      .filter((branch: any) => branch?.id && branch?.name)
      .map((branch: any) => ({ id: branch.id, name: branch.name } satisfies BranchOption))
    : []
  const priceBooks = pbData?.data || []

  const activeStockRows = mergeBranchRowsWithBranches(activeItem.branchStocks, branches)
  const activeUnit = activeItem.displayUnit || product.unit || '—'
  const activeWeight =
    activeItem.kind === 'conversion' && activeItem.conversionRate && product.weight
      ? Number(product.weight) * activeItem.conversionRate
      : product.weight
  const activeItemLabel =
    activeItem.kind === 'conversion'
      ? 'Quy đổi'
      : activeItem.kind === 'variant'
        ? 'Phiên bản'
        : 'Sản phẩm'

  return (
    <div className="flex flex-col gap-6 p-6 pb-20 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Link href="/products" className="hover:text-primary-500 flex items-center gap-1 transition-colors">
            <ArrowLeft size={16} /> Kho hàng
          </Link>
          <span className="text-border">/</span>
          <span className="text-foreground font-semibold">{product.name}</span>
        </div>

        <div className="flex items-center gap-2">
          {product.deletedAt ? (
            <>
              {canUpdateProduct ? (
                <button
                  onClick={() => {
                    if (window.confirm('Khôi phục sản phẩm này?')) {
                      inventoryApi.restoreProduct(product.id).then(() => {
                        toast.success('Đã khôi phục sản phẩm')
                        queryClient.invalidateQueries({ queryKey: ['products'] })
                        queryClient.invalidateQueries({ queryKey: ['product-detail', product.id] })
                      }).catch(() => toast.error('Lỗi khi khôi phục'))
                    }
                  }}
                  className="h-9 px-4 flex items-center gap-2 rounded-lg border border-border bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                  title="Khôi phục"
                >
                  <RefreshCw size={15} /> <span className="text-sm font-medium">Khôi phục</span>
                </button>
              ) : null}
            </>
          ) : (
            <>
              {canCreateProduct ? (
                <button
                  onClick={() => setIsCopyModalOpen(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary text-foreground-muted transition-colors"
                  title="Tạo bản sao sản phẩm này"
                >
                  <Copy size={16} />
                </button>
              ) : null}
              {canUpdateProduct ? (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="h-9 px-4 flex items-center gap-2 rounded-lg border border-border bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                >
                  <Pencil size={15} /> <span className="text-sm font-medium">Sửa thông tin</span>
                </button>
              ) : null}
              {canDeleteProduct ? (
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-error/30 bg-error/10 hover:bg-error/20 text-error transition-colors disabled:opacity-50"
                  title="Xoá sản phẩm"
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LỘT CỘT TRÁI - THÔNG TIN CHUNG (khoảng 3/10) */}
        <div className="card p-6 border border-border rounded-2xl flex flex-col gap-8 bg-background-secondary/30 lg:col-span-3">
          <div className="flex flex-col gap-6">
            <div className="w-full aspect-square rounded-xl border border-border bg-background-tertiary flex items-center justify-center overflow-hidden shrink-0">
              {activeItem.image ? (
                <Image src={activeItem.image} alt={activeItem.name} className="w-full h-full object-cover" width={400} height={400} unoptimized />
              ) : (
                <Box size={32} className="text-foreground-muted/50" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-lg font-bold flex items-center gap-3">
                {activeItem.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted px-2 py-1 rounded-md border border-border bg-background-tertiary">
                  {activeItemLabel}
                </span>
                {product.deletedAt ? (
                  <span className="badge text-[10px] px-2 py-0.5 rounded-full uppercase bg-red-500/10 text-red-500 border border-red-500/20">Đã xóa</span>
                ) : product.isActive !== false ? (
                  <span className="badge badge-success text-[10px] px-2 py-0.5 rounded-full uppercase bg-success/10 text-success border border-success/20">Đang bán</span>
                ) : (
                  <span className="badge text-[10px] px-2 py-0.5 rounded-full uppercase bg-gray-500/10 text-gray-400 border border-gray-500/20">Ngưng bán</span>
                )}
              </div>
              <div className="flex flex-col gap-1 mt-2">
                {priceBooks.length > 0 ? (
                  priceBooks.map((pb: any) => {
                    const price = activeItem.priceBookPrices?.[pb.id] ?? activeItem.price ?? 0
                    return (
                      <div key={pb.id} className="flex items-center justify-between text-sm">
                        <span className="text-foreground-muted truncate pr-2">{pb.name}:</span>
                        <span className="text-primary-500 font-semibold">{price.toLocaleString('vi-VN')}₫</span>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground-muted">Giá:</span>
                    <span className="text-primary-500 font-semibold">{(activeItem.price ?? 0).toLocaleString('vi-VN')}₫</span>
                  </div>
                )}
              </div>
              {activeItem.formula && <div className="text-xs text-foreground-muted mt-1">{activeItem.formula}</div>}
            </div>
          </div>

          <div className="flex flex-col gap-3 text-sm border-t border-border pt-6">
            <div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted shrink-0">Phân loại</span><span className="font-medium text-foreground truncate max-w-[65%] text-right" title={product.category || ''}>{product.category || '—'}</span></div>
            <div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted shrink-0">Dùng cho</span><span className="font-medium text-foreground truncate max-w-[65%] text-right">{TARGET_SPECIES_MAP[product.targetSpecies as string] || product.targetSpecies || '—'}</span></div>
            <div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted shrink-0">SKU</span><span className="font-medium text-foreground truncate max-w-[65%] text-right" title={activeItem.sku || product.sku || ''}>{activeItem.sku || product.sku || '—'}</span></div>
            <div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted shrink-0">Đơn vị</span><span className="font-medium text-foreground truncate max-w-[65%] text-right" title={activeUnit}>{activeUnit}</span></div>
            <div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted shrink-0">Barcode</span><span className="font-medium text-foreground truncate max-w-[65%] text-right" title={activeItem.barcode || product.barcode || ''}>{activeItem.barcode || product.barcode || '—'}</span></div>
            <div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted shrink-0">Trọng lượng</span><span className="font-medium text-foreground text-right">{activeWeight ? Number(activeWeight).toLocaleString('vi-VN') : '—'}</span></div>
            <div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted shrink-0">Nhãn hiệu</span><span className="font-medium text-foreground truncate max-w-[65%] text-right" title={product.brand || ''}>{product.brand || '—'}</span></div>
            <div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted shrink-0">VAT</span><span className="font-medium text-foreground text-right">{product.vat ?? 0}%</span></div>
            <div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted shrink-0">Ca kiểm kho</span><span className="font-medium text-foreground text-right">
              {product.lastCountShift ? (
                <span className="inline-flex rounded-md bg-purple-500/15 border border-purple-500/20 px-2 py-0.5 text-[11px] text-purple-600 dark:text-purple-400">
                  {formatShift(product.lastCountShift)}
                </span>
              ) : '—'}
            </span></div>
          </div>
        </div>

        {/* CỘT PHẢI - PHIÊN BẢN VÀ CHI TIẾT (khoảng 7/10) */}
        <div className="lg:col-span-9 flex flex-col gap-6">
          {/* PHẦN PHIÊN BẢN & QUY ĐỔI MỚI (TRÊN CÙNG BÊN PHẢI) */}
          <div className="card p-0 overflow-hidden border border-border rounded-2xl flex flex-col">
            <div className="p-4 border-b border-border font-semibold flex items-center justify-between text-[13px] tracking-wide uppercase text-foreground-muted bg-background-secondary/50">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-primary-500" /> Phiên bản & Quy đổi
              </div>
              <span className="w-5 h-5 rounded-full bg-background-tertiary border border-border flex items-center justify-center text-xs text-foreground">
                {visualCount}
              </span>
            </div>

            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-foreground-muted mb-2 px-3">
                <span>Tên</span>
                <div className="flex items-center gap-4">
                  {priceBooks.map((pb: any) => (
                    <span key={pb.id} className="w-20 text-right truncate" title={pb.name}>{pb.name}</span>
                  ))}
                </div>
              </div>

              <div className="relative pl-3 border-l-2 border-primary-500">
                <button
                  type="button"
                  onClick={() => setSelectedItemKey(detailTree.rootItem.key)}
                  className={`w-full text-left flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors ${activeItem.key === detailTree.rootItem.key ? 'bg-primary-500/10 ring-1 ring-primary-500/30' : 'hover:bg-background-secondary/60'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-background-tertiary flex items-center justify-center shrink-0 text-primary-500 relative">
                      <Package size={16} />
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full border-2 border-background" />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <div className={`text-sm font-semibold truncate ${activeItem.key === detailTree.rootItem.key ? 'text-primary-500' : 'text-foreground'}`}>
                        {detailTree.rootItem.name}
                      </div>
                      <div className="text-[10px] text-foreground-muted truncate">{detailTree.rootItem.sku || 'SKU N/A'}</div>
                    </div>
                  </div>
                  {priceBooks.length > 0 && (
                    <div className="flex items-center gap-4 shrink-0">
                      {priceBooks.map((pb: any) => {
                        const price = detailTree.rootItem.priceBookPrices?.[pb.id] ?? detailTree.rootItem.price ?? 0
                        return <span key={pb.id} className="w-20 text-right text-sm font-semibold text-primary-500 truncate">{price.toLocaleString('vi-VN')}</span>
                      })}
                    </div>
                  )}
                </button>

                {hasComplexVariants && (
                  <div className="mt-4 flex flex-col gap-3 pl-5 relative">
                    <div className="absolute top-0 bottom-0 left-0 w-px bg-border" />

                    {detailTree.groups.map(({ item, children }) => (
                      <div key={item.key} className="flex flex-col gap-2 relative">
                        <div className="absolute top-4 left-0 w-4 h-px border-t border-border -ml-5" />
                        <button
                          type="button"
                          onClick={() => setSelectedItemKey(item.key)}
                          className={`w-full text-left flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors ${activeItem.key === item.key ? 'bg-primary-500/10 ring-1 ring-primary-500/30' : 'hover:bg-background-secondary/60'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-md bg-background-secondary border border-border flex items-center justify-center text-foreground-muted shrink-0">
                              <Package size={12} />
                            </div>
                            <div className="flex flex-col leading-tight overflow-hidden">
                              <div className={`text-sm font-medium truncate ${activeItem.key === item.key ? 'text-primary-500' : 'text-foreground'}`}>{item.name}</div>
                              <div className="text-[10px] text-foreground-muted mt-0.5 truncate">{item.sku || product.unit || 'Phiên bản'}</div>
                            </div>
                          </div>
                          {priceBooks.length > 0 && (
                            <div className="flex items-center gap-4 shrink-0">
                              {priceBooks.map((pb: any) => {
                                const price = item.priceBookPrices?.[pb.id] ?? item.price ?? 0
                                return <span key={pb.id} className="w-20 text-right text-sm font-semibold text-primary-500 truncate">{price.toLocaleString('vi-VN')}</span>
                              })}
                            </div>
                          )}
                        </button>

                        {children.length > 0 && (
                          <div className="ml-5 flex flex-col gap-2 relative">
                            <div className="absolute top-0 bottom-3 left-0 w-px bg-border" />
                            {children.map((child) => (
                              <div key={child.key} className="relative">
                                <div className="absolute top-4 left-0 w-4 h-px border-t border-border -ml-5" />
                                <button
                                  type="button"
                                  onClick={() => setSelectedItemKey(child.key)}
                                  className={`w-full text-left flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors ${activeItem.key === child.key ? 'bg-primary-500/10 ring-1 ring-primary-500/30' : 'hover:bg-background-secondary/60'}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-md bg-background-secondary border border-border flex items-center justify-center text-foreground-muted shrink-0">
                                      <RefreshCw size={12} />
                                    </div>
                                    <div className="flex flex-col leading-tight overflow-hidden">
                                      <div className={`text-sm font-medium truncate ${activeItem.key === child.key ? 'text-primary-500' : 'text-foreground'}`}>{child.name}</div>
                                      <div className="text-[10px] text-foreground-muted mt-0.5 truncate">{(child.sku ? child.sku + ' • ' : '') + (child.formula || 'Quy đổi')}</div>
                                    </div>
                                  </div>
                                  {priceBooks.length > 0 && (
                                    <div className="flex items-center gap-4 shrink-0">
                                      {priceBooks.map((pb: any) => {
                                        const price = child.priceBookPrices?.[pb.id] ?? child.price ?? 0
                                        return <span key={pb.id} className="w-20 text-right text-sm font-semibold text-primary-500 truncate">{price.toLocaleString('vi-VN')}</span>
                                      })}
                                    </div>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {detailTree.looseConversions.map((item) => (
                      <div key={item.key} className="relative">
                        <div className="absolute top-4 left-0 w-4 h-px border-t border-border -ml-5" />
                        <button
                          type="button"
                          onClick={() => setSelectedItemKey(item.key)}
                          className={`w-full text-left flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors ${activeItem.key === item.key ? 'bg-primary-500/10 ring-1 ring-primary-500/30' : 'hover:bg-background-secondary/60'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-md bg-background-secondary border border-border flex items-center justify-center text-foreground-muted shrink-0">
                              <RefreshCw size={12} />
                            </div>
                            <div className="flex flex-col leading-tight overflow-hidden">
                              <div className={`text-sm font-medium truncate ${activeItem.key === item.key ? 'text-primary-500' : 'text-foreground'}`}>{item.name}</div>
                              <div className="text-[10px] text-foreground-muted mt-0.5 truncate">{item.formula || item.sku || 'Quy đổi'}</div>
                            </div>
                          </div>
                          {priceBooks.length > 0 && (
                            <div className="flex items-center gap-4 shrink-0">
                              {priceBooks.map((pb: any) => {
                                const price = item.priceBookPrices?.[pb.id] ?? item.price ?? 0
                                return <span key={pb.id} className="w-20 text-right text-sm font-semibold text-primary-500 truncate">{price.toLocaleString('vi-VN')}</span>
                              })}
                            </div>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PHẦN CHI TIẾT TỒN KHO/LỊCH SỬ (DƯỚI CÙNG BÊN PHẢI) */}
          <div className="card overflow-hidden border border-border rounded-2xl flex flex-col flex-1">
            <div className="flex items-center justify-between border-b border-border bg-background-secondary/50 px-2 pt-2">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`px-5 py-3 text-[13px] font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'inventory' ? 'border-primary-500 text-primary-500' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
                >
                  <Package size={15} /> Tồn kho
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-5 py-3 text-[13px] font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'history' ? 'border-primary-500 text-primary-500' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
                >
                  <History size={15} /> Lịch sử
                </button>
              </div>

              <div className="pr-4 py-2 flex items-center gap-2 max-w-[50%]">
                <span className="text-[11px] font-bold uppercase text-foreground-muted tracking-wider bg-background-tertiary px-2 py-1 rounded-md border border-border shrink-0">
                  {activeItemLabel}
                </span>
                <div className="h-8 px-3 flex items-center rounded-md bg-background shadow-xs border border-transparent text-sm font-medium truncate" title={activeItem.name}>
                  {activeItem.name}
                </div>
              </div>
            </div>

            <div className="w-full flex-1 overflow-auto min-h-[300px]">
              {activeTab === 'inventory' && (
                <table className="data-table">
                  <thead className="sticky top-0 z-10 bg-background">
                    <tr>
                      <th className="py-3 px-4 text-[11px]">CHI NHÁNH</th>
                      <th className="py-3 px-4 text-[11px] text-right">TỒN KHO</th>
                      <th className="py-3 px-4 text-[11px] text-right">CÓ THỂ BÁN</th>
                      <th className="py-3 px-4 text-[11px] text-right">ĐANG GIAO DỊCH</th>
                      <th className="py-3 px-4 text-[11px] text-right">ĐANG VỀ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStockRows.length > 0 ? (
                      activeStockRows.map((row, index) => {
                        const stock = row.stock ?? 0
                        const reservedStock = row.reservedStock ?? 0
                        const sellable = Math.max(0, stock - reservedStock)
                        const incoming = getIncomingStock(row)

                        return (
                          <tr key={row.id ?? `${activeItem.key}-${index}`}>
                            <td className="py-3 px-4 font-semibold text-sm">{row.branch?.name || `Chi nhánh ${index + 1}`}</td>
                            <td className="py-3 px-4 text-right font-semibold text-error">{stock}</td>
                            <td className="py-3 px-4 text-right text-sm">{sellable}</td>
                            <td className="py-3 px-4 text-right text-sm">
                              {reservedStock > 0 ? (
                                <Link
                                  href={`/orders?productId=${productId}&status=PROCESSING`}
                                  className="font-semibold text-amber-500 hover:underline"
                                  title="Xem đơn hàng đang xử lý có chứa sản phẩm này"
                                >
                                  {reservedStock}
                                </Link>
                              ) : (
                                <span className="text-foreground-muted">0</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right text-sm">
                              {incoming > 0 ? (
                                <Link
                                  href={`/inventory/receipts?productId=${productId}`}
                                  className="font-semibold text-sky-500 hover:underline"
                                  title="Xem phiếu nhập đang chờ hàng về có chứa sản phẩm này"
                                >
                                  {incoming}
                                </Link>
                              ) : (
                                <span className="text-foreground-muted">0</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-foreground-muted">
                          Chưa có dữ liệu tồn kho cho mục đang chọn
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'history' && <ProductHistoryTab productId={productId} />}
            </div>
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <ProductFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialData={product}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['product-detail', productId] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
          }}
        />
      )}

      {isCopyModalOpen && (
        <ProductFormModal
          isOpen={isCopyModalOpen}
          onClose={() => setIsCopyModalOpen(false)}
          initialData={{
            ...product,
            id: undefined,
            name: `${product.name} (bản sao)`,
            sku: '',
            barcode: '',
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            setIsCopyModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

function resolveTransactionLink(tx: { referenceId?: string | null; referenceType?: string | null }) {
  if (!tx.referenceId) return null
  switch (tx.referenceType) {
    case 'STOCK_RECEIPT':
      return `/inventory/receipts/${tx.referenceId}`
    case 'SUPPLIER_RETURN':
      return `/inventory/receipts` // supplier return không có route riêng, dẫn về danh sách
    case 'ORDER':
      return `/orders/${tx.referenceId}`
    default:
      return null
  }
}

function ProductHistoryTab({ productId }: { productId: string }) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')

  const { data: branchesRes } = useQuery({
    queryKey: ['branches-list'],
    queryFn: () => settingsApi.getBranches(),
    staleTime: 5 * 60 * 1000,
  })

  const branches = branchesRes ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['product-history', productId, selectedBranchId],
    queryFn: () => inventoryApi.getProductTransactions(productId, {
      branchId: selectedBranchId || undefined,
    }),
  })

  const txs: any[] = data?.data ?? []

  const typeLabel = (type: string) => type === 'IN' ? 'Nhập kho' : 'Xuất kho'

  return (
    <div className="flex flex-col h-full">
      {/* Header bar with branch selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background">
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <History className="h-4 w-4" />
          <span className="font-medium text-foreground">
            {txs.length > 0 ? `${txs.length} giao dịch` : 'Lịch sử xuất nhập'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-foreground-muted whitespace-nowrap">Chi nhánh:</label>
          <select
            id="history-branch-select"
            className="h-8 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[150px]"
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
          >
            <option value="">Tất cả chi nhánh</option>
            {branches.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-foreground-muted">Đang tải lịch sử...</div>
        ) : txs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-foreground-muted">
            <History className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {selectedBranchId
                ? `Chưa có giao dịch nào tại ${branches.find((b: any) => b.id === selectedBranchId)?.name ?? 'chi nhánh này'}`
                : 'Chưa có lịch sử giao dịch'}
            </p>
            {selectedBranchId && (
              <button
                onClick={() => setSelectedBranchId('')}
                className="text-xs text-primary hover:underline"
              >
                Xem tất cả chi nhánh
              </button>
            )}
          </div>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="py-3 px-4 text-[11px] whitespace-nowrap">THỜI GIAN</th>
                <th className="py-3 px-4 text-[11px] whitespace-nowrap">NHÂN VIÊN</th>
                <th className="py-3 px-4 text-[11px] whitespace-nowrap">CHI NHÁNH</th>
                <th className="py-3 px-4 text-[11px] whitespace-nowrap">HÀNH ĐỘNG</th>
                <th className="py-3 px-4 text-[11px] text-right whitespace-nowrap">SL THAY ĐỔI</th>
                <th className="py-3 px-4 text-[11px] whitespace-nowrap">LOẠI</th>
                <th className="py-3 px-4 text-[11px] whitespace-nowrap">MÃ CHỨNG TỪ</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((tx: any) => {
                const txLink = resolveTransactionLink(tx)
                return (
                  <tr key={tx.id} className="hover:bg-surface/50 transition-colors">
                    <td className="py-3 px-4 text-sm text-foreground-muted whitespace-nowrap">
                      {dayjs(tx.createdAt).format('DD/MM/YYYY HH:mm')}
                    </td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">
                      {tx.staff?.fullName ?? <span className="text-foreground-muted">—</span>}
                    </td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">
                      {tx.branch?.name ?? <span className="text-foreground-muted">—</span>}
                    </td>
                    <td className="py-3 px-4 text-sm max-w-[180px] truncate">
                      {tx.reason ?? <span className="text-foreground-muted">—</span>}
                    </td>
                    <td className={`py-3 px-4 text-right font-bold text-base tabular-nums ${tx.type === 'IN' ? 'text-success' : 'text-error'}`}>
                      {tx.type === 'IN' ? '+' : '−'}{tx.quantity}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap
                        ${tx.type === 'IN'
                          ? 'bg-success/10 text-success'
                          : 'bg-error/10 text-error'}`}>
                        {typeLabel(tx.type)}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {tx.referenceId ? (
                        txLink ? (
                          <Link
                            href={txLink}
                            target="_blank"
                            className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline hover:text-primary/80 transition-colors"
                          >
                            {tx.referenceId}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-foreground-muted">{tx.referenceId}</span>
                        )
                      ) : (
                        <span className="text-foreground-muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

