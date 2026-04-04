'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Box, Copy, History, Layers, Package, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { inventoryApi } from '@/lib/api/inventory.api'
import { ProductFormModal } from '../../_components/product-form-modal'
import { settingsApi } from '@/lib/api'

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
  displayUnit?: string | null
  conversionRate?: number | null
  formula?: string | null
  branchStocks: BranchStockRow[]
}

function parseConversionRate(raw?: string | null) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    const value = Number(parsed?.rate ?? parsed?.conversionRate ?? parsed?.mainQty)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function getTrailingLabel(name: string, baseName: string) {
  if (!name) return ''
  if (baseName && name.startsWith(`${baseName} - `)) {
    return name.slice(baseName.length + 3)
  }

  const segments = name.split(' - ').filter(Boolean)
  return segments[segments.length - 1] ?? name
}

function getIncomingStock(row: BranchStockRow) {
  const value = Number(row.incomingStock ?? row.incoming ?? row.onTheWay ?? 0)
  return Number.isFinite(value) ? value : 0
}

function normalizeBranchStocks(rows: BranchStockRow[] | undefined) {
  return Array.isArray(rows) ? rows : []
}

function aggregateBranchStocks(rows: BranchStockRow[]) {
  const grouped = new Map<string, BranchStockRow>()

  rows.forEach((row, index) => {
    const key = row.branch?.id ?? row.branchId ?? row.branch?.name ?? row.id ?? `branch-${index}`
    const existing = grouped.get(key)

    if (existing) {
      existing.stock = (existing.stock ?? 0) + (row.stock ?? 0)
      existing.reservedStock = (existing.reservedStock ?? 0) + (row.reservedStock ?? 0)
      existing.minStock = (existing.minStock ?? 0) + (row.minStock ?? 0)
      existing.incomingStock = (existing.incomingStock ?? 0) + getIncomingStock(row)
      return
    }

    grouped.set(key, {
      ...row,
      id: row.id ?? key,
      stock: row.stock ?? 0,
      reservedStock: row.reservedStock ?? 0,
      minStock: row.minStock ?? 0,
      incomingStock: getIncomingStock(row),
    })
  })

  return Array.from(grouped.values())
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
  const productBranchStocks = normalizeBranchStocks(product.branchStocks)
  const rootBranchStocks = productBranchStocks.filter((row) => !row.productVariantId)
  const rawVariants = Array.isArray(product.variants) ? product.variants : []

  const detailItems: DetailItem[] = rawVariants.map((variant: any) => {
    const conversionRate = parseConversionRate(variant.conversions)
    const branchStocks = normalizeBranchStocks(
      variant.branchStocks?.length
        ? variant.branchStocks
        : productBranchStocks.filter((row) => row.productVariantId === variant.id),
    )
    const displayUnit = conversionRate ? getTrailingLabel(variant.name, product.name) : product.unit
    const formula = conversionRate ? `${conversionRate} ${product.unit} = 1 ${displayUnit}` : null

    return {
      key: `variant:${variant.id}`,
      id: variant.id,
      kind: conversionRate ? 'conversion' : 'variant',
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      image: variant.image ?? product.image,
      price: variant.price ?? product.price,
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
    displayUnit: product.unit,
    conversionRate: null,
    formula: null,
    branchStocks: rootBranchStocks.length > 0 ? rootBranchStocks : aggregateBranchStocks(productBranchStocks),
  } satisfies DetailItem

  const variantItems: DetailItem[] = detailItems.filter((item: DetailItem) => item.kind === 'variant')
  const conversionItems: DetailItem[] = detailItems.filter((item: DetailItem) => item.kind === 'conversion')
  const assignedConversions = new Set<string>()

  const groups: Array<{ item: DetailItem; children: DetailItem[] }> = variantItems.map((item: DetailItem) => {
    const children = conversionItems.filter((child: DetailItem) => child.name.startsWith(`${item.name} - `))
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
  const { data, isLoading } = useQuery({
    queryKey: ['product-detail', productId],
    queryFn: () => inventoryApi.getProduct(productId),
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
          <button
            onClick={() => setIsCopyModalOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary text-foreground-muted transition-colors"
            title="Tạo bản sao sản phẩm này"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="h-9 px-4 flex items-center gap-2 rounded-lg border border-border bg-primary-500 text-white hover:bg-primary-600 transition-colors"
          >
            <Pencil size={15} /> <span className="text-sm font-medium">Sửa thông tin</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-error/30 bg-error/10 hover:bg-error/20 text-error transition-colors disabled:opacity-50"
            title="Xoá sản phẩm"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="card p-6 border border-border rounded-2xl flex flex-col md:flex-row gap-8 bg-background-secondary/30">
        <div className="flex gap-6 min-w-[300px]">
          <div className="w-24 h-24 rounded-xl border border-border bg-background-tertiary flex items-center justify-center overflow-hidden flex-shrink-0">
            {activeItem.image ? (
              <img src={activeItem.image} alt={activeItem.name} className="w-full h-full object-cover" />
            ) : (
              <Box size={32} className="text-foreground-muted/50" />
            )}
          </div>
          <div className="flex flex-col justify-center gap-2">
            <h1 className="text-xl font-bold flex items-center gap-3">
              {activeItem.name}
              {product.isActive !== false && (
                <span className="badge badge-success text-[10px] px-2 py-0.5 rounded-full uppercase">Đang bán</span>
              )}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-primary-500 font-semibold">{(activeItem.price ?? 0).toLocaleString('vi-VN')}₫</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted px-2 py-1 rounded-md border border-border bg-background-tertiary">
                {activeItemLabel}
              </span>
            </div>
            {activeItem.formula && <div className="text-xs text-foreground-muted">{activeItem.formula}</div>}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm items-start border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8">
          <div className="flex flex-col gap-4">
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">Mã SP</div><div className="font-medium">{product.productCode || '—'}</div></div>
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">Phân loại</div><div className="font-medium">{product.category || '—'}</div></div>
          </div>
          <div className="flex flex-col gap-4">
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">SKU</div><div className="font-medium">{activeItem.sku || product.sku || '—'}</div></div>
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">Đơn vị</div><div className="font-medium">{activeUnit}</div></div>
          </div>
          <div className="flex flex-col gap-4">
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">Barcode</div><div className="font-medium">{activeItem.barcode || product.barcode || '—'}</div></div>
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">Trọng lượng</div><div className="font-medium">{activeWeight ?? '—'}</div></div>
          </div>
          <div className="flex flex-col gap-4">
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">Nhãn hiệu</div><div className="font-medium">{product.brand || '—'}</div></div>
            <div><div className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted mb-1">VAT</div><div className="font-medium">{product.vat ?? 0}%</div></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 card p-0 overflow-hidden border border-border rounded-2xl flex flex-col self-stretch">
          <div className="p-4 border-b border-border font-semibold flex items-center justify-between text-[13px] tracking-wide uppercase text-foreground-muted bg-background-secondary/50">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-primary-500" /> Phiên bản & Quy đổi
            </div>
            <span className="w-5 h-5 rounded-full bg-background-tertiary border border-border flex items-center justify-center text-xs text-foreground">
              {detailTree.count}
            </span>
          </div>

          <div className="p-4 flex flex-col gap-4 overflow-y-auto">
            <div className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted mb-2">Tên</div>

            <div className="relative pl-3 border-l-2 border-primary-500">
              <button
                type="button"
                onClick={() => setSelectedItemKey(detailTree.rootItem.key)}
                className={`w-full text-left flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${activeItem.key === detailTree.rootItem.key ? 'bg-primary-500/10 ring-1 ring-primary-500/30' : 'hover:bg-background-secondary/60'}`}
              >
                <div className="w-8 h-8 rounded-lg bg-background-tertiary flex items-center justify-center flex-shrink-0 text-primary-500 relative">
                  <Package size={16} />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full border-2 border-background" />
                </div>
                <div className="flex flex-col">
                  <div className={`text-sm font-semibold ${activeItem.key === detailTree.rootItem.key ? 'text-primary-500' : 'text-foreground'}`}>
                    {detailTree.rootItem.name}
                  </div>
                  <div className="text-[10px] text-foreground-muted">{detailTree.rootItem.sku || 'SKU N/A'}</div>
                </div>
              </button>

              {(detailTree.groups.length > 0 || detailTree.looseConversions.length > 0) && (
                <div className="mt-4 flex flex-col gap-3 pl-5 relative">
                  <div className="absolute top-0 bottom-0 left-0 w-px bg-border" />

                  {detailTree.groups.map(({ item, children }) => (
                    <div key={item.key} className="flex flex-col gap-2 relative">
                      <div className="absolute top-4 left-0 w-4 h-px border-t border-border -ml-5" />
                      <button
                        type="button"
                        onClick={() => setSelectedItemKey(item.key)}
                        className={`w-full text-left flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${activeItem.key === item.key ? 'bg-primary-500/10 ring-1 ring-primary-500/30' : 'hover:bg-background-secondary/60'}`}
                      >
                        <div className="w-7 h-7 rounded-md bg-background-secondary border border-border flex items-center justify-center text-foreground-muted">
                          <Package size={12} />
                        </div>
                        <div className="flex flex-col leading-tight">
                          <div className={`text-sm font-medium ${activeItem.key === item.key ? 'text-primary-500' : 'text-foreground'}`}>{item.name}</div>
                          <div className="text-[10px] text-foreground-muted mt-0.5">{item.sku || product.unit || 'Phiên bản'}</div>
                        </div>
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
                                className={`w-full text-left flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${activeItem.key === child.key ? 'bg-primary-500/10 ring-1 ring-primary-500/30' : 'hover:bg-background-secondary/60'}`}
                              >
                                <div className="w-7 h-7 rounded-md bg-background-secondary border border-border flex items-center justify-center text-foreground-muted">
                                  <RefreshCw size={12} />
                                </div>
                                <div className="flex flex-col leading-tight">
                                  <div className={`text-sm font-medium ${activeItem.key === child.key ? 'text-primary-500' : 'text-foreground'}`}>{child.name}</div>
                                  <div className="text-[10px] text-foreground-muted mt-0.5">{child.formula || child.sku || 'Quy đổi'}</div>
                                </div>
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
                        className={`w-full text-left flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${activeItem.key === item.key ? 'bg-primary-500/10 ring-1 ring-primary-500/30' : 'hover:bg-background-secondary/60'}`}
                      >
                        <div className="w-7 h-7 rounded-md bg-background-secondary border border-border flex items-center justify-center text-foreground-muted">
                          <RefreshCw size={12} />
                        </div>
                        <div className="flex flex-col leading-tight">
                          <div className={`text-sm font-medium ${activeItem.key === item.key ? 'text-primary-500' : 'text-foreground'}`}>{item.name}</div>
                          <div className="text-[10px] text-foreground-muted mt-0.5">{item.formula || item.sku || 'Quy đổi'}</div>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 card overflow-hidden border border-border rounded-2xl flex flex-col self-stretch">
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

            <div className="pr-4 py-2 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-foreground-muted tracking-wider bg-background-tertiary px-2 py-1 rounded-md border border-border">
                {activeItemLabel}
              </span>
              <div className="h-8 min-w-[220px] px-3 flex items-center rounded-md bg-background shadow-xs border border-transparent text-sm font-medium">
                {activeItem.name}
              </div>
            </div>
          </div>

          <div className="w-full flex-1 overflow-x-auto">
            {activeTab === 'inventory' && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="py-3 px-4 text-[11px]">CHI NHÁNH</th>
                    <th className="py-3 px-4 text-[11px] text-right">TỒN KHO</th>
                    <th className="py-3 px-4 text-[11px] text-right">CÓ THỂ BÁN</th>
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
                          <td className="py-3 px-4 text-right text-sm">{incoming}</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-foreground-muted">
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
            productCode: '',
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

function ProductHistoryTab({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-history', productId],
    queryFn: () => inventoryApi.getProductTransactions(productId),
  })

  if (isLoading) return <div className="p-8 text-center text-sm text-foreground-muted">Đang tải lịch sử...</div>

  const txs = data?.data || []

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th className="py-3 px-4 text-[11px]">THỜI GIAN</th>
          <th className="py-3 px-4 text-[11px]">HÀNH ĐỘNG</th>
          <th className="py-3 px-4 text-[11px] text-right">SỐ LƯỢNG</th>
          <th className="py-3 px-4 text-[11px]">LOẠI</th>
        </tr>
      </thead>
      <tbody>
        {txs.length === 0 ? (
          <tr>
            <td colSpan={4} className="py-8 text-center text-sm text-foreground-muted">Chưa có lịch sử giao dịch</td>
          </tr>
        ) : (
          txs.map((tx: any) => (
            <tr key={tx.id}>
              <td className="py-3 px-4 text-sm text-foreground-muted">{dayjs(tx.createdAt).format('DD/MM/YYYY HH:mm')}</td>
              <td className="py-3 px-4 text-sm max-w-[200px] truncate">{tx.reason || '—'}</td>
              <td className={`py-3 px-4 text-right font-semibold ${tx.type === 'IN' ? 'text-success' : 'text-error'}`}>
                {tx.type === 'IN' ? '+' : '-'}
                {tx.quantity}
              </td>
              <td className="py-3 px-4">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tx.type === 'IN' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                  {tx.type === 'IN' ? 'Nhập kho' : 'Xuất kho'}
                </span>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
