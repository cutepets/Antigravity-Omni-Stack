'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Archive } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageContent, PageHeader } from '@/components/layout/PageLayout'
import { settingsApi } from '@/lib/api'
import { equipmentApi, type EquipmentStatus } from '@/lib/equipment'
import { useEquipmentAccess } from './use-equipment-access'
import { confirmDialog } from '@/components/ui/confirmation-provider'

type DetailForm = {
  name: string
  model: string
  categoryId: string
  status: EquipmentStatus
  serialNumber: string
  purchaseDate: string
  inServiceDate: string
  warrantyUntil: string
  purchaseValue: string
  branchId: string
  locationPresetId: string
  holderName: string
  note: string
  imageUrl: string
}

const STATUS_OPTIONS: Array<{ value: EquipmentStatus; label: string }> = [
  { value: 'IN_USE', label: 'Đang dùng' },
  { value: 'STANDBY', label: 'Dự phòng' },
  { value: 'MAINTENANCE', label: 'Bảo trì' },
  { value: 'BROKEN', label: 'Hỏng' },
  { value: 'LIQUIDATED', label: 'Thanh lý' },
]

function emptyForm(): DetailForm {
  return {
    name: '',
    model: '',
    categoryId: '',
    status: 'IN_USE',
    serialNumber: '',
    purchaseDate: '',
    inServiceDate: '',
    warrantyUntil: '',
    purchaseValue: '',
    branchId: '',
    locationPresetId: '',
    holderName: '',
    note: '',
    imageUrl: '',
  }
}

