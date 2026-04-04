'use client'

import type { ChangeEventHandler, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowUpDown,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Columns3,
  CornerDownRight,
  ImagePlus,
  GripVertical,
  PackageCheck,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { inventoryApi } from '@/lib/api/inventory.api'
import { toast } from 'sonner'
import { ProductFormModal } from './product-form-modal'

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

type DisplayColumnId = 'image' | 'product' | 'sku' | 'barcode' | 'category' | 'stock' | 'price' | 'status'
type SaleStatusFilter = 'all' | 'active' | 'inactive'
type StockStatusFilter = 'all' | 'in_stock' | 'out_of_stock' | 'low_stock'
type PinFilterId = 'category' | 'stock' | 'sale'
type SortDirection = 'asc' | 'desc'
type BulkEditableField = 'image' | 'category' | 'unit' | 'brand' | 'price' | 'costPrice' | 'minStock'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean }> = [
  { id: 'image', label: 'Ảnh' },
  { id: 'product', label: 'Sản phẩm' },
  { id: 'sku', label: 'SKU' },
  { id: 'barcode', label: 'Mã vạch' },
  { id: 'category', label: 'Danh mục' },
  { id: 'stock', label: 'Tồn kho' },
  { id: 'price', label: 'Giá vốn / Giá bán' },
  { id: 'status', label: 'Trạng thái' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(['product', 'sku', 'barcode', 'category', 'stock', 'price', 'status'])

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
  if (baseName && name.startsWith(`${baseName} - `)) return name.slice(baseName.length + 3)
  const parts = name.split(' - ').filter(Boolean)
  return parts[parts.length - 1] ?? name
}

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
    const displayUnit = conversionRate ? getTrailingLabel(variant.name, product.name) : variant.unit || product.unit

    return {
      id: variant.id,
      kind: conversionRate ? 'conversion' : 'variant',
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      image: variant.image ?? product.image,
      unit: displayUnit,
      price: variant.price ?? product.price,
      costPrice: variant.costPrice ?? product.costPrice,
      formula: conversionRate ? `${conversionRate} ${product.unit} = 1 ${displayUnit}` : null,
      branchStocks: Array.isArray(variant.branchStocks) ? variant.branchStocks : [],
    }
  })

  const variants = items.filter((item) => item.kind === 'variant')
  const conversions = items.filter((item) => item.kind === 'conversion')
  const usedConversionIds = new Set<string>()
  const groups: VariantGroup[] = variants.map((item) => {
    const children = conversions.filter((child) => child.name.startsWith(`${item.name} - `))
    children.forEach((child) => usedConversionIds.add(child.id))
    return { item, children }
  })

  return {
    groups,
    looseConversions: conversions.filter((item) => !usedConversionIds.has(item.id)),
    totalChildren: items.length,
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
      <img src={image} alt="" className="w-full h-full object-cover" />
    </div>
  ) : (
    <div className={`${dimensions} flex items-center justify-center bg-background-secondary border border-border text-foreground-muted`}>
      <PackageCheck size={size === 'sm' ? 14 : 18} />
    </div>
  )
}

