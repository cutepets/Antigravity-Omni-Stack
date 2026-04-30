'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgePercent,
  BarChart3,
  CalendarClock,
  Edit3,
  Gift,
  Pin,
  PinOff,
  Plus,
  Power,
  TicketPercent,
  X,
} from 'lucide-react'
import {
  DataListBulkBar,
  DataListColumnPanel,
  DataListFilterPanel,
  DataListPagination,
  DataListShell,
  DataListTable,
  DataListToolbar,
  TableCheckbox,
  filterSelectClass,
  toolbarSelectClass,
  useDataListCore,
  useDataListSelection,
} from '@petshop/ui/data-list'
import { api } from '@/lib/api'
import { promotionApi, type Promotion, type PromotionPayload } from '@/lib/api/promotion.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'

type DisplayColumnId =
  | 'program'
  | 'type'
  | 'status'
  | 'validity'
  | 'scope'
  | 'reward'
  | 'redeemed'
  | 'budget'
  | 'vouchers'
  | 'priority'
  | 'actions'
type PinFilterId = 'status' | 'type' | 'branch'
type FormMode = 'create' | 'edit'

type BranchOption = { id: string; name: string; isActive?: boolean }
type CustomerGroupOption = { id: string; name: string }

type PromotionFormState = {
  code: string
  name: string
  description: string
  type: string
  status: string
  priority: string
  startsAt: string
  endsAt: string
  noEndDate: boolean
  useAdvancedSchedule: boolean
  scheduleMonths: string
  scheduleMonthDays: string
  scheduleWeekdays: number[]
  scheduleStartTime: string
  scheduleEndTime: string
  allBranches: boolean
  branchIds: string[]
  allCustomerGroups: boolean
  customerGroupIds: string[]
  customerTier: string
  minOrderSubtotal: string
  rewardScope: string
  rewardType: string
  rewardValue: string
  maxDiscount: string
  productIds: string
  serviceIds: string
  categories: string
  buyProductIds: string
  buyQuantity: string
  giftProductId: string
  giftServiceId: string
  giftDescription: string
  giftQuantity: string
  giftUnitPrice: string
  birthdayTarget: string
  birthdayWindowDays: string
  allowStacking: boolean
  usageLimit: string
  budgetLimit: string
  createVoucherBatch: boolean
  voucherBatchName: string
  voucherPrefix: string
  voucherQuantity: string
  voucherUsageLimitPerCode: string
  voucherExpiresAt: string
}

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; align?: 'left' | 'center' | 'right'; minWidth?: string }> = [
  { id: 'program', label: 'Chương trình', minWidth: 'min-w-[240px]' },
  { id: 'type', label: 'Loại' },
  { id: 'status', label: 'Trạng thái' },
  { id: 'validity', label: 'Hiệu lực', minWidth: 'min-w-[190px]' },
  { id: 'scope', label: 'Phạm vi', minWidth: 'min-w-[180px]' },
  { id: 'reward', label: 'Khuyến mãi', minWidth: 'min-w-[220px]' },
  { id: 'redeemed', label: 'Đã dùng', align: 'right' },
  { id: 'budget', label: 'Ngân sách', align: 'right', minWidth: 'min-w-[150px]' },
  { id: 'vouchers', label: 'Voucher', align: 'right' },
  { id: 'priority', label: 'Ưu tiên', align: 'right' },
  { id: 'actions', label: 'Thao tác', align: 'right' },
]

const TYPE_LABELS: Record<string, string> = {
  DISCOUNT: 'Chiết khấu',
  BUY_X_GET_Y: 'Mua tặng',
  VOUCHER: 'Voucher',
  BIRTHDAY: 'Sinh nhật',
  AUTO_VOUCHER: 'Voucher tự động',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang chạy',
  PAUSED: 'Tạm dừng',
  EXPIRED: 'Hết hạn',
  ARCHIVED: 'Lưu trữ',
}

const WEEKDAYS = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 7, label: 'CN' },
]

const money = (value: number | null | undefined) => new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
const formatMoneyInput = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits ? new Intl.NumberFormat('vi-VN').format(Number(digits)) : ''
}
const normalizeMoneyInput = (value: string) => value.replace(/\D/g, '')
const toDateTimeLocal = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const parseNumberList = (value: string) =>
  value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
