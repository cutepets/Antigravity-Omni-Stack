'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Camera, Plus, RefreshCw, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageContent, PageHeader } from '@/components/layout/PageLayout'
import { settingsApi } from '@/lib/api'
import {
  equipmentApi,
  type EquipmentCategory,
  type EquipmentItem,
  type EquipmentLocationPreset,
  type EquipmentPayload,
  type EquipmentStatus,
} from '@/lib/equipment'
import { useEquipmentAccess } from './use-equipment-access'
import { confirmDialog } from '@/components/ui/confirmation-provider'

type BranchOption = {
  id: string
  code: string
  name: string
}

type EquipmentFormState = {
  code: string
  name: string
  model: string
  categoryId: string
  status: EquipmentStatus
  imageUrl: string
  serialNumber: string
  purchaseDate: string
  inServiceDate: string
  warrantyUntil: string
  purchaseValue: string
  branchId: string
  locationPresetId: string
  holderName: string
  note: string
}

const STATUS_OPTIONS: Array<{ value: EquipmentStatus; label: string }> = [
  { value: 'IN_USE', label: 'Đang dùng' },
  { value: 'STANDBY', label: 'Dự phòng' },
  { value: 'MAINTENANCE', label: 'Bảo trì' },
  { value: 'BROKEN', label: 'Hỏng' },
  { value: 'LIQUIDATED', label: 'Thanh lý' },
]

function getEmptyForm(branchId = ''): EquipmentFormState {
  return {
    code: '',
    name: '',
    model: '',
    categoryId: '',
    status: 'IN_USE',
    imageUrl: '',
    serialNumber: '',
    purchaseDate: '',
    inServiceDate: '',
    warrantyUntil: '',
    purchaseValue: '',
    branchId,
    locationPresetId: '',
    holderName: '',
    note: '',
  }
}

function toPayload(form: EquipmentFormState): EquipmentPayload {
  return {
    code: form.code.trim() || undefined,
    name: form.name.trim(),
    model: form.model.trim() || null,
    categoryId: form.categoryId || null,
    status: form.status,
    imageUrl: form.imageUrl.trim() || null,
    serialNumber: form.serialNumber.trim() || null,
    purchaseDate: form.purchaseDate || null,
    inServiceDate: form.inServiceDate || null,
    warrantyUntil: form.warrantyUntil || null,
    purchaseValue: form.purchaseValue ? Number(form.purchaseValue) : null,
    branchId: form.branchId || null,
    locationPresetId: form.locationPresetId || null,
    holderName: form.holderName.trim() || null,
    note: form.note.trim() || null,
  }
}

function formatCurrency(value?: number | null) {
  if (!value) return '—'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('vi-VN')
}

function statusBadgeClass(status: EquipmentStatus) {
  switch (status) {
    case 'IN_USE':
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
    case 'STANDBY':
      return 'bg-sky-500/10 text-sky-300 border-sky-500/30'
    case 'MAINTENANCE':
      return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
    case 'BROKEN':
      return 'bg-rose-500/10 text-rose-300 border-rose-500/30'
    case 'LIQUIDATED':
      return 'bg-slate-500/10 text-slate-300 border-slate-500/30'
  }
}