export function EquipmentDetail({ code }: { code: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DetailForm>(emptyForm())
  const {
    allowedBranches,
    isLoading: isAuthLoading,
    canRead,
    canUpdate,
    canArchive,
    canReadBranches,
    canAccessDetail,
  } = useEquipmentAccess()

  const detailQuery = useQuery({
    queryKey: ['equipment-detail', code],
    queryFn: () => equipmentApi.getByCode(code),
    enabled: canAccessDetail,
  })

  const branchesQuery = useQuery({
    queryKey: ['branches', canReadBranches ? 'settings' : 'auth'],
    queryFn: () =>
      canReadBranches
        ? settingsApi.getBranches()
        : allowedBranches.map((branch) => ({
            id: branch.id,
            code: '',
            name: branch.name,
          })),
    enabled: canAccessDetail,
  })

  const categoriesQuery = useQuery({
    queryKey: ['equipment-categories'],
    queryFn: equipmentApi.getCategories,
    enabled: canAccessDetail,
  })

  const locationsQuery = useQuery({
    queryKey: ['equipment-locations', form.branchId || 'all'],
    queryFn: () => equipmentApi.getLocations(form.branchId || undefined),
    enabled: canAccessDetail,
  })

  const historyQuery = useQuery({
    queryKey: ['equipment-history', detailQuery.data?.id],
    queryFn: () => equipmentApi.getHistory(detailQuery.data!.id),
    enabled: canAccessDetail && Boolean(detailQuery.data?.id),
  })

  useEffect(() => {
    if (!detailQuery.data) return
    setForm({
      name: detailQuery.data.name || '',
      model: detailQuery.data.model || '',
      categoryId: detailQuery.data.categoryId || '',
      status: detailQuery.data.status,
      serialNumber: detailQuery.data.serialNumber || '',
      purchaseDate: detailQuery.data.purchaseDate?.slice(0, 10) || '',
      inServiceDate: detailQuery.data.inServiceDate?.slice(0, 10) || '',
      warrantyUntil: detailQuery.data.warrantyUntil?.slice(0, 10) || '',
      purchaseValue: detailQuery.data.purchaseValue ? String(detailQuery.data.purchaseValue) : '',
      branchId: detailQuery.data.branchId || '',
      locationPresetId: detailQuery.data.locationPresetId || '',
      holderName: detailQuery.data.holderName || '',
      note: detailQuery.data.note || '',
      imageUrl: detailQuery.data.imageUrl || '',
    })
  }, [detailQuery.data])

  useEffect(() => {
    if (isAuthLoading) return
    if (canAccessDetail) return
    router.replace('/dashboard')
  }, [canAccessDetail, isAuthLoading, router])

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!detailQuery.data) throw new Error('Missing equipment')
      return equipmentApi.update(detailQuery.data.id, {
        name: form.name.trim(),
        model: form.model.trim() || null,
        categoryId: form.categoryId || null,
        status: form.status,
        serialNumber: form.serialNumber.trim() || null,
        purchaseDate: form.purchaseDate || null,
        inServiceDate: form.inServiceDate || null,
        warrantyUntil: form.warrantyUntil || null,
        purchaseValue: form.purchaseValue ? Number(form.purchaseValue) : null,
        branchId: form.branchId || null,
        locationPresetId: form.locationPresetId || null,
        holderName: form.holderName.trim() || null,
        note: form.note.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
      })
    },
    onSuccess: () => {
      toast.success('Đã cập nhật thiết bị')
      queryClient.invalidateQueries({ queryKey: ['equipment-detail', code] })
      queryClient.invalidateQueries({ queryKey: ['equipment-history'] })
      queryClient.invalidateQueries({ queryKey: ['equipments'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể cập nhật thiết bị')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!detailQuery.data) throw new Error('Missing equipment')
      return equipmentApi.archive(detailQuery.data.id)
    },
    onSuccess: () => {
      toast.success('Đã lưu trữ thiết bị')
      queryClient.invalidateQueries({ queryKey: ['equipment-detail', code] })
      queryClient.invalidateQueries({ queryKey: ['equipment-history'] })
      queryClient.invalidateQueries({ queryKey: ['equipments'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể lưu trữ thiết bị')
    },
  })

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const url = await equipmentApi.uploadImage(file, form.name || 'equipment')
      setForm((current) => ({ ...current, imageUrl: url }))
      toast.success('Đã upload ảnh')
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể upload ảnh')
    } finally {
      event.target.value = ''
    }
  }

  if (isAuthLoading) {
    return <PageContent>Đang kiểm tra quyền truy cập...</PageContent>
  }

  if (!canAccessDetail) {
    return <PageContent>Đang chuyển hướng...</PageContent>
  }

  if (detailQuery.isLoading) {
    return <PageContent>Đang tải thông tin thiết bị...</PageContent>
  }

  if (detailQuery.isError) {
    const status = (detailQuery.error as any)?.response?.status
    if (status === 403) {
      return <PageContent>Bạn không có quyền xem chi tiết thiết bị này.</PageContent>
    }
  }

  if (!detailQuery.data) {
    return <PageContent>Không tìm thấy thiết bị.</PageContent>
  }

  return (
    <>
      <PageHeader
        title={`${detailQuery.data.code} · ${detailQuery.data.name}`}
        description={
          canUpdate
            ? 'Cập nhật thông tin, vị trí, bảo hành và theo dõi lịch sử thay đổi.'
            : 'Xem thông tin, vị trí, bảo hành và lịch sử thay đổi của thiết bị.'
        }
        actions={
          <div className="flex gap-3">
            <Link
              href="/equipment"
              className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background-secondary px-4 py-2 text-sm"
            >
              <ArrowLeft size={16} />
              Quay lại
            </Link>
            {canArchive ? (
              <button
                type="button"
                onClick={async () => {
                  if (!(await confirmDialog(`Lưu trữ thiết bị ${detailQuery.data?.code}?`))) return
                  archiveMutation.mutate()
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 px-4 py-2 text-sm text-rose-300"
              >
                <Archive size={16} />
                Lưu trữ
              </button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_440px]">
        <PageContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              updateMutation.mutate()
            }}
            className="space-y-4"
          >
            <fieldset disabled={!canUpdate} className="space-y-4 disabled:cursor-not-allowed disabled:opacity-70">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Tên thiết bị">
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
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
                  {(branchesQuery.data as any[] | undefined)?.map((branch) => (
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
                  {(categoriesQuery.data ?? []).map((category) => (
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
                  {(locationsQuery.data ?? [])
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

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Ngày mua">
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(event) => setForm((current) => ({ ...current, purchaseDate: event.target.value }))}
                  className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                />
              </Field>
              <Field label="Đưa vào dùng">
                <input
                  type="date"
                  value={form.inServiceDate}
                  onChange={(event) => setForm((current) => ({ ...current, inServiceDate: event.target.value }))}
                  className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                />
              </Field>
              <Field label="Bảo hành đến">
                <input
                  type="date"
                  value={form.warrantyUntil}
                  onChange={(event) => setForm((current) => ({ ...current, warrantyUntil: event.target.value }))}
                  className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Giá trị">
                <input
                  type="number"
                  min="0"
                  value={form.purchaseValue}
                  onChange={(event) => setForm((current) => ({ ...current, purchaseValue: event.target.value }))}
                  className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                />
              </Field>
              <Field label="Ảnh thiết bị">
                <div className="space-y-2">
                  <input type="file" accept="image/*" onChange={handleUpload} className="block w-full text-sm" />
                  <input
                    value={form.imageUrl}
                    onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
                    className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
                    placeholder="URL ảnh"
                  />
                </div>
              </Field>
            </div>

            <Field label="Ghi chú">
              <textarea
                rows={5}
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-3 text-sm outline-none"
              />
            </Field>

            {canUpdate ? (
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            ) : null}
            </fieldset>
          </form>
        </PageContent>

        <PageContent>
          <div className="mb-5">
            <p className="text-lg font-semibold text-foreground-base">Lịch sử cập nhật</p>
            <p className="mt-1 text-sm text-foreground-secondary">Theo dõi ai đã chỉnh sửa thiết bị và vào lúc nào.</p>
          </div>

          <div className="space-y-3">
            {historyQuery.isLoading ? (
              <div className="text-sm text-foreground-secondary">Đang tải lịch sử...</div>
            ) : (historyQuery.data ?? []).length === 0 ? (
              <div className="text-sm text-foreground-secondary">Chưa có lịch sử cập nhật.</div>
            ) : (
              historyQuery.data?.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border/60 bg-background-base px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground-base">{entry.summary}</p>
                    <span className="text-xs text-foreground-muted">
                      {new Date(entry.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    {entry.actor?.fullName || 'Hệ thống'} {entry.actor?.staffCode ? `· ${entry.actor.staffCode}` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </PageContent>
      </div>
    </>
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