function TableCheckbox({
  checked,
  onChange,
  size = 'sm',
  readOnly = false,
}: {
  checked: boolean
  onChange?: ChangeEventHandler<HTMLInputElement>
  size?: 'sm' | 'md'
  readOnly?: boolean
}) {
  const boxSize = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  const iconSize = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'

  return (
    <label className={`relative inline-flex ${boxSize} ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        readOnly={readOnly}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="h-full w-full rounded border border-border bg-background-secondary shadow-inner shadow-black/10 transition-colors peer-checked:border-primary-500 peer-checked:bg-primary-500/90 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/50" />
      <Check className={`pointer-events-none absolute inset-0 m-auto ${iconSize} text-white opacity-0 transition-opacity peer-checked:opacity-100`} />
    </label>
  )
}

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
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [saleStatus, setSaleStatus] = useState<SaleStatusFilter>('all')
  const [brandQuery, setBrandQuery] = useState('')
  const [stockStatus, setStockStatus] = useState<StockStatusFilter>('all')
  const [topFilterVisibility, setTopFilterVisibility] = useState<Record<PinFilterId, boolean>>({
    category: true,
    stock: false,
    sale: true,
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set())
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [lastSelectedProductRowId, setLastSelectedProductRowId] = useState<string | null>(null)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [showColumnPanel, setShowColumnPanel] = useState(false)
  const [columnOrder, setColumnOrder] = useState<DisplayColumnId[]>(COLUMN_OPTIONS.map((column) => column.id))
  const [visibleColumns, setVisibleColumns] = useState<Set<DisplayColumnId>>(new Set(COLUMN_OPTIONS.map((column) => column.id)))
  const [draggingColumnId, setDraggingColumnId] = useState<DisplayColumnId | null>(null)
  const [columnSort, setColumnSort] = useState<{ columnId: DisplayColumnId | null; direction: SortDirection | null }>({
    columnId: null,
    direction: null,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, category, page, pageSize],
    queryFn: () =>
      inventoryApi.getProducts({
        search: search || undefined,
        category: category || undefined,
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

      const variantGroups = buildVariantGroups(product)
      const variantStocks = variantGroups.groups.flatMap((group) => [group.item, ...group.children])
      const combinedStocks = variantStocks.length > 0
        ? variantStocks.flatMap((item) => item.branchStocks)
        : Array.isArray(product.branchStocks)
          ? product.branchStocks
          : []

      const totalStock = variantStocks.length > 0
        ? variantStocks.reduce((sum, item) => sum + sumStock(item.branchStocks), 0)
        : sumStock(combinedStocks, Number(product.stock ?? 0))
      const minStock = variantStocks.length > 0
        ? variantStocks.reduce((sum, item) => sum + sumMinStock(item.branchStocks), 0)
        : sumMinStock(combinedStocks, Number(product.minStock ?? 0))

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
      const productStocks = Array.isArray(product.branchStocks) ? product.branchStocks : []
      const hasVariants = totalChildren > 0
      const nestedItems = groups.flatMap((group) => [group.item, ...group.children]).concat(looseConversions)
      const totalStock = hasVariants
        ? nestedItems.reduce((sum, item) => sum + sumStock(item.branchStocks), 0)
        : sumStock(productStocks, Number(product.stock ?? 0))
      const sellableStock = hasVariants
        ? nestedItems.reduce((sum, item) => sum + Math.max(sumStock(item.branchStocks) - sumReservedStock(item.branchStocks), 0), 0)
        : Math.max(sumStock(productStocks, Number(product.stock ?? 0)) - sumReservedStock(productStocks), 0)
      const minStock = hasVariants
        ? nestedItems.reduce((sum, item) => sum + sumMinStock(item.branchStocks), 0)
        : sumMinStock(productStocks, Number(product.minStock ?? 0))

      return {
        ...product,
        groups,
        looseConversions,
        hasChildren: hasVariants,
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
        default:
          comparison = 0
      }

      if (comparison === 0) comparison = compareText(left.name, right.name)
      return comparison * directionFactor
    })
  }, [columnSort, filteredProducts])

  const orderedVisibleColumns = useMemo(
    () => columnOrder.filter((columnId) => visibleColumns.has(columnId)),
    [columnOrder, visibleColumns]
  )

  const visibleProductRowIds = useMemo(
    () => productRows.map((product: any) => `product:${product.id}`),
    [productRows]
  )

  const selectedVisibleCount = visibleProductRowIds.filter((id: string) => selectedRowIds.has(id)).length
  const allVisibleSelected = visibleProductRowIds.length > 0 && selectedVisibleCount === visibleProductRowIds.length
  const selectedProductIds = useMemo(
    () =>
      Array.from(selectedRowIds)
        .filter((rowId) => rowId.startsWith('product:'))
        .map((rowId) => rowId.replace('product:', '')),
    [selectedRowIds]
  )

  const bulkDeleteMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      await Promise.all(productIds.map((productId) => inventoryApi.deleteProduct(productId)))
    },
    onSuccess: () => {
      toast.success('Đã xóa các sản phẩm đã chọn')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setSelectedRowIds(new Set())
      setLastSelectedProductRowId(null)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể xóa một hoặc nhiều sản phẩm đã chọn')
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

  const toggleRowSelection = (rowId: string, shiftKey = false) => {
    setSelectedRowIds((current) => {
      if (shiftKey && lastSelectedProductRowId) {
        const startIndex = visibleProductRowIds.indexOf(lastSelectedProductRowId)
        const endIndex = visibleProductRowIds.indexOf(rowId)

        if (startIndex !== -1 && endIndex !== -1) {
          const next = new Set(current)
          const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
          visibleProductRowIds.slice(from, to + 1).forEach((visibleRowId: string) => next.add(visibleRowId))
          return next
        }
      }

      const next = new Set(current)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
    setLastSelectedProductRowId(rowId)
  }

  const toggleSelectAllVisible = () => {
    setSelectedRowIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        visibleProductRowIds.forEach((rowId: string) => next.delete(rowId))
      } else {
        visibleProductRowIds.forEach((rowId: string) => next.add(rowId))
      }
      return next
    })
  }

  const toggleColumn = (columnId: DisplayColumnId) => {
    setVisibleColumns((current) => {
      const next = new Set(current)
      if (next.has(columnId) && current.size > 1) next.delete(columnId)
      else next.add(columnId)
      return next
    })
  }

  const toggleTopFilterVisibility = (pinId: PinFilterId) => {
    setTopFilterVisibility((current) => ({
      ...current,
      [pinId]: !current[pinId],
    }))
  }

  const toggleColumnSort = (columnId: DisplayColumnId) => {
    if (!SORTABLE_COLUMNS.has(columnId)) return

    setColumnSort((current) => {
      if (current.columnId !== columnId) return { columnId, direction: 'asc' }
      if (current.direction === 'asc') return { columnId, direction: 'desc' }
      return { columnId: null, direction: null }
    })
  }

  const clearFilters = () => {
    setCategory('')
    setBrandQuery('')
    setStockStatus('all')
    setSaleStatus('all')
    setPage(1)
  }

  const closePanels = () => {
    setShowFilterPanel(false)
    setShowColumnPanel(false)
  }

  const clearSelection = () => {
    setSelectedRowIds(new Set())
    setLastSelectedProductRowId(null)
  }

  const visibleRangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const visibleRangeEnd = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + rawProducts.length)

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Tìm kiếm sản phẩm..."
            className="w-full h-11 rounded-xl border border-border bg-background-secondary pl-10 pr-4 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {topFilterVisibility.category && (
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                setPage(1)
              }}
              className="h-11 min-w-[140px] rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
            >
              <option value="">Danh mục</option>
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
          )}

          {topFilterVisibility.sale && (
            <select
              value={saleStatus}
              onChange={(event) => {
                setSaleStatus(event.target.value as SaleStatusFilter)
                setPage(1)
              }}
              className="h-11 min-w-[128px] rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
            >
              <option value="all">Trạng thái</option>
              <option value="active">Đang bán</option>
              <option value="inactive">Ngưng bán</option>
            </select>
          )}

          {topFilterVisibility.stock && (
            <select
              value={stockStatus}
              onChange={(event) => {
                setStockStatus(event.target.value as StockStatusFilter)
                setPage(1)
              }}
              className="h-11 min-w-[150px] rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
            >
              <option value="all">Tồn kho</option>
              <option value="in_stock">Còn hàng</option>
              <option value="out_of_stock">Hết hàng</option>
              <option value="low_stock">Sắp hết hàng</option>
            </select>
          )}

          <button
            type="button"
            onClick={() => {
              setShowFilterPanel((current) => !current)
              setShowColumnPanel(false)
            }}
            className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors ${
              showFilterPanel
                ? 'border-primary-500 bg-primary-500/10 text-primary-500'
                : 'border-border bg-background-secondary text-foreground hover:border-primary-500/60'
            }`}
          >
            <SlidersHorizontal size={16} />
            Lọc
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowColumnPanel((current) => !current)
                setShowFilterPanel(false)
              }}
              className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors ${
                showColumnPanel
                  ? 'border-primary-500 bg-primary-500/10 text-primary-500'
                  : 'border-border bg-background-secondary text-foreground hover:border-primary-500/60'
              }`}
            >
              <Columns3 size={16} />
              Cột
            </button>

            {showColumnPanel && (
              <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-[320px] rounded-2xl border border-border bg-[#161d29] p-4 shadow-2xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-foreground">Tùy chỉnh hiển thị cột</div>
                    <div className="text-xs text-foreground-muted mt-1">Kéo thả để đổi thứ tự, bỏ chọn để ẩn cột.</div>
                  </div>
                  <button type="button" onClick={closePanels} className="text-xs text-foreground-muted hover:text-foreground">
                    Đóng
                  </button>
                </div>

                <div className="mt-4 max-h-[320px] overflow-y-auto pr-1 space-y-2">
                  {columnOrder.map((columnId) => {
                    const option = COLUMN_OPTIONS.find((item) => item.id === columnId)
                    if (!option) return null
                    const isSorted = columnSort.columnId === columnId && columnSort.direction
                    const isSortable = SORTABLE_COLUMNS.has(columnId)

                    return (
                      <div
                        key={columnId}
                        draggable
                        onDragStart={() => setDraggingColumnId(columnId)}
                        onDragEnd={() => setDraggingColumnId(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (!draggingColumnId || draggingColumnId === columnId) return
                          setColumnOrder((current) => reorderList(current, draggingColumnId, columnId))
                          setDraggingColumnId(null)
                        }}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                          draggingColumnId === columnId
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-transparent bg-background-secondary hover:border-border'
                        }`}
                      >
                        <TableCheckbox
                          checked={visibleColumns.has(columnId)}
                          onChange={() => toggleColumn(columnId)}
                        />
                        <span className="flex-1 text-base font-semibold text-foreground">{option.label}</span>
                        <button
                          type="button"
                          onClick={() => toggleColumnSort(columnId)}
                          disabled={!isSortable}
                          className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                            isSorted
                              ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                              : 'border-border text-foreground-muted hover:border-primary-500/60 hover:text-foreground'
                          } disabled:cursor-not-allowed disabled:opacity-30`}
                        >
                          {columnSort.columnId === columnId ? (
                            <>
                              <ChevronDown size={14} className={columnSort.direction === 'asc' ? 'rotate-180' : ''} />
                              <span>{columnSort.direction === 'asc' ? 'Tăng' : 'Giảm'}</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpDown size={14} />
                              <span>Sort</span>
                            </>
                          )}
                        </button>
                        <GripVertical size={18} className="text-foreground-muted" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus size={16} />
            Thêm sản phẩm
          </button>
        </div>
      </div>
      </div>

      {showFilterPanel && (
        <div className="shrink-0">
          <div className="rounded-2xl border border-border bg-background-secondary/80 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
              <SlidersHorizontal size={16} className="text-primary-500" />
              Bộ lọc nâng cao
            </div>
            <button type="button" onClick={clearFilters} className="text-sm text-foreground-muted hover:text-foreground">
              Xóa tất cả
            </button>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
                <span>Danh mục</span>
                <button
                  type="button"
                  onClick={() => toggleTopFilterVisibility('category')}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                    topFilterVisibility.category ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {topFilterVisibility.category ? <Pin size={12} /> : <PinOff size={12} />}
                </button>
              </span>
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value)
                  setPage(1)
                }}
                className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
              >
                <option value="">Tất cả</option>
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
            </label>

            <label className="space-y-2">
              <span className="inline-flex items-center gap-2 text-sm text-foreground-muted">
                <BadgeCheck size={14} className="text-primary-500" />
                Nhãn hiệu
              </span>
              <input
                value={brandQuery}
                onChange={(event) => {
                  setBrandQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="Tên nhãn hiệu..."
                className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
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
                  onClick={() => toggleTopFilterVisibility('stock')}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                    topFilterVisibility.stock ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {topFilterVisibility.stock ? <Pin size={12} /> : <PinOff size={12} />}
                </button>
              </span>
              <select
                value={stockStatus}
                onChange={(event) => {
                  setStockStatus(event.target.value as StockStatusFilter)
                  setPage(1)
                }}
                className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
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
                  onClick={() => toggleTopFilterVisibility('sale')}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                    topFilterVisibility.sale ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {topFilterVisibility.sale ? <Pin size={12} /> : <PinOff size={12} />}
                </button>
              </span>
              <select
                value={saleStatus}
                onChange={(event) => {
                  setSaleStatus(event.target.value as SaleStatusFilter)
                  setPage(1)
                }}
                className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
              >
                <option value="all">Mọi trạng thái</option>
                <option value="active">Đang bán</option>
                <option value="inactive">Ngưng bán</option>
              </select>
            </label>
          </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm">
        {selectedProductIds.length > 0 && (
          <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-border bg-cyan-500/6 px-4 py-3 whitespace-nowrap">
            <div className="inline-flex items-center gap-2 text-cyan-400">
              <TableCheckbox checked readOnly />
              <span className="text-sm font-semibold">Đã chọn {selectedProductIds.length}</span>
            </div>

            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 transition-colors hover:bg-cyan-500/18"
            >
              <X size={16} />
            </button>

            <div className="h-5 w-px bg-border/70" />

            <button
              type="button"
              onClick={() => setIsBulkEditOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-primary-500 transition-opacity hover:opacity-90"
            >
              <Pencil size={15} />
              Chỉnh sửa
            </button>

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
          </div>
        )}

        <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1040px]">
            <thead className="sticky top-0 z-10 bg-background-secondary/95 backdrop-blur">
              <tr className="border-b border-border">
                <th className="w-12 px-4 py-3 text-left">
                  <TableCheckbox
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                  />
                </th>
                {orderedVisibleColumns.map((columnId) => (
                  <th
                    key={columnId}
                    className={`px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted ${
                      columnId === 'image'
                        ? 'w-20'
                        : columnId === 'product'
                          ? 'min-w-[300px]'
                          : 'min-w-[140px]'
                    }`}
                  >
                    {COLUMN_OPTIONS.find((item) => item.id === columnId)?.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={orderedVisibleColumns.length + 1} className="px-4 py-16 text-center text-foreground-muted">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : productRows.length === 0 ? (
                <tr>
                  <td colSpan={orderedVisibleColumns.length + 1} className="px-4 py-16 text-center text-foreground-muted">
                    Không có sản phẩm phù hợp.
                  </td>
                </tr>
              ) : (
                productRows.map((product: any) => (
                  <ProductRowBlock
                    key={product.id}
                    product={product}
                    orderedVisibleColumns={orderedVisibleColumns}
                    expanded={expandedProductIds.has(product.id)}
                    selectedRowIds={selectedRowIds}
                    onToggleExpanded={toggleExpanded}
                    onToggleRowSelection={toggleRowSelection}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border px-4 py-4 text-sm md:flex-row md:items-center md:justify-center md:gap-8">
            <div className="flex items-center justify-center gap-2 text-foreground-muted">
              <span>Hiển thị</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
                className="h-10 min-w-[82px] rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span>/ trang</span>
            </div>

            <div className="text-center text-foreground-muted">
              {visibleRangeStart}-{visibleRangeEnd} / {total}
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-foreground"
              >
                <ChevronsRight size={14} className="rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-foreground"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="inline-flex h-10 min-w-[40px] items-center justify-center rounded-2xl bg-primary-500 px-3 font-semibold text-white">
                {page}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-foreground"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-foreground"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
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
    </div>
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
  })
  const [formData, setFormData] = useState({
    image: '',
    category: '',
    unit: '',
    brand: '',
    price: '',
    costPrice: '',
    minStock: '',
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
    })
    setFormData({
      image: '',
      category: '',
      unit: '',
      brand: '',
      price: '',
      costPrice: '',
      minStock: '',
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
              <label className={`inline-flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 text-sm font-medium transition-colors ${
                enabledFields.image ? 'border-primary-500/60 text-foreground' : 'border-border text-foreground-muted'
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
          <TableCheckbox checked={checked} onChange={onToggle} size="md" />
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
            onChange={(event) => onToggleRowSelection(rowId, event.nativeEvent instanceof MouseEvent ? event.nativeEvent.shiftKey : false)}
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
                      product.hasChildren ? (
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
              return (
                <td key={columnId} className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    product.isActive ?? true
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-white/8 text-foreground-muted'
                  }`}>
                    {product.isActive ?? true ? 'Đang bán' : 'Ngưng bán'}
                  </span>
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
