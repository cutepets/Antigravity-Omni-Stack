'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Pencil, Save, Star, Tag, Trash2, Trophy, Users, X, Settings as SettingsIcon } from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { api } from '@/lib/api'
import { customerApi } from '@/lib/api/customer.api'

type LoyaltyTierRule = {
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'
  minSpent: number
  discount: number
  benefit: string
}

type LoyaltyConfigState = {
  loyaltySpendPerPoint: number
  loyaltyPointValue: number
  loyaltyPointExpiryMonths: number
  loyaltyTierRetentionMonths: number
  loyaltyTierRules: LoyaltyTierRule[]
}

type CustomerGroup = {
  id: string
  name: string
  color: string
  pricePolicy: string
  priceBookId?: string | null
  priceBook?: { id: string; name: string } | null
  discount: number
  description?: string | null
  isDefault: boolean
  isActive: boolean
}

const DEFAULT_LOYALTY_CONFIG: LoyaltyConfigState = {
  loyaltySpendPerPoint: 10000,
  loyaltyPointValue: 100,
  loyaltyPointExpiryMonths: 12,
  loyaltyTierRetentionMonths: 6,
  loyaltyTierRules: [
    { tier: 'BRONZE', minSpent: 0, discount: 0, benefit: 'Giá bán lẻ thông thường' },
    { tier: 'SILVER', minSpent: 2000000, discount: 3, benefit: 'Giảm 3% mỗi đơn, ưu tiên đặt lịch' },
    { tier: 'GOLD', minSpent: 10000000, discount: 5, benefit: 'Giảm 5% mỗi đơn, quà sinh nhật pet' },
    { tier: 'DIAMOND', minSpent: 30000000, discount: 8, benefit: 'Giảm 8%, dịch vụ miễn phí 1 lần/tháng' },
  ],
}

const GROUP_COLOR_OPTIONS = ['#6366f1', '#f59e0b', '#8b5cf6', '#10b981', '#06b6d4', '#ec4899']
const TIER_BADGE_LABEL: Record<LoyaltyTierRule['tier'], string> = {
  BRONZE: 'Đồng',
  SILVER: 'Bạc',
  GOLD: 'Vàng',
  DIAMOND: 'Bạch Kim',
}
const TIER_BADGE_CLASS: Record<LoyaltyTierRule['tier'], string> = {
  BRONZE: 'bg-amber-500/15 text-amber-300',
  SILVER: 'bg-slate-300/15 text-slate-200',
  GOLD: 'bg-yellow-400/15 text-yellow-300',
  DIAMOND: 'bg-violet-400/15 text-violet-300',
}