const parseTextList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
const numberOrUndefined = (value: string) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}
const moneyOrUndefined = (value: string) => {
  const number = Number(normalizeMoneyInput(value))
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

const defaultForm = (): PromotionFormState => ({
  code: '',
  name: '',
  description: '',
  type: 'DISCOUNT',
  status: 'DRAFT',
  priority: '0',
  startsAt: '',
  endsAt: '',
  noEndDate: false,
  useAdvancedSchedule: false,
  scheduleMonths: '',
  scheduleMonthDays: '',
  scheduleWeekdays: [],
  scheduleStartTime: '',
  scheduleEndTime: '',
  allBranches: true,
  branchIds: [],
  allCustomerGroups: true,
  customerGroupIds: [],
  customerTier: '',
  minOrderSubtotal: '100000',
  rewardScope: 'ORDER',
  rewardType: 'PERCENT_OFF',
  rewardValue: '10',
  maxDiscount: '50000',
  productIds: '',
  serviceIds: '',
  categories: '',
  buyProductIds: '',
  buyQuantity: '1',
  giftProductId: '',
  giftServiceId: '',
  giftDescription: '',
  giftQuantity: '1',
  giftUnitPrice: '0',
  birthdayTarget: 'CUSTOMER_OR_PET',
  birthdayWindowDays: '7',
  allowStacking: false,
  usageLimit: '',
  budgetLimit: '',
  createVoucherBatch: false,
  voucherBatchName: '',
  voucherPrefix: 'VC',
  voucherQuantity: '100',
  voucherUsageLimitPerCode: '1',
  voucherExpiresAt: '',
})

const formFromPromotion = (promotion: Promotion): PromotionFormState => {
  const conditions = promotion.conditions ?? {}
  const reward = promotion.reward ?? {}
  const schedule = promotion.schedules?.[0]
  const timeRange = schedule?.timeRanges?.[0]
  return {
    ...defaultForm(),
    code: promotion.code,
    name: promotion.name,
    description: promotion.description ?? '',
    type: promotion.type,
    status: promotion.status,
    priority: String(promotion.priority ?? 0),
    startsAt: toDateTimeLocal(promotion.startsAt),
    endsAt: toDateTimeLocal(promotion.endsAt),
    noEndDate: !promotion.endsAt,
    useAdvancedSchedule: Boolean(promotion.schedules?.length),
    scheduleMonths: (schedule?.months ?? []).join(', '),
    scheduleMonthDays: (schedule?.monthDays ?? []).join(', '),
    scheduleWeekdays: schedule?.weekdays ?? [],
    scheduleStartTime: timeRange?.start ?? '',
    scheduleEndTime: timeRange?.end ?? '',
    allBranches: !promotion.branchIds?.length,
    branchIds: promotion.branchIds ?? [],
    allCustomerGroups: !promotion.customerGroupIds?.length,
    customerGroupIds: promotion.customerGroupIds ?? [],
    customerTier: Array.isArray((conditions as any).customerTiers) ? String((conditions as any).customerTiers[0] ?? '') : '',
    minOrderSubtotal: String((conditions as any).minOrderSubtotal ?? ''),
    rewardScope: String((reward as any).scope ?? 'ORDER'),
    rewardType: String((reward as any).type ?? 'PERCENT_OFF'),
    rewardValue: String((reward as any).value ?? ''),
    maxDiscount: String((reward as any).maxDiscount ?? ''),
    productIds: ((conditions as any).productIds ?? []).join(', '),
    serviceIds: ((conditions as any).serviceIds ?? []).join(', '),
    categories: ((conditions as any).categories ?? []).join(', '),
    buyProductIds: ((conditions as any).buyProductIds ?? []).join(', '),
    buyQuantity: String((conditions as any).buyQuantity ?? 1),
    giftProductId: String((reward as any).productId ?? ''),
    giftServiceId: String((reward as any).serviceId ?? ''),
    giftDescription: String((reward as any).description ?? ''),
    giftQuantity: String((reward as any).quantity ?? 1),
    giftUnitPrice: String((reward as any).unitPrice ?? 0),
    birthdayTarget: String((conditions as any).birthdayTarget ?? 'CUSTOMER_OR_PET'),
    birthdayWindowDays: String((conditions as any).birthdayWindowDays ?? 7),
    allowStacking: Boolean(promotion.allowStacking),
    usageLimit: String(promotion.usageLimit ?? ''),
    budgetLimit: String(promotion.budgetLimit ?? ''),
  }
}

function buildPromotionPayload(form: PromotionFormState): PromotionPayload {
  const conditions: Record<string, unknown> = {}
  const minOrderSubtotal = moneyOrUndefined(form.minOrderSubtotal)
  if (minOrderSubtotal !== undefined) conditions.minOrderSubtotal = minOrderSubtotal
  if (form.customerTier) conditions.customerTiers = [form.customerTier]

  const productIds = parseTextList(form.productIds)
  const serviceIds = parseTextList(form.serviceIds)
  const categories = parseTextList(form.categories)
  if (productIds.length) conditions.productIds = productIds
  if (serviceIds.length) conditions.serviceIds = serviceIds
  if (categories.length) conditions.categories = categories

  let reward: Record<string, unknown> = {
    type: form.rewardType,
    scope: form.rewardScope,
    value: form.rewardType === 'AMOUNT_OFF' ? moneyOrUndefined(form.rewardValue) ?? 0 : numberOrUndefined(form.rewardValue) ?? 0,
  }
  const maxDiscount = moneyOrUndefined(form.maxDiscount)
  if (form.rewardType === 'PERCENT_OFF' && maxDiscount !== undefined) reward.maxDiscount = maxDiscount

  if (form.type === 'BUY_X_GET_Y') {
    const buyProductIds = parseTextList(form.buyProductIds)
    if (buyProductIds.length) conditions.buyProductIds = buyProductIds
    conditions.buyQuantity = Math.max(1, Number(form.buyQuantity) || 1)
    reward = {
      type: 'FREE_ITEM',
      scope: 'ITEM',
      productId: form.giftProductId || undefined,
      serviceId: form.giftServiceId || undefined,
      description: form.giftDescription || form.name,
      quantity: Math.max(1, Number(form.giftQuantity) || 1),
      unitPrice: moneyOrUndefined(form.giftUnitPrice) ?? 0,
    }
  }

  if (form.type === 'BIRTHDAY') {
    conditions.birthdayTarget = form.birthdayTarget
    conditions.birthdayWindowDays = numberOrUndefined(form.birthdayWindowDays) ?? 0
  }

  const schedules = form.useAdvancedSchedule
    ? [
        {
          months: parseNumberList(form.scheduleMonths),
          monthDays: parseNumberList(form.scheduleMonthDays),
          weekdays: form.scheduleWeekdays,
          timeRanges:
            form.scheduleStartTime && form.scheduleEndTime
              ? [{ start: form.scheduleStartTime, end: form.scheduleEndTime }]
              : [],
        },
      ]
    : []

  return {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    type: form.type,
    status: form.status,
    priority: Number(form.priority) || 0,
    startsAt: form.startsAt || undefined,
    endsAt: form.noEndDate ? undefined : form.endsAt || undefined,
    branchIds: form.allBranches ? [] : form.branchIds,
    customerGroupIds: form.allCustomerGroups ? [] : form.customerGroupIds,
    conditions,
    reward,
    schedules,
    allowStacking: form.allowStacking,
    usageLimit: numberOrUndefined(form.usageLimit),
    budgetLimit: moneyOrUndefined(form.budgetLimit),
    voucherBatch:
      form.type === 'VOUCHER' && form.createVoucherBatch
        ? {
            name: form.voucherBatchName || `${form.name.trim()} batch`,
            prefix: form.voucherPrefix || undefined,
            quantity: Math.max(1, Number(form.voucherQuantity) || 1),
            usageLimitPerCode: Math.max(1, Number(form.voucherUsageLimitPerCode) || 1),
            expiresAt: form.voucherExpiresAt || undefined,
          }
        : undefined,
  }
}

export default function PromotionsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [branchId, setBranchId] = useState('')
  const [validityState, setValidityState] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [modalState, setModalState] = useState<{ mode: FormMode; promotion?: Promotion } | null>(null)

  const promotionsQuery = useQuery({
    queryKey: ['promotions'],
    queryFn: () => promotionApi.list(),
  })
  const { data: summary } = useQuery({
    queryKey: ['promotions', 'summary'],
    queryFn: promotionApi.reportSummary,
  })
  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: async () => {
      const response = await api.get('/settings/branches')
      return (response.data.data ?? response.data ?? []) as BranchOption[]
    },
  })
  const { data: customerGroups = [] } = useQuery({
    queryKey: ['settings', 'customer-groups'],
    queryFn: async () => {
      const response = await api.get('/customer-groups')
      return (response.data.data ?? []) as CustomerGroupOption[]
    },
  })

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['program', 'type', 'status', 'validity', 'scope', 'reward', 'redeemed', 'budget', 'vouchers', 'actions'],
    initialTopFilterVisibility: { status: true, type: true, branch: true },
    storageKey: 'promotions-datalist',
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['promotions'] })
  }

  const savePromotion = useMutation({
    mutationFn: ({ mode, promotion, payload }: { mode: FormMode; promotion?: Promotion; payload: PromotionPayload }) =>
      mode === 'edit' && promotion ? promotionApi.update(promotion.id, payload) : promotionApi.create(payload),
    onSuccess: () => {
      toast.success('Đã lưu chương trình khuyến mãi')
      setModalState(null)
      invalidate()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không lưu được khuyến mãi'),
  })

  const activate = useMutation({
    mutationFn: (promotion: Promotion) =>
      promotion.status === 'ACTIVE' ? promotionApi.deactivate(promotion.id) : promotionApi.activate(promotion.id),
    onSuccess: invalidate,
  })

  const promotions = useMemo(() => promotionsQuery.data ?? [], [promotionsQuery.data])
  const branchLookup = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches])
  const filteredPromotions = useMemo(() => {
    const now = Date.now()
    const needle = search.trim().toLowerCase()
    return promotions.filter((promotion) => {
      const matchesSearch =
        !needle ||
        promotion.code.toLowerCase().includes(needle) ||
        promotion.name.toLowerCase().includes(needle) ||
        String(promotion.description ?? '').toLowerCase().includes(needle)
      const matchesStatus = !status || promotion.status === status
      const matchesType = !type || promotion.type === type
      const matchesBranch = !branchId || promotion.branchIds?.includes(branchId)
      const starts = promotion.startsAt ? new Date(promotion.startsAt).getTime() : null
      const ends = promotion.endsAt ? new Date(promotion.endsAt).getTime() : null
      const matchesValidity =
        !validityState ||
        (validityState === 'upcoming' && starts != null && starts > now) ||
        (validityState === 'running' && (starts == null || starts <= now) && (ends == null || ends >= now)) ||
        (validityState === 'expired' && ends != null && ends < now)
      return matchesSearch && matchesStatus && matchesType && matchesBranch && matchesValidity
    })
  }, [branchId, promotions, search, status, type, validityState])

  const total = filteredPromotions.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(total, currentPage * pageSize)
  const pagedPromotions = filteredPromotions.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const rowIds = pagedPromotions.map((promotion) => promotion.id)
  const selection = useDataListSelection(rowIds)
  const orderedVisibleColumns = dataListState.orderedVisibleColumns
  const visibleColumnsForTable = orderedVisibleColumns
    .map((columnId) => COLUMN_OPTIONS.find((column) => column.id === columnId))
    .filter(Boolean) as typeof COLUMN_OPTIONS
  const activeCount = promotions.filter((promotion) => promotion.status === 'ACTIVE').length

  const clearFilters = () => {
    setStatus('')
    setType('')
    setBranchId('')
    setValidityState('')
    setPage(1)
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 p-4 text-foreground">
      <div className="shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-normal">Khuyến mãi</h1>
          <p className="text-sm text-foreground-muted">Quản lý chương trình, voucher, mua tặng.</p>
        </div>
      </div>

      <div className="grid shrink-0 gap-3 lg:grid-cols-4">
        <Metric icon={BadgePercent} label="Chương trình" value={promotions.length} />
        <Metric icon={Power} label="Đang chạy" value={activeCount} tone="text-emerald-500" />
        <Metric icon={TicketPercent} label="Lượt áp dụng" value={summary?.redemptionCount ?? 0} tone="text-sky-500" />
        <Metric icon={BarChart3} label="Tổng giảm/tặng" value={`${money((summary?.discountAmount ?? 0) + (summary?.giftValue ?? 0))}đ`} tone="text-rose-500" />
      </div>

      <DataListShell className="flex-1">
        <DataListToolbar
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder="Tìm mã, tên, mô tả chương trình..."
          showFilterToggle={true}
          showColumnToggle={true}
          filterSlot={
            <>
              {dataListState.topFilterVisibility.status ? (
                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className={toolbarSelectClass}>
                  <option value="">Tất cả trạng thái</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              ) : null}
              {dataListState.topFilterVisibility.type ? (
                <select value={type} onChange={(event) => { setType(event.target.value); setPage(1) }} className={toolbarSelectClass}>
                  <option value="">Mọi loại</option>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              ) : null}
              {dataListState.topFilterVisibility.branch ? (
                <select value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1) }} className={toolbarSelectClass}>
                  <option value="">Tất cả chi nhánh</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              ) : null}
            </>
          }
          columnPanelContent={
            <DataListColumnPanel
              columns={COLUMN_OPTIONS}
              columnOrder={dataListState.columnOrder}
              visibleColumns={dataListState.visibleColumns}
              sortInfo={dataListState.columnSort}
              draggingColumnId={dataListState.draggingColumnId}
              onToggle={(columnId) => dataListState.toggleColumn(columnId as DisplayColumnId)}
              onReorder={(sourceId, targetId) => dataListState.reorderColumn(sourceId as DisplayColumnId, targetId as DisplayColumnId)}
              onDragStart={(columnId) => dataListState.setDraggingColumnId(columnId as DisplayColumnId)}
              onDragEnd={() => dataListState.setDraggingColumnId(null)}
            />
          }
          extraActions={
            <button
              type="button"
              onClick={() => setModalState({ mode: 'create' })}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 text-sm font-semibold text-sky-700 shadow-sm transition-colors hover:border-sky-400 hover:bg-sky-100"
            >
              <Plus size={16} />
              Tạo khuyến mãi
            </button>
          }
        />

        <DataListFilterPanel onClearAll={clearFilters}>
          <PinnedFilter label="Trạng thái" pinned={dataListState.topFilterVisibility.status} onToggle={() => dataListState.toggleTopFilterVisibility('status')}>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className={filterSelectClass}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </PinnedFilter>
          <PinnedFilter label="Loại khuyến mãi" pinned={dataListState.topFilterVisibility.type} onToggle={() => dataListState.toggleTopFilterVisibility('type')}>
            <select value={type} onChange={(event) => { setType(event.target.value); setPage(1) }} className={filterSelectClass}>
              <option value="">Mọi loại</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </PinnedFilter>
          <PinnedFilter label="Chi nhánh" pinned={dataListState.topFilterVisibility.branch} onToggle={() => dataListState.toggleTopFilterVisibility('branch')}>
            <select value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1) }} className={filterSelectClass}>
              <option value="">Tất cả chi nhánh</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </PinnedFilter>
          <label className="space-y-2">
            <span className="text-sm text-foreground-muted">Hiệu lực</span>
            <select value={validityState} onChange={(event) => { setValidityState(event.target.value); setPage(1) }} className={filterSelectClass}>
              <option value="">Tất cả</option>
              <option value="upcoming">Sắp diễn ra</option>
              <option value="running">Đang hiệu lực</option>
              <option value="expired">Đã hết hạn</option>
            </select>
          </label>
        </DataListFilterPanel>

        <DataListTable
          columns={visibleColumnsForTable}
          isLoading={promotionsQuery.isLoading}
          isEmpty={!promotionsQuery.isLoading && pagedPromotions.length === 0}
          emptyText="Chưa có chương trình khuyến mãi phù hợp."
          allSelected={selection.allVisibleSelected}
          onSelectAll={selection.toggleSelectAllVisible}
          bulkBar={
            selection.selectedRowIds.size > 0 ? (
              <DataListBulkBar selectedCount={selection.selectedRowIds.size} onClear={selection.clearSelection}>
                <div className="px-4 text-sm text-foreground-muted">Chọn chương trình để thao tác hàng loạt.</div>
              </DataListBulkBar>
            ) : null
          }
        >
          {pagedPromotions.map((promotion) => (
            <tr key={promotion.id} className="border-b border-border/70 last:border-0 hover:bg-background-secondary/40">
              <td className="px-4 py-3">
                <TableCheckbox checked={selection.selectedRowIds.has(promotion.id)} onCheckedChange={() => selection.toggleRowSelection(promotion.id)} />
              </td>
              {orderedVisibleColumns.map((columnId) => (
                <td key={`${promotion.id}:${columnId}`} className={`px-3 py-3 align-top text-sm text-foreground ${columnAlignClass(columnId)}`}>
                  {renderPromotionCell({
                    columnId,
                    promotion,
                    branchLookup,
                    onEdit: () => setModalState({ mode: 'edit', promotion }),
                    onToggle: () => activate.mutate(promotion),
                    isToggling: activate.isPending,
                  })}
                </td>
              ))}
            </tr>
          ))}
        </DataListTable>

        <DataListPagination
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          total={total}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          totalItemText={<span>Hiển thị <strong className="px-1 text-foreground">{total}</strong> chương trình.</span>}
        />
      </DataListShell>

      {modalState ? (
        <PromotionFormModal
          mode={modalState.mode}
          promotion={modalState.promotion}
          branches={branches}
          customerGroups={customerGroups}
          isSaving={savePromotion.isPending}
          onClose={() => setModalState(null)}
          onSubmit={(payload) => savePromotion.mutate({ mode: modalState.mode, promotion: modalState.promotion, payload })}
        />
      ) : null}
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Gift; label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-foreground-secondary">
        <Icon size={17} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-semibold ${tone ?? 'text-foreground'}`}>{value}</div>
    </div>
  )
}

function PinnedFilter({ label, pinned, onToggle, children }: { label: string; pinned: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
        <span>{label}</span>
        <button type="button" onClick={onToggle} className="text-foreground-muted hover:text-foreground">
          {pinned ? <Pin size={14} /> : <PinOff size={14} />}
        </button>
      </span>
      {children}
    </label>
  )
}

function renderPromotionCell({
  columnId,
  promotion,
  branchLookup,
  onEdit,
  onToggle,
  isToggling,
}: {
  columnId: DisplayColumnId
  promotion: Promotion
  branchLookup: Map<string, string>
  onEdit: () => void
  onToggle: () => void
  isToggling: boolean
}) {
  if (columnId === 'program') {
    return (
      <button type="button" onClick={onEdit} className="text-left">
        <div className="font-semibold text-foreground hover:text-primary-400">{promotion.name}</div>
        <div className="text-xs text-foreground-muted">{promotion.code}</div>
        {promotion.description ? <div className="mt-1 max-w-[260px] truncate text-xs text-foreground-muted">{promotion.description}</div> : null}
      </button>
    )
  }
  if (columnId === 'type') return <span>{TYPE_LABELS[promotion.type] ?? promotion.type}</span>
  if (columnId === 'status') return <StatusBadge status={promotion.status} />
  if (columnId === 'validity') return <Validity promotion={promotion} />
  if (columnId === 'scope') return <ScopeSummary promotion={promotion} branchLookup={branchLookup} />
  if (columnId === 'reward') return <RewardSummary promotion={promotion} />
  if (columnId === 'redeemed') return <span>{promotion.redeemedCount ?? promotion._count?.redemptions ?? 0}</span>
  if (columnId === 'budget') {
    return (
      <span>
        {money(promotion.budgetUsed)}đ
        {promotion.budgetLimit ? <span className="text-foreground-muted"> / {money(promotion.budgetLimit)}đ</span> : null}
      </span>
    )
  }
  if (columnId === 'vouchers') return <span>{promotion._count?.voucherCodes ?? 0}</span>
  if (columnId === 'priority') return <span>{promotion.priority ?? 0}</span>
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onEdit} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground-muted hover:bg-background-tertiary hover:text-foreground" title="Sửa">
        <Edit3 size={14} />
      </button>
      <button type="button" onClick={onToggle} disabled={isToggling} className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-background-tertiary disabled:opacity-50">
        {promotion.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}
      </button>
    </div>
  )
}

function columnAlignClass(columnId: DisplayColumnId) {
  const column = COLUMN_OPTIONS.find((item) => item.id === columnId)
  if (column?.align === 'right') return 'text-right'
  if (column?.align === 'center') return 'text-center'
  return ''
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE'
  const paused = status === 'PAUSED'
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${active ? 'bg-emerald-500/15 text-emerald-400' : paused ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-500/15 text-slate-300'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function Validity({ promotion }: { promotion: Promotion }) {
  return (
    <div className="space-y-1 text-xs">
      <div className="text-foreground">{formatDateTime(promotion.startsAt) || 'Không giới hạn bắt đầu'}</div>
      <div className="text-foreground-muted">đến {formatDateTime(promotion.endsAt) || 'Không ngày kết thúc'}</div>
      {promotion.schedules?.length ? (
        <div className="inline-flex items-center gap-1 text-sky-400">
          <CalendarClock size={12} />
          Có lịch chi tiết
        </div>
      ) : null}
    </div>
  )
}

function ScopeSummary({ promotion, branchLookup }: { promotion: Promotion; branchLookup: Map<string, string> }) {
  const branches = promotion.branchIds?.length
    ? promotion.branchIds.map((id) => branchLookup.get(id) ?? id).slice(0, 2).join(', ')
    : 'Toàn bộ chi nhánh'
  const groups = promotion.customerGroupIds?.length ? `${promotion.customerGroupIds.length} nhóm khách` : 'Mọi khách hàng'
  return (
    <div className="space-y-1 text-xs">
      <div>{branches}</div>
      <div className="text-foreground-muted">{groups}</div>
    </div>
  )
}

function RewardSummary({ promotion }: { promotion: Promotion }) {
  const reward = promotion.reward as any
  const conditions = promotion.conditions as any
  if (reward?.type === 'FREE_ITEM') {
    return <span>Tặng {reward.quantity ?? 1} {reward.description || reward.productId || reward.serviceId || 'quà'}</span>
  }
  const value = reward?.type === 'PERCENT_OFF' ? `${reward.value ?? 0}%` : `${money(reward?.value)}đ`
  return (
    <div className="space-y-1">
      <div>{value} trên {reward?.scope ?? 'ORDER'}</div>
      {reward?.maxDiscount ? <div className="text-xs text-foreground-muted">Tối đa {money(reward.maxDiscount)}đ</div> : null}
      {conditions?.minOrderSubtotal ? <div className="text-xs text-foreground-muted">Đơn từ {money(conditions.minOrderSubtotal)}đ</div> : null}
    </div>
  )
}

function formatDateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function PromotionFormModal({
  mode,
  promotion,
  branches,
  customerGroups,
  isSaving,
  onClose,
  onSubmit,
}: {
  mode: FormMode
  promotion?: Promotion
  branches: BranchOption[]
  customerGroups: CustomerGroupOption[]
  isSaving: boolean
  onClose: () => void
  onSubmit: (payload: PromotionPayload) => void
}) {
  const [form, setForm] = useState<PromotionFormState>(() => (promotion ? formFromPromotion(promotion) : defaultForm()))
  const setField = <K extends keyof PromotionFormState>(key: K, value: PromotionFormState[K]) => setForm((current) => ({ ...current, [key]: value }))
  const canSubmit = form.code.trim().length > 0 && form.name.trim().length > 0

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center app-modal-overlay p-4">
      <div className="flex max-h-[calc(100vh-32px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">{mode === 'edit' ? 'Cập nhật chương trình khuyến mãi' : 'Tạo chương trình khuyến mãi'}</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted hover:bg-background-tertiary hover:text-foreground">
            <X size={20} />
          </button>
        </header>

        <div className="custom-scrollbar flex-1 overflow-auto px-6 py-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <FormSection title="Thông tin">
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField label="Mã khuyến mãi *" value={form.code} onChange={(value) => setField('code', value.toUpperCase())} />
                  <TextField label="Tên chương trình *" value={form.name} onChange={(value) => setField('name', value)} />
                  <SelectField label="Loại" value={form.type} onChange={(value) => setField('type', value)}>
                    {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </SelectField>
                  <SelectField label="Trạng thái" value={form.status} onChange={(value) => setField('status', value)}>
                    <option value="DRAFT">Nháp</option>
                    <option value="ACTIVE">Đang kích hoạt</option>
                    <option value="PAUSED">Tạm dừng</option>
                  </SelectField>
                  <TextField label="Ưu tiên" type="number" value={form.priority} onChange={(value) => setField('priority', value)} />
                  <TextField label="Mô tả" value={form.description} onChange={(value) => setField('description', value)} className="md:col-span-2" />
                </div>
              </FormSection>

              <FormSection title="Hiệu lực">
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField label="Ngày bắt đầu" type="datetime-local" value={form.startsAt} onChange={(value) => setField('startsAt', value)} />
                  <TextField label="Ngày kết thúc" type="datetime-local" value={form.endsAt} onChange={(value) => setField('endsAt', value)} disabled={form.noEndDate} />
                </div>
                <CheckLine label="Không cần ngày kết thúc" checked={form.noEndDate} onChange={(checked) => setField('noEndDate', checked)} />
                <CheckLine label="Hiển thị nâng cao" checked={form.useAdvancedSchedule} onChange={(checked) => setField('useAdvancedSchedule', checked)} />
                {form.useAdvancedSchedule ? (
                  <div className="grid gap-4 rounded-xl border border-border bg-background-secondary p-4 md:grid-cols-2">
                    <TextField label="Tháng áp dụng" placeholder="Ví dụ: 1, 5, 12" value={form.scheduleMonths} onChange={(value) => setField('scheduleMonths', value)} />
                    <TextField label="Ngày trong tháng" placeholder="Ví dụ: 1, 15, 30" value={form.scheduleMonthDays} onChange={(value) => setField('scheduleMonthDays', value)} />
                    <div className="md:col-span-2">
                      <span className="text-sm font-medium text-foreground-muted">Thứ áp dụng</span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {WEEKDAYS.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => setField('scheduleWeekdays', form.scheduleWeekdays.includes(day.value) ? form.scheduleWeekdays.filter((item) => item !== day.value) : [...form.scheduleWeekdays, day.value])}
                            className={`h-9 rounded-lg border px-3 text-sm font-semibold ${form.scheduleWeekdays.includes(day.value) ? 'border-primary-500 bg-primary-500/15 text-primary-400' : 'border-border text-foreground-muted hover:text-foreground'}`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <TextField label="Giờ bắt đầu" type="time" value={form.scheduleStartTime} onChange={(value) => setField('scheduleStartTime', value)} />
                    <TextField label="Giờ kết thúc" type="time" value={form.scheduleEndTime} onChange={(value) => setField('scheduleEndTime', value)} />
                  </div>
                ) : null}
              </FormSection>

              <FormSection title="Phạm vi áp dụng">
                <div className="grid gap-4 lg:grid-cols-2">
                  <CheckList
                    title="Chi nhánh áp dụng"
                    allLabel="Áp dụng toàn bộ chi nhánh"
                    allChecked={form.allBranches}
                    onAllChange={(checked) => setField('allBranches', checked)}
                    options={branches.map((branch) => ({ id: branch.id, label: branch.name }))}
                    selectedIds={form.branchIds}
                    onSelectedChange={(ids) => setField('branchIds', ids)}
                  />
                  <CheckList
                    title="Đối tượng khách hàng"
                    allLabel="Áp dụng toàn bộ khách hàng"
                    allChecked={form.allCustomerGroups}
                    onAllChange={(checked) => setField('allCustomerGroups', checked)}
                    options={customerGroups.map((group) => ({ id: group.id, label: group.name }))}
                    selectedIds={form.customerGroupIds}
                    onSelectedChange={(ids) => setField('customerGroupIds', ids)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <SelectField label="Hạng khách" value={form.customerTier} onChange={(value) => setField('customerTier', value)}>
                    <option value="">Tất cả hạng</option>
                    <option value="BRONZE">Bronze</option>
                    <option value="SILVER">Silver</option>
                    <option value="GOLD">Gold</option>
                    <option value="PLATINUM">Platinum</option>
                  </SelectField>
                  <MoneyField label="Đơn tối thiểu" value={form.minOrderSubtotal} onChange={(value) => setField('minOrderSubtotal', value)} />
                  <TextField label="Danh mục áp dụng" placeholder="food, toy, grooming" value={form.categories} onChange={(value) => setField('categories', value)} />
                  <TextField label="Product IDs" placeholder="Cách nhau bằng dấu phẩy" value={form.productIds} onChange={(value) => setField('productIds', value)} />
                  <TextField label="Service IDs" placeholder="Cách nhau bằng dấu phẩy" value={form.serviceIds} onChange={(value) => setField('serviceIds', value)} />
                </div>
              </FormSection>

              <FormSection title="Hình thức khuyến mãi">
                {form.type === 'BUY_X_GET_Y' ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField label="Mua sản phẩm IDs" placeholder="Cách nhau bằng dấu phẩy" value={form.buyProductIds} onChange={(value) => setField('buyProductIds', value)} />
                    <TextField label="Số lượng mua từ" type="number" value={form.buyQuantity} onChange={(value) => setField('buyQuantity', value)} />
                    <TextField label="Tặng product ID" value={form.giftProductId} onChange={(value) => setField('giftProductId', value)} />
                    <TextField label="Hoặc service ID" value={form.giftServiceId} onChange={(value) => setField('giftServiceId', value)} />
                    <TextField label="Tên quà tặng" value={form.giftDescription} onChange={(value) => setField('giftDescription', value)} />
                    <TextField label="Số lượng tặng" type="number" value={form.giftQuantity} onChange={(value) => setField('giftQuantity', value)} />
                    <MoneyField label="Giá trị tham chiếu" value={form.giftUnitPrice} onChange={(value) => setField('giftUnitPrice', value)} />
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <SelectField label="Khuyến mãi theo" value={form.rewardScope} onChange={(value) => setField('rewardScope', value)}>
                      <option value="ORDER">Hóa đơn</option>
                      <option value="ITEM">Dòng hàng</option>
                      <option value="PRODUCT">Sản phẩm</option>
                      <option value="SERVICE">Dịch vụ</option>
                      <option value="CATEGORY">Danh mục</option>
                    </SelectField>
                    <SelectField label="Hình thức khuyến mãi" value={form.rewardType} onChange={(value) => setField('rewardType', value)}>
                      <option value="PERCENT_OFF">Giảm theo %</option>
                      <option value="AMOUNT_OFF">Giảm số tiền</option>
                    </SelectField>
                    {form.rewardType === 'PERCENT_OFF' ? (
                      <TextField label="Giảm giá (%)" type="number" value={form.rewardValue} onChange={(value) => setField('rewardValue', value)} />
                    ) : (
                      <MoneyField label="Giảm giá (VND)" value={form.rewardValue} onChange={(value) => setField('rewardValue', value)} />
                    )}
                    <MoneyField label="Giảm tối đa" value={form.maxDiscount} onChange={(value) => setField('maxDiscount', value)} disabled={form.rewardType !== 'PERCENT_OFF'} />
                  </div>
                )}
                {form.type === 'BIRTHDAY' ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <SelectField label="Áp dụng sinh nhật" value={form.birthdayTarget} onChange={(value) => setField('birthdayTarget', value)}>
                      <option value="CUSTOMER">Khách hàng</option>
                      <option value="PET">Thú cưng</option>
                      <option value="CUSTOMER_OR_PET">Khách hàng hoặc thú cưng</option>
                    </SelectField>
                    <TextField label="Cửa sổ ngày sinh nhật" type="number" value={form.birthdayWindowDays} onChange={(value) => setField('birthdayWindowDays', value)} />
                  </div>
                ) : null}
              </FormSection>
            </div>

            <aside className="space-y-5">
              <FormSection title="Giới hạn">
                <CheckLine label="Cho phép cộng dồn khuyến mãi" checked={form.allowStacking} onChange={(checked) => setField('allowStacking', checked)} />
                <TextField label="Giới hạn lượt dùng" type="number" value={form.usageLimit} onChange={(value) => setField('usageLimit', value)} />
                <MoneyField label="Ngân sách tối đa" value={form.budgetLimit} onChange={(value) => setField('budgetLimit', value)} />
              </FormSection>

              <FormSection title="Voucher">
                <CheckLine label="Tạo lô mã voucher sau khi lưu" checked={form.createVoucherBatch} onChange={(checked) => setField('createVoucherBatch', checked)} disabled={form.type !== 'VOUCHER'} />
                <div className={form.createVoucherBatch && form.type === 'VOUCHER' ? 'space-y-4' : 'pointer-events-none space-y-4 opacity-50'}>
                  <TextField label="Tên lô voucher" value={form.voucherBatchName} onChange={(value) => setField('voucherBatchName', value)} />
                  <TextField label="Tiền tố mã" value={form.voucherPrefix} onChange={(value) => setField('voucherPrefix', value.toUpperCase())} />
                  <TextField label="Số lượng mã" type="number" value={form.voucherQuantity} onChange={(value) => setField('voucherQuantity', value)} />
                  <TextField label="Số lần dùng mỗi mã" type="number" value={form.voucherUsageLimitPerCode} onChange={(value) => setField('voucherUsageLimitPerCode', value)} />
                  <TextField label="Hạn voucher" type="datetime-local" value={form.voucherExpiresAt} onChange={(value) => setField('voucherExpiresAt', value)} />
                </div>
              </FormSection>
            </aside>
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-3 border-t border-border px-6 py-4">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-border px-5 text-sm font-semibold text-foreground hover:bg-background-tertiary">
            Bỏ qua
          </button>
          <button
            type="button"
            disabled={!canSubmit || isSaving}
            onClick={() => onSubmit(buildPromotionPayload(form))}
            className="h-11 rounded-xl bg-primary-600 px-6 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu (F9)'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 text-base font-bold">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={`block space-y-2 ${className ?? ''}`}>
      <span className="text-sm font-medium text-foreground-muted">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  )
}

function MoneyField({
  label,
  value,
  onChange,
  disabled,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={`block space-y-2 ${className ?? ''}`}>
      <span className="text-sm font-medium text-foreground-muted">{label}</span>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={formatMoneyInput(value)}
          disabled={disabled}
          onChange={(event) => onChange(normalizeMoneyInput(event.target.value))}
          className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 pr-12 text-sm text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground-muted">VND</span>
      </div>
    </label>
  )
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground-muted">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500">
        {children}
      </select>
    </label>
  )
}

function CheckLine({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 text-sm text-foreground ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-border bg-background-secondary" />
      {label}
    </label>
  )
}

function CheckList({
  title,
  allLabel,
  allChecked,
  onAllChange,
  options,
  selectedIds,
  onSelectedChange,
}: {
  title: string
  allLabel: string
  allChecked: boolean
  onAllChange: (checked: boolean) => void
  options: Array<{ id: string; label: string }>
  selectedIds: string[]
  onSelectedChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="rounded-xl border border-border bg-background-secondary p-4">
      <div className="font-semibold">{title}</div>
      <div className="mt-3 space-y-3">
        <CheckLine label={allLabel} checked={allChecked} onChange={onAllChange} />
        {!allChecked ? (
          <>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm nhanh..." className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary-500" />
            <div className="custom-scrollbar max-h-40 space-y-2 overflow-auto pr-1">
              {filteredOptions.map((option) => (
                <CheckLine
                  key={option.id}
                  label={option.label}
                  checked={selectedIds.includes(option.id)}
                  onChange={(checked) => onSelectedChange(checked ? [...selectedIds, option.id] : selectedIds.filter((id) => id !== option.id))}
                />
              ))}
              {filteredOptions.length === 0 ? <div className="text-sm text-foreground-muted">Không có dữ liệu.</div> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
