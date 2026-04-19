'use client'
import Image from 'next/image';

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  ChevronDown,
  CornerDownRight,
  ImagePlus,
  PackageCheck,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { inventoryApi } from '@/lib/api/inventory.api'
import { getDisplayBranchStocks, getResolvedVariantLabels, groupVariantsWithConversions, parseConversionRate } from '@/lib/inventory-conversion-stock'
import { toast } from 'sonner'
import { ProductFormModal } from './product-form-modal'
import { useAuthorization } from '@/hooks/useAuthorization'
import {

  DataListShell,
  DataListToolbar,
  DataListFilterPanel,
  DataListColumnPanel,
  DataListTable,
  DataListBulkBar,
  DataListPagination,
  TableCheckbox,
  toolbarSelectClass,
  filterSelectClass,
  filterInputClass,
  useDataListCore,
  useDataListSelection,
} from '@petshop/ui/data-list'

type BranchStockRow = {
  stock?: number | null
  reservedStock?: number | null
  minStock?: number | null
}

type ListVariantItem = {
  id: string
  kind: 'variant' | 'conversion'
  name: string
  sku?: string | null
  barcode?: string | null
  image?: string | null
  unit?: string | null
  price?: number | null
  costPrice?: number | null
  formula?: string | null
  branchStocks: BranchStockRow[]
}

type VariantGroup = {
  item: ListVariantItem
  children: ListVariantItem[]
}

type DisplayColumnId = 'image' | 'product' | 'sku' | 'barcode' | 'category' | 'stock' | 'price' | 'status' | 'lastCountShift'
type SaleStatusFilter = 'all' | 'active' | 'inactive'
type SystemStatusFilter = 'ACTIVE' | 'DELETED'
type StockStatusFilter = 'all' | 'in_stock' | 'out_of_stock' | 'low_stock'
type PinFilterId = 'category' | 'stock' | 'sale'
type SortDirection = 'asc' | 'desc'
type BulkEditableField = 'image' | 'category' | 'unit' | 'brand' | 'price' | 'costPrice' | 'minStock' | 'lastCountShift'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string }> = [
  { id: 'image', label: 'Ảnh', width: 'w-20' },
  { id: 'product', label: 'Sản phẩm', sortable: true, minWidth: 'min-w-[300px]' },
  { id: 'sku', label: 'SKU', sortable: true, minWidth: 'min-w-[140px]' },
  { id: 'barcode', label: 'Mã vạch', sortable: true, minWidth: 'min-w-[140px]' },
  { id: 'category', label: 'Danh mục', sortable: true, minWidth: 'min-w-[140px]' },
  { id: 'stock', label: 'Tồn kho', sortable: true, minWidth: 'min-w-[140px]' },
  { id: 'price', label: 'Giá vốn / Giá bán', sortable: true, minWidth: 'min-w-[140px]' },
  { id: 'status', label: 'Trạng thái', sortable: true, minWidth: 'min-w-[140px]' },
  { id: 'lastCountShift', label: 'Ca kiểm', sortable: true, minWidth: 'min-w-[100px]' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(['product', 'sku', 'barcode', 'category', 'stock', 'price', 'status', 'lastCountShift'])

function sumStock(rows: BranchStockRow[] | undefined, fallback = 0) {
  if (!rows || rows.length === 0) return fallback
  return rows.reduce((total, row) => total + (row.stock ?? 0), 0)
}

function sumReservedStock(rows: BranchStockRow[] | undefined) {
  if (!rows || rows.length === 0) return 0
  return rows.reduce((total, row) => total + (row.reservedStock ?? 0), 0)
}

function sumMinStock(rows: BranchStockRow[] | undefined, fallback = 0) {
  if (!rows || rows.length === 0) return fallback
  return rows.reduce((total, row) => total + (row.minStock ?? 0), 0)
}

function formatMoney(value?: number | null) {
  return `${(value ?? 0).toLocaleString('vi-VN')}₫`
}

function buildVariantGroups(product: any) {
  const rawVariants = Array.isArray(product.variants) ? product.variants : []
  const items: ListVariantItem[] = rawVariants.map((variant: any) => {
    const conversionRate = parseConversionRate(variant.conversions)
    const { variantLabel, unitLabel } = getResolvedVariantLabels(product.name, variant)
    const displayUnit = conversionRate ? unitLabel || variant.unit || product.unit : variantLabel || variant.unit || product.unit

    return {
      id: variant.id,
      kind: conversionRate ? 'conversion' : 'variant',
      name: variantLabel || variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      image: variant.image ?? product.image,
      unit: displayUnit,
      price: variant.price ?? product.price,
      costPrice: variant.costPrice ?? product.costPrice,
      formula: conversionRate ? `${conversionRate} ${product.unit} = 1 ${displayUnit}` : null,
      branchStocks: getDisplayBranchStocks(product, variant.id) as BranchStockRow[],
    }
  })

  const itemMap = new Map<string, ListVariantItem>(items.map((item) => [item.id, item]))
  const grouped = groupVariantsWithConversions(rawVariants, product.name)
  const groups: VariantGroup[] = grouped.groups.map(({ item, children }) => ({
    item: itemMap.get(item.id)!,
    children: children.map((child) => itemMap.get(child.id)).filter((child): child is ListVariantItem => Boolean(child)),
  }))

  return {
    groups,
    looseConversions: grouped.looseConversions
      .map((item) => itemMap.get(item.id))
      .filter((item): item is ListVariantItem => Boolean(item)),
    totalChildren: grouped.totalItems,
  }
}

function reorderList<T>(items: T[], source: T, target: T) {
  const sourceIndex = items.indexOf(source)
  const targetIndex = items.indexOf(target)
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return items
  const next = [...items]
  next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, source)
  return next
}

function compareText(left?: string | null, right?: string | null) {
  return `${left ?? ''}`.localeCompare(`${right ?? ''}`, 'vi', { sensitivity: 'base' })
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(reader.result?.toString() || ''))
    reader.addEventListener('error', () => reject(new Error('Không thể đọc file ảnh')))
    reader.readAsDataURL(file)
  })

