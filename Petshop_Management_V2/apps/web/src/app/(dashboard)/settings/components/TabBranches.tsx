'use client'

import React, { useEffect, useState } from 'react'
import { Check, Edit2, Loader2, MapPin, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { normalizeBranchCode, suggestBranchCodeFromName } from '@petshop/shared'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthorization } from '@/hooks/useAuthorization'
import { api } from '@/lib/api'
import { confirmDialog } from '@/components/ui/confirmation-provider'

type Branch = {
  id: string
  code: string
  name: string
  address: string
  phone: string
  isActive: boolean
}

type BranchFormData = {
  code: string
  name: string
  phone: string
  address: string
  isActive: boolean
}

const EMPTY_FORM: BranchFormData = {
  code: '',
  name: '',
  phone: '',
  address: '',
  isActive: true,
}

export function TabBranches() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthorization()
  const canCreateBranch = hasPermission('branch.create')
  const canUpdateBranch = hasPermission('branch.update')
  const canDeleteBranch = hasPermission('branch.delete')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [codeTouched, setCodeTouched] = useState(false)
  const [formData, setFormData] = useState<BranchFormData>(EMPTY_FORM)

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: async () => {
      const response = await api.get('/settings/branches')
      return response.data.data as Branch[]
    },
  })

  useEffect(() => {
    if (!isFormOpen || codeTouched) return

    setFormData((current) => ({
      ...current,
      code: current.name ? suggestBranchCodeFromName(current.name) : '',
    }))
  }, [codeTouched, isFormOpen, formData.name])

  const mutationCreate = useMutation({
    mutationFn: async (payload: BranchFormData) => {
      const response = await api.post('/settings/branches', payload)
      return response.data.data
    },
    onSuccess: () => {
      toast.success('Đã thêm chi nhánh mới')
      queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] })
      closeForm()
    },
  })

  const mutationUpdate = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: BranchFormData }) => {
      const response = await api.put(`/settings/branches/${id}`, payload)
      return response.data.data
    },
    onSuccess: () => {
      toast.success('Đã cập nhật chi nhánh')
      queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] })
      closeForm()
    },
  })

  const mutationDelete = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/settings/branches/${id}`)
      return response.data
    },
    onSuccess: () => {
      toast.success('Đã xóa chi nhánh')
      queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] })
    },
  })

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingId(null)
    setCodeTouched(false)
    setFormData(EMPTY_FORM)
  }

  const handleCreate = () => {
    if (!canCreateBranch) return
    closeForm()
    setIsFormOpen(true)
  }

  const handleSave = () => {
    const canSubmit = editingId ? canUpdateBranch : canCreateBranch
    if (!canSubmit) {
      toast.error('Bạn không có quyền lưu chi nhánh')
      return
    }

    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên chi nhánh')
      return
    }

    const normalizedCode = normalizeBranchCode(formData.code || suggestBranchCodeFromName(formData.name))
    if (normalizedCode.length < 2) {
      toast.error('ID chi nhánh phải có ít nhất 2 ký tự A-Z hoặc số')
      return
    }

    const payload = {
      ...formData,
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      code: normalizedCode,
    }

    if (editingId) {
      mutationUpdate.mutate({ id: editingId, payload })
      return
    }

    mutationCreate.mutate(payload)
  }

  const handleEdit = (branch: Branch) => {
    if (!canUpdateBranch) {
      toast.error('Bạn không có quyền sửa chi nhánh')
      return
    }

    setFormData({
      code: branch.code,
      name: branch.name,
      phone: branch.phone || '',
      address: branch.address || '',
      isActive: branch.isActive,
    })
    setCodeTouched(true)
    setEditingId(branch.id)
    setIsFormOpen(true)
  }

  const handleCodeSuggest = () => {
    if (!(editingId ? canUpdateBranch : canCreateBranch)) return

    setFormData((current) => ({
      ...current,
      code: suggestBranchCodeFromName(current.name),
    }))
    setCodeTouched(false)
  }

  const isReadOnly = !canCreateBranch && !canUpdateBranch && !canDeleteBranch
  const canSubmitForm = editingId ? canUpdateBranch : canCreateBranch

  return (
    <div className="flex min-h-[500px] w-full flex-col overflow-hidden rounded-3xl border border-border/60 bg-background-secondary shadow-sm">
      <div className="flex items-center justify-between border-b border-border/50 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-3 text-lg font-bold text-foreground-base">
            <MapPin className="text-primary-500" size={24} />
            Quản lý chi nhánh
          </h2>
          {isReadOnly ? (
            <span className="rounded-full border border-border/60 bg-background-elevated px-3 py-1 text-xs font-semibold text-foreground-muted">
              Chế độ chỉ xem
            </span>
          ) : null}
        </div>

        {!isFormOpen && canCreateBranch ? (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-600"
          >
            <Plus size={16} />
            Thêm
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-6 bg-black/5 p-8">
        {isFormOpen ? (
          <div className="animate-in slide-in-from-top-4 fade-in space-y-4 rounded-2xl border border-primary-500/30 bg-background-elevated p-6 shadow-sm duration-300">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-primary-500">
                {editingId ? <Edit2 size={16} /> : <Plus size={16} />}
                {editingId ? 'Sửa chi nhánh' : 'Chi nhánh mới'}
              </h3>

              {editingId ? (
                <label className="flex items-center gap-2 text-xs font-bold text-foreground-base">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    disabled={!canUpdateBranch}
                    onChange={(event) => setFormData((current) => ({ ...current, isActive: event.target.checked }))}
                    className="rounded border-border/50 bg-black/20 text-primary-500 focus:ring-primary-500"
                  />
                  Đang hoạt động
                </label>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground-base">
                  Tên chi nhánh <span className="text-red-500">*</span>
                </label>
                <input
                  value={formData.name}
                  disabled={!canSubmitForm}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="VD: Tô Hiệu"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground-base">
                  ID chi nhánh <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={formData.code}
                    disabled={!canSubmitForm}
                    onChange={(event) => {
                      setCodeTouched(true)
                      setFormData((current) => ({
                        ...current,
                        code: normalizeBranchCode(event.target.value),
                      }))
                    }}
                    className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm uppercase outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="VD: TH"
                    maxLength={4}
                  />
                  <button
                    type="button"
                    disabled={!canSubmitForm}
                    onClick={handleCodeSuggest}
                    className="flex shrink-0 items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-xs font-semibold text-foreground-muted transition-colors hover:border-primary-500 hover:text-foreground-base disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCcw size={14} />
                    Gợi ý
                  </button>
                </div>
                <p className="text-[11px] text-foreground-muted">Chỉ gồm 2-4 ký tự A-Z và số. Ví dụ: TH, Q1, HN2.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground-base">Điện thoại</label>
                <input
                  value={formData.phone}
                  disabled={!canSubmitForm}
                  onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="09..."
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-foreground-base">Địa chỉ</label>
                <input
                  value={formData.address}
                  disabled={!canSubmitForm}
                  onChange={(event) => setFormData((current) => ({ ...current, address: event.target.value }))}
                  className="w-full rounded-lg border border-border/50 bg-black/20 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Số nhà, đường..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeForm}
                className="px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground-base"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={!canSubmitForm || mutationCreate.isPending || mutationUpdate.isPending}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mutationCreate.isPending || mutationUpdate.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Xác nhận
              </button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-foreground-muted">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : branches.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border/60 text-sm text-foreground-muted">
            Chưa có chi nhánh nào.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="group relative rounded-2xl border border-border/40 bg-background-tertiary p-5 transition-colors hover:border-primary-500/50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-foreground-base">{branch.name}</h4>
                      <span className="rounded-md bg-primary-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-500">
                        {branch.code}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground-muted">{branch.phone || 'Chưa cập nhật SĐT'}</p>
                  </div>
                  {branch.isActive ? (
                    <span className="rounded bg-green-500/10 px-2 py-1 text-[10px] font-bold uppercase text-green-500">
                      Hoạt động
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-border/40 pt-4 text-xs text-foreground-muted">
                  <MapPin size={14} />
                  <span className="truncate">{branch.address || 'Chưa cập nhật địa chỉ'}</span>
                </div>

                {canUpdateBranch || canDeleteBranch ? (
                  <div className="absolute right-4 top-4 flex items-center gap-2 bg-background-tertiary pl-2 opacity-0 transition-opacity group-hover:opacity-100">
                    {canUpdateBranch ? (
                      <button
                        onClick={() => handleEdit(branch)}
                        className="rounded-md bg-black/20 p-1.5 text-foreground-muted transition-colors hover:bg-primary-500 hover:text-white"
                      >
                        <Edit2 size={14} />
                      </button>
                    ) : null}

                    {canDeleteBranch ? (
                      <button
                        onClick={async () => {
                          if (await confirmDialog('Bạn có chắc muốn xóa chi nhánh này?')) {
                            mutationDelete.mutate(branch.id)
                          }
                        }}
                        className="rounded-md bg-black/20 p-1.5 text-foreground-muted transition-colors hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