function TierChip({ tier }: { tier: LoyaltyTierRule['tier'] }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${TIER_BADGE_CLASS[tier]}`}>
      {TIER_BADGE_LABEL[tier]}
    </span>
  )
}

function parseLoyaltyConfig(configs: Record<string, any> | undefined): LoyaltyConfigState {
  if (!configs) return DEFAULT_LOYALTY_CONFIG

  let parsedRules = DEFAULT_LOYALTY_CONFIG.loyaltyTierRules
  try {
    if (configs.loyaltyTierRules) {
      const json = JSON.parse(configs.loyaltyTierRules)
      if (Array.isArray(json) && json.length > 0) parsedRules = json
    }
  } catch {
    // ignore parsing errors
  }

  return {
    loyaltySpendPerPoint: Number(configs.loyaltySpendPerPoint ?? DEFAULT_LOYALTY_CONFIG.loyaltySpendPerPoint),
    loyaltyPointValue: Number(configs.loyaltyPointValue ?? DEFAULT_LOYALTY_CONFIG.loyaltyPointValue),
    loyaltyPointExpiryMonths: Number(configs.loyaltyPointExpiryMonths ?? DEFAULT_LOYALTY_CONFIG.loyaltyPointExpiryMonths),
    loyaltyTierRetentionMonths: Number(configs.loyaltyTierRetentionMonths ?? DEFAULT_LOYALTY_CONFIG.loyaltyTierRetentionMonths),
    loyaltyTierRules: parsedRules,
  }
}

interface CustomerSettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function CustomerSettingsDrawer({ isOpen, onClose }: CustomerSettingsDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const queryClient = useQueryClient()
  const [form, setForm] = useState<LoyaltyConfigState>(DEFAULT_LOYALTY_CONFIG)
  const emptyGroupForm = {
    id: '',
    name: '',
    color: GROUP_COLOR_OPTIONS[0],
    priceBookId: '' as string, // '' = giá lẻ (no book), or a price book id
    discount: 0,
    description: '',
    isDefault: false,
  }
  const [groupForm, setGroupForm] = useState(emptyGroupForm)
  const [editGroupMode, setEditGroupMode] = useState(false)
  const [editLoyaltyMode, setEditLoyaltyMode] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: configs, isLoading: isLoadingConfigs } = useQuery({
    queryKey: ['settings', 'configs', 'loyalty'],
    queryFn: async () => {
      const res = await api.get('/settings/configs')
      return (res.data.data ?? {}) as Record<string, any>
    },
    enabled: isOpen,
  })

  const { data: customerGroups = [], isLoading: isLoadingGroups } = useQuery({
    queryKey: ['settings', 'customer-groups'],
    queryFn: async () => {
      const res = await api.get('/customer-groups')
      return (res.data.data ?? []) as CustomerGroup[]
    },
    enabled: isOpen,
  })

  const { data: priceBooks = [] } = useQuery({
    queryKey: ['inventory', 'price-books'],
    queryFn: async () => {
      const res = await api.get('/inventory/price-books')
      return (res.data.data ?? res.data ?? []) as Array<{ id: string; name: string }>
    },
    enabled: isOpen,
  })

  const { data: topCustomersResult, isLoading: isLoadingTopCustomers } = useQuery({
    queryKey: ['customers', 'top-by-points'],
    queryFn: () =>
      customerApi.getCustomers({
        limit: 5,
        sortBy: 'points',
        sortOrder: 'desc',
        isActive: true,
      }),
    enabled: isOpen,
  })

  useEffect(() => {
    if (configs) {
      setForm(parseLoyaltyConfig(configs))
    }
  }, [configs])

  const saveConfigMutation = useMutation({
    mutationFn: async (payload: LoyaltyConfigState) => {
      const res = await api.put('/settings/configs', {
        loyaltySpendPerPoint: payload.loyaltySpendPerPoint,
        loyaltyPointValue: payload.loyaltyPointValue,
        loyaltyPointExpiryMonths: payload.loyaltyPointExpiryMonths,
        loyaltyTierRetentionMonths: payload.loyaltyTierRetentionMonths,
        loyaltyTierRules: JSON.stringify(payload.loyaltyTierRules),
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Đã lưu cấu hình tích điểm')
      queryClient.invalidateQueries({ queryKey: ['settings', 'configs', 'loyalty'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể lưu cấu hình tích điểm')
    },
  })

  const groupMutation = useMutation({
    mutationFn: async (payload: typeof groupForm) => {
      const selectedBook = priceBooks.find((pb) => pb.id === payload.priceBookId)
      const pricePolicy = selectedBook ? selectedBook.name : 'Giá lẻ'
      const body = {
        name: payload.name,
        color: payload.color,
        pricePolicy,
        priceBookId: payload.priceBookId || null,
        discount: payload.discount,
        description: payload.description,
        isDefault: payload.isDefault,
      }
      if (payload.id) {
        const res = await api.put(`/customer-groups/${payload.id}`, body)
        return res.data
      }
      const res = await api.post('/customer-groups', body)
      return res.data
    },
    onSuccess: () => {
      toast.success(groupForm.id ? 'Cập nhật nhóm thành công' : 'Đã thêm nhóm khách hàng')
      queryClient.invalidateQueries({ queryKey: ['settings', 'customer-groups'] })
      setGroupForm(emptyGroupForm)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể lưu nhóm khách hàng')
    },
  })

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/customer-groups/${id}`)
      return res.data
    },
    onSuccess: () => {
      toast.success('Đã xóa nhóm khách hàng')
      queryClient.invalidateQueries({ queryKey: ['settings', 'customer-groups'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể xóa nhóm khách hàng')
    },
  })

  const setDefaultGroupMutation = useMutation({
    mutationFn: async (targetId: string) => {
      await Promise.all(
        customerGroups.map((group) =>
          api.put(`/customer-groups/${group.id}`, {
            ...group,
            priceBookId: group.priceBookId ?? null,
            isDefault: group.id === targetId,
          })
        )
      )
    },
    onSuccess: () => {
      toast.success('Đã cập nhật nhóm mặc định')
      queryClient.invalidateQueries({ queryKey: ['settings', 'customer-groups'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể cập nhật nhóm mặc định')
    },
  })

  const topCustomers = topCustomersResult?.data ?? []

  const hasUnsavedConfig = useMemo(() => {
    const original = parseLoyaltyConfig(configs)
    return JSON.stringify(original) !== JSON.stringify(form)
  }, [configs, form])

  const handleTierRuleChange = (tier: LoyaltyTierRule['tier'], key: keyof LoyaltyTierRule, value: string | number) => {
    setForm((current) => ({
      ...current,
      loyaltyTierRules: current.loyaltyTierRules.map((rule) =>
        rule.tier === tier ? { ...rule, [key]: value } : rule
      ),
    }))
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[900px] max-w-screen glass-panel border-l border-white/10 z-50 overflow-y-auto flex flex-col"
            style={{ boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4)' }}
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-background/70 backdrop-blur-xl z-10">
              <div className="flex items-center gap-3 text-primary-400">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-500">
                  <SettingsIcon size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-lg text-foreground-base">Cài đặt khách hàng</h2>
                  <p className="text-sm text-foreground-muted">Quản lý hạng thẻ và nhóm khách hàng</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 text-foreground-muted transition-colors"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 space-y-8 pb-12">
              {/* ─── Nhóm khách hàng ──────────────────────────── */}
              <div data-hotkey-scope className="rounded-3xl border border-border/70 bg-background-secondary p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-lg font-bold text-foreground">
                      <Tag size={20} className="text-primary-500" />
                      Quản lý nhóm khách hàng
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditGroupMode((v) => !v)
                      if (editGroupMode) setGroupForm(emptyGroupForm)
                    }}
                    className={`inline-flex h-9 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors ${editGroupMode
                      ? 'border-primary-500/60 bg-primary-500/10 text-primary-400 hover:bg-primary-500/20'
                      : 'border-border text-foreground-muted hover:text-foreground'
                      }`}
                  >
                    {editGroupMode ? <X size={14} /> : <Pencil size={14} />}
                    {editGroupMode ? 'Đóng' : 'Cập nhật'}
                  </button>
                </div>

                {editGroupMode && (
                  <>
                    <div className={`mb-6 grid gap-4 xl:grid-cols-[1.4fr_1fr_140px_auto] transition-all ${groupForm.id ? 'rounded-2xl border-2 border-primary-500/60 bg-primary-500/5 p-4 -mx-2' : ''
                      }`}>
                      {groupForm.id && (
                        <div className="col-span-full flex items-center gap-2 text-sm font-semibold text-primary-400 mb-1">
                          <Pencil size={14} />
                          Đang sửa nhóm: <span className="text-foreground font-bold">{groupForm.name || '...'}</span>
                        </div>
                      )}
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-foreground-muted">Tên nhóm</span>
                        <input
                          value={groupForm.name}
                          onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Khách lẻ"
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-foreground-muted">Bảng giá</span>
                        <select
                          value={groupForm.priceBookId}
                          onChange={(event) => setGroupForm((current) => ({ ...current, priceBookId: event.target.value }))}
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                        >
                          <option value="">Giá lẻ (mặc định)</option>
                          {priceBooks.map((pb) => (
                            <option key={pb.id} value={pb.id}>{pb.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-foreground-muted">Chiết khấu (%)</span>
                        <input
                          type="number"
                          value={groupForm.discount}
                          onChange={(event) => setGroupForm((current) => ({ ...current, discount: Number(event.target.value) }))}
                          placeholder="0"
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-foreground-muted">&nbsp;</span>
                        <button
                          type="button"
                          onClick={() => groupMutation.mutate(groupForm)}
                          disabled={groupMutation.isPending || !groupForm.name.trim()}
                          data-hotkey-enter
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          {groupMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                          {groupForm.id ? 'Lưu nhóm' : 'Thêm nhóm'}
                        </button>
                      </label>
                      {groupForm.id && (
                        <button
                          type="button"
                          onClick={() => setGroupForm(emptyGroupForm)}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground self-end"
                        >
                          <X size={14} />
                          Hủy sửa
                        </button>
                      )}
                    </div>

                    <div className="mb-6 flex items-center gap-2">
                      {GROUP_COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setGroupForm((current) => ({ ...current, color }))}
                          className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-105 ${groupForm.color === color ? 'border-white' : 'border-transparent'
                            }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </>
                )}

                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <table className="w-full">
                    <thead className="bg-background/60">
                      <tr className="border-b border-border/60">
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Nhóm</th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Chính sách giá</th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Chiết khấu</th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Mặc định</th>
                        {editGroupMode && (
                          <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Thao tác</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingGroups ? (
                        <tr>
                          <td colSpan={editGroupMode ? 4 : 3} className="px-5 py-12 text-center text-foreground-muted">
                            <Loader2 size={18} className="mx-auto animate-spin" />
                          </td>
                        </tr>
                      ) : customerGroups.length === 0 ? (
                        <tr>
                          <td colSpan={editGroupMode ? 4 : 3} className="px-5 py-12 text-center text-foreground-muted">
                            Chưa có nhóm khách hàng nào.
                          </td>
                        </tr>
                      ) : (
                        customerGroups.map((group) => (
                          <tr key={group.id} className="border-b border-border/50 last:border-b-0">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3 font-semibold text-foreground">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                                {group.name}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-foreground">
                              {group.priceBook?.name ?? group.pricePolicy}
                            </td>
                            <td className="px-5 py-4">
                              <span className="inline-flex rounded-full bg-primary-500/10 px-3 py-1 text-sm font-semibold text-primary-400">
                                -{group.discount}%
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() => editGroupMode && setDefaultGroupMutation.mutate(group.id)}
                                disabled={!editGroupMode}
                                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${group.isDefault ? 'bg-yellow-400/10 text-yellow-300' : editGroupMode ? 'text-foreground-muted hover:text-yellow-300' : 'text-foreground-muted opacity-50 cursor-default'
                                  }`}
                              >
                                <Star size={16} fill={group.isDefault ? 'currentColor' : 'none'} />
                              </button>
                            </td>
                            {editGroupMode && (
                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setGroupForm({
                                        id: group.id,
                                        name: group.name,
                                        color: group.color,
                                        priceBookId: group.priceBookId ?? '',
                                        discount: Number(group.discount || 0),
                                        description: group.description || '',
                                        isDefault: group.isDefault,
                                      })
                                    }
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-background hover:text-foreground"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Xóa nhóm "${group.name}"?`)) deleteGroupMutation.mutate(group.id)
                                    }}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── Cấu hình tích điểm ──────────────────────── */}
              <div data-hotkey-scope className="rounded-3xl border border-border/70 bg-background-secondary p-6 shadow-sm">
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-lg font-bold text-foreground">
                      <Trophy size={20} className="text-yellow-400" />
                      Cấu hình tích điểm
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editLoyaltyMode ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { setForm(parseLoyaltyConfig(configs)); setEditLoyaltyMode(false) }}
                          data-hotkey-esc
                          className="h-10 rounded-xl border border-border px-4 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => saveConfigMutation.mutate(form)}
                          disabled={saveConfigMutation.isPending || isLoadingConfigs || !hasUnsavedConfig}
                          data-hotkey-enter
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          {saveConfigMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          Lưu
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditLoyaltyMode(true)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
                      >
                        <Pencil size={14} />
                        Cập nhật
                      </button>
                    )}
                  </div>
                </div>

                {editLoyaltyMode ? (
                  <>
                    <div className="grid gap-4 xl:grid-cols-4">
                      <label className="space-y-2">
                        <span className="text-sm text-foreground-muted">Số tiền / 1 điểm</span>
                        <input
                          type="number"
                          value={form.loyaltySpendPerPoint}
                          onChange={(event) => setForm((current) => ({ ...current, loyaltySpendPerPoint: Number(event.target.value) }))}
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm text-foreground-muted">1 điểm quy đổi</span>
                        <input
                          type="number"
                          value={form.loyaltyPointValue}
                          onChange={(event) => setForm((current) => ({ ...current, loyaltyPointValue: Number(event.target.value) }))}
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm text-foreground-muted">Điểm hết hạn (tháng)</span>
                        <input
                          type="number"
                          value={form.loyaltyPointExpiryMonths}
                          onChange={(event) => setForm((current) => ({ ...current, loyaltyPointExpiryMonths: Number(event.target.value) }))}
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm text-foreground-muted">Giữ hạng (tháng)</span>
                        <input
                          type="number"
                          value={form.loyaltyTierRetentionMonths}
                          onChange={(event) => setForm((current) => ({ ...current, loyaltyTierRetentionMonths: Number(event.target.value) }))}
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                        />
                      </label>
                    </div>

                    <div className="mt-8 overflow-hidden rounded-2xl border border-border/60">
                      <table className="w-full min-w-[900px]">
                        <thead className="bg-background/60">
                          <tr className="border-b border-border/60">
                            <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Hạng</th>
                            <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Ngưỡng chi tiêu (VND)</th>
                            <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Chiết khấu (%)</th>
                            <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Ưu đãi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.loyaltyTierRules.map((rule) => (
                            <tr key={rule.tier} className="border-b border-border/50 last:border-b-0">
                              <td className="px-5 py-4">
                                <TierChip tier={rule.tier} />
                              </td>
                              <td className="px-5 py-3">
                                <input
                                  type="number"
                                  value={rule.minSpent}
                                  onChange={(event) => handleTierRuleChange(rule.tier, 'minSpent', Number(event.target.value))}
                                  className="h-10 w-[200px] rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                                />
                              </td>
                              <td className="px-5 py-3">
                                <input
                                  type="number"
                                  value={rule.discount}
                                  onChange={(event) => handleTierRuleChange(rule.tier, 'discount', Number(event.target.value))}
                                  className="h-10 w-[120px] rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                                />
                              </td>
                              <td className="px-5 py-3">
                                <input
                                  value={rule.benefit}
                                  onChange={(event) => handleTierRuleChange(rule.tier, 'benefit', event.target.value)}
                                  className="h-10 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-border/60">
                    <table className="w-full min-w-[900px]">
                      <thead className="bg-background/60">
                        <tr className="border-b border-border/60">
                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Hạng</th>
                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Ngưỡng chi tiêu (VND)</th>
                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Chiết khấu (%)</th>
                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Ưu đãi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.loyaltyTierRules.map((rule) => (
                          <tr key={rule.tier} className="border-b border-border/50 last:border-b-0">
                            <td className="px-5 py-4"><TierChip tier={rule.tier} /></td>
                            <td className="px-5 py-4 text-foreground">{rule.minSpent.toLocaleString('vi-VN')}</td>
                            <td className="px-5 py-4">
                              <span className="inline-flex rounded-full bg-primary-500/10 px-3 py-1 text-sm font-semibold text-primary-400">{rule.discount}%</span>
                            </td>
                            <td className="px-5 py-4 text-foreground-muted text-sm">{rule.benefit || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