function ImageCell({ image, size = 'md' }: { image?: string | null; size?: 'md' | 'sm' }) {
  const dimensions = size === 'sm' ? 'w-8 h-8 rounded-md' : 'w-10 h-10 rounded-lg'
  return image ? (
    <div className={`${dimensions} overflow-hidden flex-shrink-0 bg-background-secondary border border-border`}>
      <Image src={image} alt="" className="w-full h-full object-cover" width={400} height={400} unoptimized />
    </div>
  ) : (
    <div className={`${dimensions} flex items-center justify-center bg-background-secondary border border-border text-foreground-muted`}>
      <PackageCheck size={size === 'sm' ? 14 : 18} />
    </div>
  )
}

// TableCheckbox is now from '@/components/data-list'

function NameCell({
  name,
  href,
  meta,
  toggle,
  prefix,
  tone = 'product',
}: {
  name: string
  href?: string
  meta?: string | null
  toggle?: ReactNode
  prefix?: ReactNode
  tone?: 'product' | 'variant' | 'conversion'
}) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="w-4 flex-shrink-0 pt-1">{toggle}</div>
      <div className="flex items-start gap-2 min-w-0 flex-1">
        {prefix}
        <div className="min-w-0 flex-1">
          {href ? (
            <Link href={href} title={name} className="block truncate font-semibold text-foreground transition-colors hover:text-primary-500">
              {name}
            </Link>
          ) : (
            <div title={name} className={`truncate ${tone === 'product' ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
              {name}
            </div>
          )}
          {meta ? <div className="sr-only">{meta}</div> : null}
        </div>
      </div>
    </div>
  )
}

export function ProductList() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: isAuthLoading } = useAuthorization()
  const canReadProducts = hasPermission('product.read')
  const canCreateProduct = hasPermission('product.create')
  const canUpdateProduct = hasPermission('product.update')
  const canDeleteProduct = hasPermission('product.delete')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [saleStatus, setSaleStatus] = useState<SaleStatusFilter>('all')
  const [brandQuery, setBrandQuery] = useState('')
  const [stockStatus, setStockStatus] = useState<StockStatusFilter>('all')
  const [systemStatus, setSystemStatus] = useState<SystemStatusFilter>('ACTIVE')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set())

  // Reset page when any filter changes
  useEffect(() => {
    setPage(1)
  }, [search, category, saleStatus, brandQuery, stockStatus, systemStatus])

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialTopFilterVisibility: { category: true, stock: false, sale: true },
    storageKey: 'product-list-columns-v2',
  })
  const { topFilterVisibility, columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  useEffect(() => {
    if (isAuthLoading) return
    if (!canReadProducts) {
      router.replace('/dashboard')
    }
  }, [canReadProducts, isAuthLoading, router])

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, category, systemStatus, page, pageSize],
    queryFn: () =>
      inventoryApi.getProducts({
        search: search || undefined,
        category: category || undefined,
        status: systemStatus,
        page,
        limit: pageSize,
      }),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => inventoryApi.getCategories(),
  })

  const rawProducts = (data as any)?.data ?? []
  const total = (data as any)?.total ?? 0
  const totalPages = (data as any)?.totalPages ?? 1

  const categoryOptions = Array.isArray(categories) ? categories : (categories as any)?.data ?? []

  const filteredProducts = useMemo(() => {
    return rawProducts.filter((product: any) => {
      const productBrand = `${product.brand ?? ''}`.toLowerCase()
      const active = Boolean(product.isActive ?? true)

      const productBranchStocks = getDisplayBranchStocks(product) as BranchStockRow[]
      const totalStock = sumStock(productBranchStocks, Number(product.stock ?? 0))
      const minStock = sumMinStock(productBranchStocks, Number(product.minStock ?? 0))

      const matchesBrand = !brandQuery || productBrand.includes(brandQuery.trim().toLowerCase())
      const matchesSaleStatus = saleStatus === 'all' || (saleStatus === 'active' ? active : !active)
      const matchesStockStatus =
        stockStatus === 'all' ||
        (stockStatus === 'in_stock' && totalStock > 0) ||
        (stockStatus === 'out_of_stock' && totalStock <= 0) ||
        (stockStatus === 'low_stock' && totalStock > 0 && totalStock <= minStock)

      return matchesBrand && matchesSaleStatus && matchesStockStatus
    })
  }, [brandQuery, rawProducts, saleStatus, stockStatus])

  const productRows = useMemo(() => {
    const rows = filteredProducts.map((product: any) => {
      const { groups, looseConversions, totalChildren } = buildVariantGroups(product)
      const productStocks = getDisplayBranchStocks(product) as BranchStockRow[]
      const hasVariants = totalChildren > 0
      const totalStock = sumStock(productStocks, Number(product.stock ?? 0))
      const sellableStock = Math.max(totalStock - sumReservedStock(productStocks), 0)
      const minStock = sumMinStock(productStocks, Number(product.minStock ?? 0))

      return {
        ...product,
        groups,
        looseConversions,
        hasChildren: hasVariants,
        isExpandable: totalChildren > 1,
        totalStock,
        sellableStock,
        minStock,
      }
    })

    if (!columnSort.columnId || !columnSort.direction) return rows

    const directionFactor = columnSort.direction === 'asc' ? 1 : -1

    return [...rows].sort((left: any, right: any) => {
      let comparison = 0

      switch (columnSort.columnId) {
        case 'product':
          comparison = compareText(left.name, right.name)
          break
        case 'sku':
          comparison = compareText(left.sku, right.sku)
          break
        case 'barcode':
          comparison = compareText(left.barcode, right.barcode)
          break
        case 'category':
          comparison = compareText(left.category, right.category)
          break
        case 'stock':
          comparison = left.totalStock - right.totalStock
          break
        case 'price':
          comparison = Number(left.price ?? 0) - Number(right.price ?? 0)
          break
        case 'status':
          comparison = Number(Boolean(left.isActive ?? true)) - Number(Boolean(right.isActive ?? true))
          break
        case 'lastCountShift':
          comparison = compareText(left.lastCountShift, right.lastCountShift)
          break
        default:
          comparison = 0
      }

      if (comparison === 0) comparison = compareText(left.name, right.name)
      return comparison * directionFactor
    })
  }, [columnSort, filteredProducts])

  const visibleProductRowIds = useMemo(
    () => productRows.map((product: any) => `product:${product.id}`),
    [productRows]
  )

  const {
    selectedRowIds,
    toggleRowSelection,
    toggleSelectAllVisible,
    clearSelection,
    allVisibleSelected,
  } = useDataListSelection(visibleProductRowIds)

  const selectedProductIds = useMemo(() => {
    return Array.from(selectedRowIds)
      .filter((id) => id.startsWith('product:'))
      .map((id) => id.replace('product:', ''))
  }, [selectedRowIds])

  const bulkDeleteMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      await Promise.all(productIds.map((productId) => inventoryApi.deleteProduct(productId)))
    },
    onSuccess: () => {
      toast.success('Đã xóa các sản phẩm đã chọn')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      clearSelection()
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || ''
      if (msg.includes('P2003')) {
        toast.error('Không thể xoá vì sản phẩm đã phát sinh dữ liệu (đơn hàng, nhập kho...)')
      } else {
        toast.error(msg || 'Không thể xóa một hoặc nhiều sản phẩm đã chọn')
      }
    },
  })

  const toggleExpanded = (productId: string) => {
    setExpandedProductIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const toggleColumnSort = (columnId: DisplayColumnId) => {
    if (!SORTABLE_COLUMNS.has(columnId)) return
    dataListState.toggleColumnSort(columnId)
  }

  const clearFilters = () => {
    setCategory('')
    setBrandQuery('')
    setStockStatus('all')
    setSaleStatus('all')
    setSystemStatus('ACTIVE')
    setPage(1)
  }

  const visibleRangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const visibleRangeEnd = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + rawProducts.length)

  // Computed columns for DataListTable
  const tableColumns = orderedVisibleColumns.map((columnId) => {
    const col = COLUMN_OPTIONS.find((item) => item.id === columnId)!
    return { ...col, id: columnId as DisplayColumnId }
  })

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Dang kiem tra quyen truy cap...</div>
  }

  if (!canReadProducts) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Dang chuyen huong...</div>
  }

  return (
    <DataListShell>
      {/* ── Toolbar ─────────────────────────────────────── */}
      <DataListToolbar
        searchValue={search}
        onSearchChange={(value) => { setSearch(value); setPage(1) }}
        searchPlaceholder="Tìm kiếm sản phẩm..."
        filterSlot={
          <>
            {topFilterVisibility.category && (
              <select
                value={category}
                onChange={(event) => { setCategory(event.target.value); setPage(1) }}
                className={`${toolbarSelectClass} min-w-[140px]`}
              >
                <option value="">Danh mục</option>
                {categoryOptions.map((item: any) => {
                  const value = typeof item === 'string' ? item : item?.name ?? item?.value ?? ''
                  if (!value) return null
                  return <option key={value} value={value}>{value}</option>
                })}
              </select>
            )}

            {topFilterVisibility.sale && (
              <select
                value={saleStatus}
                onChange={(event) => { setSaleStatus(event.target.value as SaleStatusFilter); setPage(1) }}
                className={`${toolbarSelectClass} min-w-[128px]`}
              >
                <option value="all">Trạng thái</option>
                <option value="active">Đang bán</option>
                <option value="inactive">Ngưng bán</option>
              </select>
            )}

            {topFilterVisibility.stock && (
              <select
                value={stockStatus}
                onChange={(event) => { setStockStatus(event.target.value as StockStatusFilter); setPage(1) }}
                className={`${toolbarSelectClass} min-w-[150px]`}
              >
                <option value="all">Tồn kho</option>
                <option value="in_stock">Còn hàng</option>
                <option value="out_of_stock">Hết hàng</option>
                <option value="low_stock">Sắp hết hàng</option>
              </select>
            )}

            <select
              value={systemStatus}
              onChange={(event) => { setSystemStatus(event.target.value as SystemStatusFilter); setPage(1) }}
              className={`${toolbarSelectClass} min-w-[140px]`}
            >
              <option value="ACTIVE">Đang kích hoạt</option>
              <option value="DELETED">Đã xóa (Thùng rác)</option>
            </select>
          </>
        }
        columnPanelContent={
          <DataListColumnPanel
            columns={COLUMN_OPTIONS}
            columnOrder={columnOrder}
            visibleColumns={visibleColumns}
            sortInfo={columnSort}
            sortableColumns={SORTABLE_COLUMNS}
            draggingColumnId={draggingColumnId}
            onToggle={(id) => dataListState.toggleColumn(id as DisplayColumnId)}
            onReorder={(sourceId, targetId) => dataListState.reorderColumn(sourceId as DisplayColumnId, targetId as DisplayColumnId)}
            onToggleSort={(id) => toggleColumnSort(id as DisplayColumnId)}
            onDragStart={(id) => dataListState.setDraggingColumnId(id as DisplayColumnId)}
            onDragEnd={() => dataListState.setDraggingColumnId(null)}
          />
        }
        extraActions={
          canCreateProduct ? (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Plus size={16} />
              Thêm sản phẩm
            </button>
          ) : null
        }
      />

      <DataListFilterPanel onClearAll={clearFilters}>
        <label className="space-y-2">
          <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
            <span>Danh mục</span>
            <button
              type="button"
              onClick={() => dataListState.toggleTopFilterVisibility('category')}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${topFilterVisibility.category ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
                }`}
            >
              {topFilterVisibility.category ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          </span>
          <select
            value={category}
            onChange={(event) => { setCategory(event.target.value); setPage(1) }}
            className={filterSelectClass}
          >
            <option value="">Tất cả</option>
            {categoryOptions.map((item: any) => {
              const value = typeof item === 'string' ? item : item?.name ?? item?.value ?? ''
              if (!value) return null
              return <option key={value} value={value}>{value}</option>
            })}
          </select>
        </label>

        <label className="space-y-2">
          <span className="inline-flex items-center gap-2 text-sm text-foreground-muted">
            <BadgeCheck size={14} className="text-primary-500" />
            Nhãn hiệu
          </span>
          <input
            value={brandQuery}
            onChange={(event) => { setBrandQuery(event.target.value); setPage(1) }}
            placeholder="Tên nhãn hiệu..."
            className={filterInputClass}
          />
        </label>

        <label className="space-y-2">
          <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
            <span className="inline-flex items-center gap-2">
              <PackageCheck size={14} className="text-primary-500" />
              Trạng thái tồn
            </span>
            <button
              type="button"
              onClick={() => dataListState.toggleTopFilterVisibility('stock')}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${topFilterVisibility.stock ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
                }`}
            >
              {topFilterVisibility.stock ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          </span>
          <select
            value={stockStatus}
            onChange={(event) => { setStockStatus(event.target.value as StockStatusFilter); setPage(1) }}
            className={filterSelectClass}
          >
            <option value="all">Mọi trạng thái</option>
            <option value="in_stock">Còn hàng</option>
            <option value="out_of_stock">Hết hàng</option>
            <option value="low_stock">Sắp hết hàng</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
            <span className="inline-flex items-center gap-2">
              <Tag size={14} className="text-primary-500" />
              Trạng thái bán
            </span>
            <button
              type="button"
              onClick={() => dataListState.toggleTopFilterVisibility('sale')}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${topFilterVisibility.sale ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
                }`}
            >
              {topFilterVisibility.sale ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          </span>
          <select
            value={saleStatus}
            onChange={(event) => { setSaleStatus(event.target.value as SaleStatusFilter); setPage(1) }}
            className={filterSelectClass}
          >
            <option value="all">Mọi trạng thái</option>
            <option value="active">Đang bán</option>
            <option value="inactive">Ngưng bán</option>
          </select>
        </label>
      </DataListFilterPanel>

      {/* ── Table ───────────────────────────────────────── */}
      <DataListTable
        columns={tableColumns}
        isLoading={isLoading}
        isEmpty={productRows.length === 0}
        emptyText="Không có sản phẩm phù hợp."
        allSelected={allVisibleSelected}
        onSelectAll={toggleSelectAllVisible}
        bulkBar={
          selectedProductIds.length > 0 && (canUpdateProduct || canDeleteProduct) ? (
            <DataListBulkBar
              selectedCount={selectedProductIds.length}
              onClear={clearSelection}
            >
              {canUpdateProduct ? (
                <button
                  type="button"
                  onClick={() => setIsBulkEditOpen(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-primary-500 transition-opacity hover:opacity-90"
                >
                  <Pencil size={15} />
                  Chỉnh sửa
                </button>
              ) : null}
              {canDeleteProduct ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Xóa ${selectedProductIds.length} sản phẩm đã chọn?`)) {
                      bulkDeleteMutation.mutate(selectedProductIds)
                    }
                  }}
                  disabled={bulkDeleteMutation.isPending}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-semibold text-red-500 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  Xóa
                </button>
              ) : null}
            </DataListBulkBar>
          ) : undefined
        }
      >
        {productRows.map((product: any) => (
          <ProductRowBlock
            key={product.id}
            product={product}
            orderedVisibleColumns={orderedVisibleColumns}
            expanded={expandedProductIds.has(product.id)}
            selectedRowIds={selectedRowIds}
            onToggleExpanded={toggleExpanded}
            onToggleRowSelection={toggleRowSelection}
          />
        ))}
      </DataListTable>

      {/* ── Pagination — rendered outside DataListTable so it sits below ── */}
      <div className="-mt-3">
        <div className="rounded-b-2xl border border-t-0 border-border bg-card/95">
          <DataListPagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            total={total}
            rangeStart={visibleRangeStart}
            rangeEnd={visibleRangeEnd}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
            totalItemText={
              <p className="shrink-0 text-xs text-foreground-muted">
                Tổng <strong className="text-foreground">{total}</strong> sản phẩm
                {search && <span> · tìm kiếm &quot;{search}&quot;</span>}
              </p>
            }
          />
        </div>
      </div>

      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] })
          setIsModalOpen(false)
        }}
      />

      <BulkEditProductsModal
        isOpen={isBulkEditOpen}
        selectedCount={selectedProductIds.length}
        selectedProductIds={selectedProductIds}
        onClose={() => setIsBulkEditOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] })
          clearSelection()
          setIsBulkEditOpen(false)
        }}
      />
    </DataListShell>
  )
}

function BulkEditProductsModal({
  isOpen,
  selectedCount,
  selectedProductIds,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  selectedCount: number
  selectedProductIds: string[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [enabledFields, setEnabledFields] = useState<Record<BulkEditableField, boolean>>({
    image: false,
    category: false,
    unit: false,
    brand: false,
    price: false,
    costPrice: false,
    minStock: false,
    lastCountShift: false,
  })
  const [formData, setFormData] = useState({
    image: '',
    category: '',
    unit: '',
    brand: '',
    price: '',
    costPrice: '',
    minStock: '',
    lastCountShift: '',
  })

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => inventoryApi.getCategories(), enabled: isOpen })
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: () => inventoryApi.getBrands(), enabled: isOpen })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: () => inventoryApi.getUnits(), enabled: isOpen })

  const categoryOptions = Array.isArray(categories) ? categories : (categories as any)?.data ?? []
  const brandOptions = Array.isArray(brands) ? brands : (brands as any)?.data ?? []
  const unitOptions = Array.isArray(units) ? units : (units as any)?.data ?? []

  const resetState = () => {
    setEnabledFields({
      image: false,
      category: false,
      unit: false,
      brand: false,
      price: false,
      costPrice: false,
      minStock: false,
      lastCountShift: false,
    })
    setFormData({
      image: '',
      category: '',
      unit: '',
      brand: '',
      price: '',
      costPrice: '',
      minStock: '',
      lastCountShift: '',
    })
  }

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {}

      if (enabledFields.image && formData.image) payload.image = formData.image
      if (enabledFields.category) payload.category = formData.category || null
      if (enabledFields.unit && formData.unit) payload.unit = formData.unit
      if (enabledFields.brand) payload.brand = formData.brand || null
      if (enabledFields.price) payload.price = Number(formData.price || 0)
      if (enabledFields.costPrice) payload.costPrice = Number(formData.costPrice || 0)
      if (enabledFields.minStock) payload.minStock = Number(formData.minStock || 0)
      if (enabledFields.lastCountShift) payload.lastCountShift = formData.lastCountShift || null

      await Promise.all(selectedProductIds.map((productId) => inventoryApi.updateProduct(productId, payload)))
    },
    onSuccess: () => {
      toast.success('Đã áp dụng chỉnh sửa hàng loạt')
      resetState()
      onSuccess()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể áp dụng chỉnh sửa hàng loạt')
    },
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-[2px]">
      <div className="max-h-[86vh] w-full max-w-[760px] overflow-hidden rounded-[28px] border border-border/90 bg-[#0f1726] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Chỉnh sửa hàng loạt</h2>
            <div className="mt-1 text-base font-medium text-cyan-400">{selectedCount} sản phẩm</div>
          </div>
          <button
            type="button"
            onClick={() => {
              resetState()
              onClose()
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(86vh-132px)] overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <BulkEditField
              checked={enabledFields.image}
              label="Ảnh"
              onToggle={() => setEnabledFields((current) => ({ ...current, image: !current.image }))}
            >
              <label className={`inline-flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 text-sm font-medium transition-colors ${enabledFields.image ? 'border-primary-500/60 text-foreground' : 'border-border text-foreground-muted'
                }`}>
                <ImagePlus size={18} />
                <span>{formData.image ? 'Đổi ảnh' : 'Chọn ảnh'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    const image = await fileToDataUrl(file)
                    setFormData((current) => ({ ...current, image }))
                    setEnabledFields((current) => ({ ...current, image: true }))
                  }}
                />
              </label>
            </BulkEditField>

            <BulkEditField
              checked={enabledFields.category}
              label="Danh mục"
              onToggle={() => setEnabledFields((current) => ({ ...current, category: !current.category }))}
            >
              <select
                value={formData.category}
                onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))}
                disabled={!enabledFields.category}
                className="h-11 w-full rounded-xl border border-border bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors disabled:opacity-40 focus:border-primary-500"
              >
                <option value="">Chọn hoặc gõ tìm...</option>
                {categoryOptions.map((item: any) => {
                  const value = typeof item === 'string' ? item : item?.name ?? item?.value ?? ''
                  if (!value) return null
                  return (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  )
                })}
              </select>
            </BulkEditField>

            <BulkEditField
              checked={enabledFields.unit}
              label="Đơn vị"
              onToggle={() => setEnabledFields((current) => ({ ...current, unit: !current.unit }))}
            >
              <select
                value={formData.unit}
                onChange={(event) => setFormData((current) => ({ ...current, unit: event.target.value }))}
                disabled={!enabledFields.unit}
                className="h-11 w-full rounded-xl border border-border bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors disabled:opacity-40 focus:border-primary-500"
              >
                <option value="">Chọn hoặc gõ tìm...</option>
                {unitOptions.map((item: any) => {
                  const value = typeof item === 'string' ? item : item?.name ?? item?.value ?? ''
                  if (!value) return null
                  return (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  )
                })}
              </select>
            </BulkEditField>

            <BulkEditField
              checked={enabledFields.brand}
              label="Nhãn hiệu"
              onToggle={() => setEnabledFields((current) => ({ ...current, brand: !current.brand }))}
            >
              <select
                value={formData.brand}
                onChange={(event) => setFormData((current) => ({ ...current, brand: event.target.value }))}
                disabled={!enabledFields.brand}
                className="h-11 w-full rounded-xl border border-border bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors disabled:opacity-40 focus:border-primary-500"
              >
                <option value="">Chọn hoặc gõ tìm...</option>
                {brandOptions.map((item: any) => {
                  const value = typeof item === 'string' ? item : item?.name ?? item?.value ?? ''
                  if (!value) return null
                  return (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  )
                })}
              </select>
            </BulkEditField>

            <BulkEditField
              checked={enabledFields.price}
              label="Giá bán"
              onToggle={() => setEnabledFields((current) => ({ ...current, price: !current.price }))}
            >
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={formData.price}
                  onChange={(event) => setFormData((current) => ({ ...current, price: event.target.value }))}
                  disabled={!enabledFields.price}
                  className="h-11 w-full rounded-xl border border-border bg-background-secondary px-4 pr-10 text-sm text-foreground outline-none transition-colors disabled:opacity-40 focus:border-primary-500"
                  placeholder="0"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">₫</span>
              </div>
            </BulkEditField>

            <BulkEditField
              checked={enabledFields.costPrice}
              label="Giá vốn"
              onToggle={() => setEnabledFields((current) => ({ ...current, costPrice: !current.costPrice }))}
            >
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={formData.costPrice}
                  onChange={(event) => setFormData((current) => ({ ...current, costPrice: event.target.value }))}
                  disabled={!enabledFields.costPrice}
                  className="h-11 w-full rounded-xl border border-border bg-background-secondary px-4 pr-10 text-sm text-foreground outline-none transition-colors disabled:opacity-40 focus:border-primary-500"
                  placeholder="0"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">₫</span>
              </div>
            </BulkEditField>

            <BulkEditField
              checked={enabledFields.minStock}
              label="Tồn tối thiểu"
              onToggle={() => setEnabledFields((current) => ({ ...current, minStock: !current.minStock }))}
            >
              <input
                type="number"
                min="0"
                value={formData.minStock}
                onChange={(event) => setFormData((current) => ({ ...current, minStock: event.target.value }))}
                disabled={!enabledFields.minStock}
                className="h-11 w-full rounded-xl border border-border bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors disabled:opacity-40 focus:border-primary-500"
                placeholder="0"
              />
            </BulkEditField>

            <BulkEditField
              checked={enabledFields.lastCountShift}
              label="Ca kiểm kho"
              onToggle={() => setEnabledFields((current) => ({ ...current, lastCountShift: !current.lastCountShift }))}
            >
              <div className="flex gap-2">
                <select
                  value={formData.lastCountShift?.split('_')[0] || ''}
                  onChange={e => {
                    const day = e.target.value;
                    if (!day) {
                      setFormData((current) => ({ ...current, lastCountShift: '' }))
                    } else {
                      const shift = formData.lastCountShift?.split('_')[1] || 'A';
                      setFormData((current) => ({ ...current, lastCountShift: `${day}_${shift}` }))
                    }
                  }}
                  disabled={!enabledFields.lastCountShift}
                  className="h-11 w-1/2 rounded-xl border border-border bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors disabled:opacity-40 focus:border-primary-500"
                >
                  <option value="">Ngày</option>
                  <option value="MON">Thứ 2</option>
                  <option value="TUE">Thứ 3</option>
                  <option value="WED">Thứ 4</option>
                  <option value="THU">Thứ 5</option>
                  <option value="FRI">Thứ 6</option>
                  <option value="SAT">Thứ 7</option>
                </select>
                <select
                  value={formData.lastCountShift?.split('_')[1] || ''}
                  onChange={e => {
                    const shift = e.target.value;
                    if (!shift) {
                      setFormData((current) => ({ ...current, lastCountShift: '' }))
                    } else {
                      const day = formData.lastCountShift?.split('_')[0] || 'MON';
                      setFormData((current) => ({ ...current, lastCountShift: `${day}_${shift}` }))
                    }
                  }}
                  disabled={!enabledFields.lastCountShift || !formData.lastCountShift?.split('_')[0]}
                  className="h-11 w-1/2 rounded-xl border border-border bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors disabled:opacity-40 focus:border-primary-500"
                >
                  <option value="">Ca</option>
                  <option value="A">Ca A</option>
                  <option value="B">Ca B</option>
                  <option value="C">Ca C</option>
                  <option value="D">Ca D</option>
                </select>
              </div>
            </BulkEditField>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => {
              resetState()
              onClose()
            }}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-background-secondary text-sm font-semibold text-foreground transition-opacity hover:opacity-90"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => bulkUpdateMutation.mutate()}
            disabled={!Object.values(enabledFields).some(Boolean) || bulkUpdateMutation.isPending}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary-500 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Pencil size={16} />
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  )
}

function BulkEditField({
  checked,
  label,
  onToggle,
  children,
}: {
  checked: boolean
  label: string
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 px-4 py-4">
      <div className="grid items-center gap-4 md:grid-cols-[170px_minmax(0,1fr)]">
        <label className="inline-flex items-center gap-3 text-lg font-semibold text-foreground">
          <TableCheckbox checked={checked} onCheckedChange={onToggle} size="md" />
          <span>{label}</span>
        </label>
        <div>{children}</div>
      </div>
    </div>
  )
}

function ProductRowBlock({
  product,
  orderedVisibleColumns,
  expanded,
  selectedRowIds,
  onToggleExpanded,
  onToggleRowSelection,
}: {
  product: any
  orderedVisibleColumns: DisplayColumnId[]
  expanded: boolean
  selectedRowIds: Set<string>
  onToggleExpanded: (productId: string) => void
  onToggleRowSelection: (rowId: string, shiftKey?: boolean) => void
}) {
  const rowId = `product:${product.id}`
  const isSelected = selectedRowIds.has(rowId)

  return (
    <>
      <tr className="border-b border-border/60 align-middle transition-colors hover:bg-background-secondary/20">
        <td className="px-4 py-3">
          <TableCheckbox
            checked={isSelected}
            onCheckedChange={(checked, shiftKey) => onToggleRowSelection(rowId, shiftKey)}
          />
        </td>

        {orderedVisibleColumns.map((columnId) => {
          switch (columnId) {
            case 'image':
              return (
                <td key={columnId} className="px-3 py-2.5">
                  <ImageCell image={product.image} />
                </td>
              )
            case 'product':
              return (
                <td key={columnId} className="min-w-[300px] px-3 py-2.5">
                  <NameCell
                    name={product.name}
                    href={`/products/${product.id}`}
                    toggle={
                      product.isExpandable ? (
                        <button
                          type="button"
                          onClick={() => onToggleExpanded(product.id)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-foreground-muted transition-colors hover:text-foreground"
                        >
                          <ChevronDown size={14} className={expanded ? '' : '-rotate-90'} />
                        </button>
                      ) : null
                    }
                  />
                </td>
              )
            case 'sku':
              return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{product.sku || '—'}</td>
            case 'barcode':
              return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{product.barcode || '—'}</td>
            case 'category':
              return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{product.category || '—'}</td>
            case 'stock':
              return (
                <td key={columnId} className="px-3 py-3 text-sm text-foreground">
                  <div className="truncate">
                    <span className="font-semibold text-foreground">{product.totalStock}</span>
                    <span className="text-foreground-muted"> · Bán {product.sellableStock} · Min {product.minStock}</span>
                  </div>
                </td>
              )
            case 'price':
              return (
                <td key={columnId} className="px-3 py-3 text-sm text-foreground">
                  <div className="truncate">
                    <span>{formatMoney(product.costPrice)}</span>
                    <span className="text-foreground-muted"> / </span>
                    <span className="font-semibold text-primary-500">{formatMoney(product.price)}</span>
                  </div>
                </td>
              )
            case 'status':
              if (product.deletedAt) {
                return (
                  <td key={columnId} className="px-3 py-3">
                    <span className="inline-flex rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400">
                      Đã xóa
                    </span>
                  </td>
                )
              }
              return (
                <td key={columnId} className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${product.isActive ?? true
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-white/8 text-foreground-muted'
                    }`}>
                    {product.isActive ?? true ? 'Đang bán' : 'Ngưng bán'}
                  </span>
                </td>
              )
            case 'lastCountShift':
              return (
                <td key={columnId} className="px-3 py-3 text-sm text-foreground font-medium">
                  {product.lastCountShift ? (
                    <span className="inline-flex rounded-md bg-purple-500/15 border border-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                      {product.lastCountShift.replace('_', ' - ')}
                    </span>
                  ) : (
                    <span className="text-foreground-muted text-xs">—</span>
                  )}
                </td>
              )
            default:
              return null
          }
        })}
      </tr>

      {expanded && (
        <VariantRows
          product={product}
          orderedVisibleColumns={orderedVisibleColumns}
        />
      )}
    </>
  )
}