export function EquipmentWorkspace({ initialDraftCode }: { initialDraftCode?: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'equipment' | 'config'>('equipment')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EquipmentStatus | ''>('')
  const [branchFilter, setBranchFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [warrantyOnly, setWarrantyOnly] = useState(false)
  const [form, setForm] = useState<EquipmentFormState>(getEmptyForm())
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [locationForm, setLocationForm] = useState({ branchId: '', name: '', description: '' })
  const {
    allowedBranches,
    isLoading: isAuthLoading,
    canRead,
    canCreate,
    canArchive,
    canScan,
    canConfig,
    canReadBranches,
    canAccessWorkspace,
  } = useEquipmentAccess()
  const canViewEquipmentTab = canRead || canCreate

  const branchesQuery = useQuery({
    queryKey: ['branches', canReadBranches ? 'settings' : 'auth'],
    queryFn: async () =>
      canReadBranches
        ? ((await settingsApi.getBranches()) as BranchOption[])
        : (allowedBranches.map((branch) => ({
            id: branch.id,
            code: '',
            name: branch.name,
          })) as BranchOption[]),
    enabled: canAccessWorkspace,
  })

  const categoriesQuery = useQuery({
    queryKey: ['equipment-categories'],
    queryFn: equipmentApi.getCategories,
    enabled: canRead || canCreate || canConfig,
  })

  const locationsQuery = useQuery({
    queryKey: ['equipment-locations', form.branchId || branchFilter || 'all'],
    queryFn: () => equipmentApi.getLocations(form.branchId || branchFilter || undefined),
    enabled: canRead || canCreate || canConfig,
  })

  const equipmentsQuery = useQuery({
    queryKey: ['equipments', search, status, branchFilter, categoryFilter, warrantyOnly],
    queryFn: () =>
      equipmentApi.list({
        search: search || undefined,
        status,
        branchId: branchFilter || undefined,
        categoryId: categoryFilter || undefined,
        warrantyWindowDays: warrantyOnly ? 30 : undefined,
      }),
    enabled: canRead,
  })

  const createMutation = useMutation({
    mutationFn: (payload: EquipmentPayload) => equipmentApi.create(payload),
    onSuccess: () => {
      toast.success('Đã tạo thiết bị')
      queryClient.invalidateQueries({ queryKey: ['equipments'] })
      setForm(getEmptyForm(branchFilter))
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể tạo thiết bị')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => equipmentApi.archive(id),
    onSuccess: () => {
      toast.success('Đã lưu trữ thiết bị')
      queryClient.invalidateQueries({ queryKey: ['equipments'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể lưu trữ thiết bị')
    },
  })

  const createCategoryMutation = useMutation({
    mutationFn: () =>
      equipmentApi.createCategory({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Đã thêm loại thiết bị')
      setCategoryForm({ name: '', description: '' })
      queryClient.invalidateQueries({ queryKey: ['equipment-categories'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể thêm loại thiết bị')
    },
  })

  const createLocationMutation = useMutation({
    mutationFn: () =>
      equipmentApi.createLocation({
        branchId: locationForm.branchId,
        name: locationForm.name.trim(),
        description: locationForm.description.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Đã thêm preset vị trí')
      setLocationForm({ branchId: locationForm.branchId, name: '', description: '' })
      queryClient.invalidateQueries({ queryKey: ['equipment-locations'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể thêm preset vị trí')
    },
  })

  const handlePrepareCreate = async () => {
    try {
      const code = await equipmentApi.suggestNextCode()
      setForm((current) => ({
        ...getEmptyForm(current.branchId || branchFilter),
        code,
        branchId: current.branchId || branchFilter,
      }))
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể lấy mã tiếp theo')
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) {
      toast.error('Tên thiết bị là bắt buộc')
      return
    }
    if (!form.branchId) {
      toast.error('Chi nhánh là bắt buộc')
      return
    }
    await createMutation.mutateAsync(toPayload(form))
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const url = await equipmentApi.uploadImage(file, form.name || form.code || 'equipment')
      setForm((current) => ({ ...current, imageUrl: url }))
      toast.success('Đã upload ảnh thiết bị')
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể upload ảnh')
    } finally {
      event.target.value = ''
    }
  }

  const items = equipmentsQuery.data?.data ?? []
  const categories = categoriesQuery.data ?? []
  const branches = branchesQuery.data ?? []
  const locations = locationsQuery.data ?? []

  useEffect(() => {
    if (!initialDraftCode) return
    setForm((current) => ({
      ...current,
      code: initialDraftCode,
    }))
  }, [initialDraftCode])

  useEffect(() => {
    if (isAuthLoading) return
    if (canAccessWorkspace) return
    router.replace('/dashboard')
  }, [canAccessWorkspace, isAuthLoading, router])

  useEffect(() => {
    if (!canViewEquipmentTab && canConfig) {
      setActiveTab('config')
      return
    }

    if (activeTab === 'config' && !canConfig) {
      setActiveTab('equipment')
    }
  }, [activeTab, canConfig, canViewEquipmentTab])

  if (isAuthLoading) {
    return <PageContent>Đang kiểm tra quyền truy cập...</PageContent>
  }

  if (!canAccessWorkspace) {
    return <PageContent>Đang chuyển hướng...</PageContent>
  }

  return (
    <>
      <PageHeader
        title="Thiết bị"
        description="Quản lý thiết bị bằng mã QR, theo chi nhánh, vị trí và lịch sử cập nhật."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {canScan ? (
              <Link
                href="/equipment/scan"
                className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background-secondary px-4 py-2 text-sm text-foreground-base"
              >
                <Camera size={16} />
                Quét mã
              </Link>
            ) : null}
            {canRead ? (
              <button
                type="button"
                onClick={() => void equipmentsQuery.refetch()}
                className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background-secondary px-4 py-2 text-sm text-foreground-base"
              >
                <RefreshCw size={16} />
                Tải lại
              </button>
            ) : null}
            {canCreate ? (
              <button
                type="button"
                onClick={() => void handlePrepareCreate()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus size={16} />
                Tạo thiết bị
              </button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        {canViewEquipmentTab ? (
          <button
            type="button"
            onClick={() => setActiveTab('equipment')}
            className={`rounded-full px-4 py-2 text-sm font-medium ${activeTab === 'equipment' ? 'bg-primary-500 text-white' : 'border border-border/60 bg-background-secondary text-foreground-base'}`}
          >
            {canRead ? 'Danh sách' : 'Tạo thiết bị'}
          </button>
        ) : null}
        {canConfig ? (
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${activeTab === 'config' ? 'bg-primary-500 text-white' : 'border border-border/60 bg-background-secondary text-foreground-base'}`}
          >
            <Settings2 size={15} />
            Cấu hình
          </button>
        ) : null}
      </div>

      {activeTab === 'equipment' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_400px]">
          <PageContent className="gap-4">
            {canRead ? (
              <>
            <div className="grid gap-3 md:grid-cols-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo mã, tên, model"
                className="rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
              />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as EquipmentStatus | '')}
                className="rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
              >
                <option value="">Tất cả trạng thái</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={branchFilter}
                onChange={(event) => {
                  setBranchFilter(event.target.value)
                  setForm((current) => ({ ...current, branchId: current.branchId || event.target.value }))
                }}
                className="rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
              >
                <option value="">Tất cả chi nhánh</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
              >
                <option value="">Tất cả loại</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground-secondary">
              <input
                type="checkbox"
                checked={warrantyOnly}
                onChange={(event) => setWarrantyOnly(event.target.checked)}
              />
              Chỉ xem thiết bị sắp hết bảo hành trong 30 ngày
            </label>

            <div className="grid gap-3 md:grid-cols-4">
              <SummaryCard label="Tổng thiết bị" value={String(items.length)} />
              <SummaryCard label="Đang dùng" value={String(items.filter((item) => item.status === 'IN_USE').length)} />
              <SummaryCard label="Bảo trì" value={String(items.filter((item) => item.status === 'MAINTENANCE').length)} />
              <SummaryCard
                label="Sắp hết BH"
                value={String(items.filter((item) => item.warrantyUntil).length)}
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/60">
              <div className="grid grid-cols-[140px_1.6fr_1fr_1fr_130px_120px] gap-3 border-b border-border/60 bg-background-base px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">
                <span>Mã</span>
                <span>Thiết bị</span>
                <span>Chi nhánh</span>
                <span>Vị trí</span>
                <span>Trạng thái</span>
                <span className="text-right">Tác vụ</span>
              </div>
              <div className="divide-y divide-border/50">
                {equipmentsQuery.isLoading ? (
                  <div className="px-4 py-8 text-sm text-foreground-secondary">Đang tải danh sách thiết bị...</div>
                ) : items.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-foreground-secondary">Chưa có thiết bị phù hợp với bộ lọc.</div>
                ) : (
                  items.map((item) => (
                    <EquipmentRow
                      key={item.id}
                      item={item}
                      canArchive={canArchive}
                      onArchive={async () => {
                        if (!(await confirmDialog(`Lưu trữ thiết bị ${item.code}?`))) return
                        archiveMutation.mutate(item.id)
                      }}
                    />
                  ))
                )}
              </div>
            </div>
              </>
            ) : (
              <div className="rounded-3xl border border-border/60 bg-background-base p-6">
                <p className="text-lg font-semibold text-foreground-base">Tạo thiết bị từ mã QR</p>
                <p className="mt-2 text-sm text-foreground-secondary">
                  Tài khoản hiện tại không có quyền xem danh sách thiết bị. Bạn vẫn có thể tạo mới bằng mã đã quét hoặc mã tuần tự ở biểu mẫu bên phải.
                </p>
              </div>
            )}
          </PageContent>

          <PageContent>
            {canCreate ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-lg font-semibold text-foreground-base">Tạo thiết bị mới</p>
                <p className="mt-1 text-sm text-foreground-secondary">
                  QR chỉ cần chứa mã như <span className="font-semibold">TB0001</span>.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Mã thiết bị">
                  <input
                    value={form.code}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                    placeholder="TB0001"
                  />
                </Field>
                <Field label="Trạng thái">
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EquipmentStatus }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Tên thiết bị">
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                  placeholder="MacBook Pro 14"
                />
              </Field>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Model">
                  <input
                    value={form.model}
                    onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                  />
                </Field>
                <Field label="Serial number">
                  <input
                    value={form.serialNumber}
                    onChange={(event) => setForm((current) => ({ ...current, serialNumber: event.target.value }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                  />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Chi nhánh">
                  <select
                    value={form.branchId}
                    onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value, locationPresetId: '' }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                  >
                    <option value="">Chọn chi nhánh</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Loại thiết bị">
                  <select
                    value={form.categoryId}
                    onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                  >
                    <option value="">Chọn loại</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Vị trí">
                  <select
                    value={form.locationPresetId}
                    onChange={(event) => setForm((current) => ({ ...current, locationPresetId: event.target.value }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                  >
                    <option value="">Chọn preset vị trí</option>
                    {locations
                      .filter((location) => !form.branchId || location.branchId === form.branchId)
                      .map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Người đang dùng">
                  <input
                    value={form.holderName}
                    onChange={(event) => setForm((current) => ({ ...current, holderName: event.target.value }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                  />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Ngày mua">
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(event) => setForm((current) => ({ ...current, purchaseDate: event.target.value }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                  />
                </Field>
                <Field label="Ngày bảo hành đến">
                  <input
                    type="date"
                    value={form.warrantyUntil}
                    onChange={(event) => setForm((current) => ({ ...current, warrantyUntil: event.target.value }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                  />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Ngày đưa vào dùng">
                  <input
                    type="date"
                    value={form.inServiceDate}
                    onChange={(event) => setForm((current) => ({ ...current, inServiceDate: event.target.value }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                  />
                </Field>
                <Field label="Giá trị">
                  <input
                    type="number"
                    min="0"
                    value={form.purchaseValue}
                    onChange={(event) => setForm((current) => ({ ...current, purchaseValue: event.target.value }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                    placeholder="0"
                  />
                </Field>
              </div>

              <Field label="Ảnh thiết bị">
                <div className="space-y-3">
                  <input type="file" accept="image/*" onChange={handleUpload} className="block w-full text-sm" />
                  <input
                    value={form.imageUrl}
                    onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                    placeholder="URL ảnh"
                  />
                </div>
              </Field>

              <Field label="Ghi chú">
                <textarea
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  rows={4}
                  className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                />
              </Field>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {createMutation.isPending ? 'Đang lưu...' : 'Lưu thiết bị'}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(getEmptyForm(branchFilter))}
                  className="rounded-xl border border-border/60 px-4 py-3 text-sm text-foreground-base"
                >
                  Làm mới form
                </button>
              </div>
            </form>
            ) : (
              <div className="rounded-3xl border border-border/60 bg-background-base p-6">
                <p className="text-lg font-semibold text-foreground-base">Chế độ xem</p>
                <p className="mt-2 text-sm text-foreground-secondary">
                  Tài khoản hiện tại chỉ có quyền xem danh sách thiết bị. Các thao tác tạo mới, upload ảnh và lưu trữ đã được ẩn.
                </p>
              </div>
            )}
          </PageContent>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <PageContent>
            <div className="mb-5">
              <p className="text-lg font-semibold text-foreground-base">Loại thiết bị</p>
              <p className="mt-1 text-sm text-foreground-secondary">Danh mục dùng chung cho toàn hệ thống.</p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!categoryForm.name.trim()) {
                  toast.error('Tên loại thiết bị là bắt buộc')
                  return
                }
                createCategoryMutation.mutate()
              }}
              className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
            >
              <input
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ví dụ: Laptop"
                className="rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
              />
              <input
                value={categoryForm.description}
                onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Mô tả"
                className="rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
              />
              <button
                type="submit"
                className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white"
              >
                Thêm
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {categories.map((category) => (
                <ConfigRow key={category.id} title={category.name} subtitle={category.description || 'Không có mô tả'} />
              ))}
            </div>
          </PageContent>

          <PageContent>
            <div className="mb-5">
              <p className="text-lg font-semibold text-foreground-base">Preset vị trí theo chi nhánh</p>
              <p className="mt-1 text-sm text-foreground-secondary">Danh sách này dùng để chọn nhanh vị trí thiết bị.</p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!locationForm.branchId || !locationForm.name.trim()) {
                  toast.error('Chi nhánh và tên vị trí là bắt buộc')
                  return
                }
                createLocationMutation.mutate()
              }}
              className="space-y-3"
            >
              <select
                value={locationForm.branchId}
                onChange={(event) => setLocationForm((current) => ({ ...current, branchId: event.target.value }))}
                className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
              >
                <option value="">Chọn chi nhánh</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <input
                value={locationForm.name}
                onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ví dụ: Quầy thu ngân"
                className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
              />
              <input
                value={locationForm.description}
                onChange={(event) => setLocationForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Mô tả"
                className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
              />
              <button type="submit" className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white">
                Thêm preset
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {locations.map((location) => (
                <ConfigRow
                  key={location.id}
                  title={location.name}
                  subtitle={`${location.branch?.name || 'Không rõ chi nhánh'}${location.description ? ` · ${location.description}` : ''}`}
                />
              ))}
            </div>
          </PageContent>
        </div>
      )}
    </>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background-base p-4">
      <div className="text-xs uppercase tracking-[0.12em] text-foreground-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground-base">{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground-base">{label}</span>
      {children}
    </label>
  )
}

function ConfigRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background-base px-4 py-3">
      <div className="font-medium text-foreground-base">{title}</div>
      <div className="mt-1 text-sm text-foreground-secondary">{subtitle}</div>
    </div>
  )
}

function EquipmentRow({
  item,
  canArchive,
  onArchive,
}: {
  item: EquipmentItem
  canArchive: boolean
  onArchive: () => void
}) {
  return (
    <div className="grid grid-cols-[140px_1.6fr_1fr_1fr_130px_120px] gap-3 px-4 py-4 text-sm">
      <div className="font-semibold text-foreground-base">{item.code}</div>
      <div>
        <div className="font-medium text-foreground-base">{item.name}</div>
        <div className="mt-1 text-xs text-foreground-secondary">
          {item.model || 'Không có model'} · {formatCurrency(item.purchaseValue)}
        </div>
      </div>
      <div className="text-foreground-secondary">{item.branch?.name || '—'}</div>
      <div className="text-foreground-secondary">
        <div>{item.locationPreset?.name || '—'}</div>
        <div className="mt-1 text-xs">BH: {formatDate(item.warrantyUntil)}</div>
      </div>
      <div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
          {STATUS_OPTIONS.find((option) => option.value === item.status)?.label || item.status}
        </span>
      </div>
      <div className="flex items-start justify-end gap-2">
        <Link
          href={`/equipment/${item.code}`}
          className="rounded-xl border border-border/60 px-3 py-2 text-xs font-medium text-foreground-base"
        >
          Chi tiết
        </Link>
        {canArchive ? (
          <button
            type="button"
            onClick={onArchive}
            className="inline-flex rounded-xl border border-rose-500/30 px-3 py-2 text-xs font-medium text-rose-300"
          >
            <Archive size={14} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
