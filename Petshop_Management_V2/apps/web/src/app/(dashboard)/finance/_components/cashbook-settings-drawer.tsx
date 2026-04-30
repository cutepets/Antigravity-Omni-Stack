'use client'

import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Check, Loader2, Pencil, Plus, Search, Settings, WalletCards, X } from 'lucide-react'
import { toast } from 'sonner'
import { settingsApi, type CashbookCategory } from '@/lib/api'
import { useAuthorization } from '@/hooks/useAuthorization'
import { confirmDialog } from '@/components/ui/confirmation-provider'

type CashbookCategoryType = 'INCOME' | 'EXPENSE'

type CategoryCardProps = {
  type: CashbookCategoryType
  title: string
  subtitle: string
  icon: ComponentType<{ size?: number; className?: string }>
}

type BranchReserveSetting = {
  id: string
  code: string
  name: string
  isActive: boolean
  cashReserveTargetAmount?: number | null
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))
}

function parseAmount(value: string) {
  const parsed = Number(value.replace(/\D/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function CategoryCard({ type, title, subtitle, icon: Icon }: CategoryCardProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['settings', 'cashbook-categories', type],
    queryFn: () => settingsApi.getCashbookCategories(type),
  })

  const normalizedDraft = normalizeText(draft)
  const activeEditingItem = editingId ? items.find((item) => item.id === editingId) ?? null : null

  const filteredItems = useMemo(() => {
    if (!normalizedDraft) return items
    return items.filter((item) => normalizeText(item.name).includes(normalizedDraft))
  }, [items, normalizedDraft])

  const hasExactMatch = items.some((item) => item.id !== editingId && normalizeText(item.name) === normalizedDraft)

  const refreshCategories = () => {
    queryClient.invalidateQueries({ queryKey: ['settings', 'cashbook-categories'] })
  }

  const resetDraft = () => {
    setDraft('')
    setEditingId(null)
  }

  const createCategory = useMutation({
    mutationFn: (name: string) => settingsApi.createCashbookCategory({ type, name }),
    onSuccess: () => {
      toast.success(`Đã thêm ${type === 'INCOME' ? 'danh mục thu' : 'danh mục chi'}`)
      resetDraft()
      refreshCategories()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Không thể thêm danh mục')
    },
  })

  const updateCategory = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => settingsApi.updateCashbookCategory(id, { name }),
    onSuccess: () => {
      toast.success('Đã cập nhật danh mục')
      resetDraft()
      refreshCategories()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Không thể cập nhật danh mục')
    },
  })

  const deleteCategory = useMutation({
    mutationFn: (id: string) => settingsApi.deleteCashbookCategory(id),
    onSuccess: () => {
      toast.success('Đã xóa danh mục')
      resetDraft()
      refreshCategories()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Không thể xóa danh mục')
    },
  })

  const isSubmitting = createCategory.isPending || updateCategory.isPending

  const submitCreateOrUpdate = () => {
    const value = draft.trim()
    if (!value || hasExactMatch || isSubmitting) return

    if (editingId) {
      updateCategory.mutate({ id: editingId, name: value })
      return
    }

    createCategory.mutate(value)
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-background-secondary shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-border/50 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground-base">{title}</h2>
            <p className="mt-1 text-sm text-foreground-muted">{subtitle}</p>
          </div>
        </div>
        <div className="inline-flex min-w-8 items-center justify-center rounded-full bg-primary-500/10 px-2.5 py-1 text-xs font-bold text-primary-500">
          {items.length}
        </div>
      </div>

      <div className="space-y-3 p-5">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submitCreateOrUpdate()
                }

                if (event.key === 'Escape') {
                  resetDraft()
                }
              }}
              placeholder={
                activeEditingItem
                  ? `Sửa: ${activeEditingItem.name}`
                  : type === 'INCOME'
                    ? 'Nhập để tìm hoặc thêm danh mục thu'
                    : 'Nhập để tìm hoặc thêm danh mục chi'
              }
              className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-10 text-sm outline-none transition-colors focus:border-primary-500"
            />

            {(draft || editingId) ? (
              <button
                type="button"
                onClick={resetDraft}
                className="absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-white/10 hover:text-foreground-base"
                title="Xóa nội dung"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={submitCreateOrUpdate}
            disabled={!draft.trim() || hasExactMatch || isSubmitting}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : editingId ? (
              <Check size={16} />
            ) : (
              <Plus size={16} />
            )}
            {editingId ? 'Lưu' : 'Thêm'}
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-24 items-center justify-center text-foreground-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-5 text-sm text-foreground-muted">
            {draft.trim() ? 'Không tìm thấy danh mục phù hợp. Bấm Thêm để tạo mới.' : 'Chưa có danh mục nào.'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredItems.map((item: CashbookCategory) => (
              <div
                key={item.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-background px-3 py-2 text-sm"
              >
                <span className="truncate font-medium text-foreground">{item.name}</span>
                <button
                  type="button"
                  onClick={async () => {
                    setEditingId(item.id)
                    setDraft(item.name)
                  }}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-primary-500/10 hover:text-primary-400"
                  title={`Sửa "${item.name}"`}
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirmDialog(`Xóa "${item.name}"?`)) {
                      deleteCategory.mutate(item.id)
                    }
                  }}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                  title={`Xóa "${item.name}"`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ReserveTargetCard() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthorization()
  const canManageReserve = hasPermission('branch.update') || hasPermission('settings.app.update')
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const branchesQuery = useQuery({
    queryKey: ['settings', 'branches', 'cash-reserve-target'],
    queryFn: () => settingsApi.getBranches() as Promise<BranchReserveSetting[]>,
  })

  useEffect(() => {
    if (!branchesQuery.data) return
    setDrafts(
      Object.fromEntries(
        branchesQuery.data.map((branch) => [
          branch.id,
          String(Math.max(0, Math.round(Number(branch.cashReserveTargetAmount) || 0))),
        ]),
      ),
    )
  }, [branchesQuery.data])

  const updateReserveTargets = useMutation({
    mutationFn: async () => {
      const branches = branchesQuery.data ?? []
      const dirtyBranches = branches
        .map((branch) => {
          const nextAmount = parseAmount(drafts[branch.id] ?? '')
          const currentAmount = Math.max(0, Math.round(Number(branch.cashReserveTargetAmount) || 0))
          return nextAmount !== currentAmount ? { branchId: branch.id, amount: nextAmount } : null
        })
        .filter(Boolean) as Array<{ branchId: string; amount: number }>

      if (dirtyBranches.length === 0) return 0

      await Promise.all(
        dirtyBranches.map((item) =>
          settingsApi.updateBranch(item.branchId, { cashReserveTargetAmount: item.amount }),
        ),
      )

      return dirtyBranches.length
    },
    onSuccess: (updatedCount) => {
      if (!updatedCount) {
        toast.info('Không có thay đổi tồn két')
        return
      }

      toast.success(`Đã lưu tồn két cho ${updatedCount} chi nhánh`)
      queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] })
      queryClient.invalidateQueries({ queryKey: ['finance', 'cash-vault'] })
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Không thể lưu cấu hình tồn két')
    },
  })

  const branches = branchesQuery.data ?? []

  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-background-secondary shadow-sm xl:col-span-2">
      <div className="flex items-start justify-between gap-4 border-b border-border/50 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
            <WalletCards size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground-base">Tồn két chi nhánh</h2>
            <p className="mt-1 text-sm text-foreground-muted">Thiết lập mức tiền cần để lại trong két cho từng chi nhánh.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => updateReserveTargets.mutate()}
          disabled={!canManageReserve || updateReserveTargets.isPending || branchesQuery.isLoading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updateReserveTargets.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Lưu
        </button>
      </div>

      <div className="p-5">
        {branchesQuery.isLoading ? (
          <div className="flex h-24 items-center justify-center text-foreground-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : branches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-5 text-sm text-foreground-muted">
            Chưa có chi nhánh để cấu hình tồn két.
          </div>
        ) : (
          <div className="space-y-2">
            {branches.map((branch) => {
              const inputValue = drafts[branch.id] ?? String(Math.max(0, Math.round(Number(branch.cashReserveTargetAmount) || 0)))
              return (
                <div
                  key={branch.id}
                  className="grid items-center gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3 md:grid-cols-[minmax(0,1fr)_160px]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground-base">{branch.name}</p>
                      <span className="rounded-md bg-primary-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500">
                        {branch.code}
                      </span>
                      {branch.isActive ? null : (
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                          Tạm ngưng
                        </span>
                      )}
                    </div>
                  </div>

                  <input
                    value={inputValue ? formatCurrency(parseAmount(inputValue)) : ''}
                    disabled={!canManageReserve || updateReserveTargets.isPending}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [branch.id]: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background-secondary px-3 text-right text-sm font-semibold tabular-nums text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="0"
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface CashbookSettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function CashbookSettingsDrawer({ isOpen, onClose }: CashbookSettingsDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const { hasPermission } = useAuthorization()
  const canManageCategories = hasPermission('settings.app.update')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen && !canManageCategories) {
      onClose()
    }
  }, [canManageCategories, isOpen, onClose])

  if (!mounted || !canManageCategories) return null

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 app-modal-overlay"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 z-50 flex h-full w-[880px] max-w-screen flex-col overflow-y-auto border-l border-white/10 bg-background shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background p-6">
              <div className="flex items-center gap-3 text-primary-400">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-500">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground-base">Cấu hình Sổ quỹ</h2>
                  <p className="text-sm text-foreground-muted">Quản lý danh mục thu và chi dùng cho phiếu sổ quỹ</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-foreground-muted transition-colors hover:bg-white/10"
                title="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-5 p-6 xl:grid-cols-2">
              <CategoryCard
                type="INCOME"
                title="Danh mục Thu"
                subtitle="Gắn vào phiếu thu trong sổ quỹ"
                icon={ArrowUpCircle}
              />
              <CategoryCard
                type="EXPENSE"
                title="Danh mục Chi"
                subtitle="Gắn vào phiếu chi trong sổ quỹ"
                icon={ArrowDownCircle}
              />
              <ReserveTargetCard />
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