function VariantRows({
  product,
  orderedVisibleColumns,
}: {
  product: any
  orderedVisibleColumns: DisplayColumnId[]
}) {
  return (
    <>
      {product.groups.map((group: VariantGroup) => {
        const variantSellable = Math.max(sumStock(group.item.branchStocks) - sumReservedStock(group.item.branchStocks), 0)

        return (
          <FragmentRows key={group.item.id}>
            <tr className="border-b border-border/40 bg-background-secondary/10 align-middle">
              <td className="px-4 py-2.5">
                <span className="block h-4 w-4" aria-hidden />
              </td>

              {orderedVisibleColumns.map((columnId) => {
                switch (columnId) {
                  case 'image':
                    return (
                      <td key={columnId} className="px-3 py-2.5">
                        <ImageCell image={group.item.image} size="sm" />
                      </td>
                    )
                  case 'product':
                    return (
                      <td key={columnId} className="min-w-[300px] px-3 py-2.5">
                        <NameCell
                          name={group.item.name}
                          href={`/products/${product.id}`}
                          prefix={<CornerDownRight size={14} className="mt-1 flex-shrink-0 text-foreground-muted" />}
                          tone="variant"
                        />
                      </td>
                    )
                  case 'sku':
                    return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{group.item.sku || '—'}</td>
                  case 'barcode':
                    return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{group.item.barcode || '—'}</td>
                  case 'category':
                    return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{product.category || '—'}</td>
                  case 'stock':
                    return (
                      <td key={columnId} className="px-3 py-3 text-sm text-foreground">
                        <div className="truncate">
                          <span className="font-semibold text-red-400">{sumStock(group.item.branchStocks)}</span>
                          <span className="text-foreground-muted"> · Bán {variantSellable} · Min {sumMinStock(group.item.branchStocks)}</span>
                        </div>
                      </td>
                    )
                  case 'price':
                    return (
                      <td key={columnId} className="px-3 py-3 text-sm text-foreground">
                        <div className="truncate">
                          <span>{formatMoney(group.item.costPrice)}</span>
                          <span className="text-foreground-muted"> / </span>
                          <span className="font-semibold text-primary-500">{formatMoney(group.item.price)}</span>
                        </div>
                      </td>
                    )
                  case 'status':
                    return (
                      <td key={columnId} className="px-3 py-3">
                        <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                          Phiên bản
                        </span>
                      </td>
                    )
                  case 'lastCountShift':
                    return <td key={columnId} className="px-3 py-3 text-sm text-foreground"></td>
                  default:
                    return null
                }
              })}
            </tr>

            {group.children.map((item) => (
              <ConversionRow
                key={item.id}
                item={item}
                orderedVisibleColumns={orderedVisibleColumns}
                productCategory={product.category}
                productId={product.id}
              />
            ))}
          </FragmentRows>
        )
      })}

      {product.looseConversions.map((item: ListVariantItem) => (
        <ConversionRow
          key={item.id}
          item={item}
          orderedVisibleColumns={orderedVisibleColumns}
          productCategory={product.category}
          productId={product.id}
        />
      ))}
    </>
  )
}

function ConversionRow({
  item,
  orderedVisibleColumns,
  productCategory,
  productId,
}: {
  item: ListVariantItem
  orderedVisibleColumns: DisplayColumnId[]
  productCategory?: string | null
  productId: string
}) {
  const sellable = Math.max(sumStock(item.branchStocks) - sumReservedStock(item.branchStocks), 0)

  return (
    <tr className="border-b border-border/30 bg-background-secondary/5 align-middle">
      <td className="px-4 py-2.5">
        <span className="block h-4 w-4" aria-hidden />
      </td>

      {orderedVisibleColumns.map((columnId) => {
        switch (columnId) {
          case 'image':
            return (
              <td key={columnId} className="px-3 py-2.5">
                <ImageCell image={item.image} size="sm" />
              </td>
            )
          case 'product':
            return (
              <td key={columnId} className="min-w-[300px] px-3 py-2.5">
                <NameCell
                  name={item.name}
                  href={`/products/${productId}`}
                  prefix={<CornerDownRight size={14} className="mt-1 ml-6 flex-shrink-0 text-foreground-muted" />}
                  tone="conversion"
                />
              </td>
            )
          case 'sku':
            return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{item.sku || '—'}</td>
          case 'barcode':
            return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{item.barcode || '—'}</td>
          case 'category':
            return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{productCategory || '—'}</td>
          case 'stock':
            return (
              <td key={columnId} className="px-3 py-3 text-sm text-foreground">
                <div className="truncate">
                  <span className="font-semibold text-foreground">{sumStock(item.branchStocks)}</span>
                  <span className="text-foreground-muted"> · Bán {sellable} · Min {sumMinStock(item.branchStocks)}</span>
                </div>
              </td>
            )
          case 'price':
            return (
              <td key={columnId} className="px-3 py-3 text-sm text-foreground">
                <div className="truncate">
                  <span>{formatMoney(item.costPrice)}</span>
                  <span className="text-foreground-muted"> / </span>
                  <span className="font-semibold text-primary-500">{formatMoney(item.price)}</span>
                </div>
              </td>
            )
          case 'status':
            return (
              <td key={columnId} className="px-3 py-3">
                <span className="inline-flex rounded-full bg-primary-500/15 px-2.5 py-1 text-xs font-semibold text-primary-400">
                  Quy đổi
                </span>
              </td>
            )
          case 'lastCountShift':
            return <td key={columnId} className="px-3 py-3 text-sm text-foreground"></td>
          default:
            return null
        }
      })}
    </tr>
  )
}

function FragmentRows({ children }: { children: ReactNode }) {
  return <>{children}</>
}
