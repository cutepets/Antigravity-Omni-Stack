'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronRight, Loader2, Pencil, Save, Star, Tag, Trash2, Trophy, Users } from 'lucide-react'
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
  } catch {}

  return {
    loyaltySpendPerPoint: Number(configs.loyaltySpendPerPoint ?? DEFAULT_LOYALTY_CONFIG.loyaltySpendPerPoint),
    loyaltyPointValue: Number(configs.loyaltyPointValue ?? DEFAULT_LOYALTY_CONFIG.loyaltyPointValue),
    loyaltyPointExpiryMonths: Number(configs.loyaltyPointExpiryMonths ?? DEFAULT_LOYALTY_CONFIG.loyaltyPointExpiryMonths),
    loyaltyTierRetentionMonths: Number(configs.loyaltyTierRetentionMonths ?? DEFAULT_LOYALTY_CONFIG.loyaltyTierRetentionMonths),
    loyaltyTierRules: parsedRules,
  }
}

export default function CustomerSettingsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<LoyaltyConfigState>(DEFAULT_LOYALTY_CONFIG)
  const [groupForm, setGroupForm] = useState({
    id: '',
    name: '',
    color: GROUP_COLOR_OPTIONS[0],
    pricePolicy: 'Giá lẻ',
    discount: 0,
    description: '',
    isDefault: false,
  })

  const { data: configs, isLoading: isLoadingConfigs } = useQuery({
    queryKey: ['settings', 'configs', 'loyalty'],
    queryFn: async () => {
      const res = await api.get('/settings/configs')
      return (res.data.data ?? {}) as Record<string, any>
    },
  })

  const { data: customerGroups = [], isLoading: isLoadingGroups } = useQuery({
    queryKey: ['settings', 'customer-groups'],
    queryFn: async () => {
      const res = await api.get('/customer-groups')
      return (res.data.data ?? []) as CustomerGroup[]
    },
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
  })

  useEffect(() => {
    setForm(parseLoyaltyConfig(configs))
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
      if (payload.id) {
        const res = await api.put(`/customer-groups/${payload.id}`, payload)
        return res.data
      }
      const res = await api.post('/customer-groups', payload)
      return res.data
    },
    onSuccess: () => {
      toast.success('Đã lưu nhóm khách hàng')
      queryClient.invalidateQueries({ queryKey: ['settings', 'customer-groups'] })
      setGroupForm({
        id: '',
        name: '',
        color: GROUP_COLOR_OPTIONS[0],
        pricePolicy: 'Giá lẻ',
        discount: 0,
        description: '',
        isDefault: false,
      })
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

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-6 py-8 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/settings" className="inline-flex items-center font-medium text-foreground-muted transition-colors hover:text-primary-500">
              <ArrowLeft size={16} className="mr-2" />
              Quay lại cài đặt
            </Link>
            <span className="text-foreground-muted">/</span>
            <Link href="/settings/inventory" className="font-medium text-foreground-muted transition-colors hover:text-primary-500">
              Cấu hình kho
            </Link>
            <span className="text-foreground-muted">/</span>
            <span className="font-medium text-foreground">Cấu hình khách hàng</span>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary-500/20 bg-primary-500/10 text-primary-500">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground-base">Cấu hình khách hàng</h1>
              <p className="mt-1 text-sm text-foreground-muted">
                Quản lý tích điểm, hạng thành viên và nhóm khách hàng để áp dụng chính sách giá phù hợp.
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/settings/inventory"
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-background-secondary px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary-500 hover:text-primary-500"
        >
          Cấu hình kho
          <ChevronRight size={16} />
        </Link>
      </div>

      <div data-hotkey-scope className="rounded-3xl border border-border/70 bg-background-secondary p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Trophy size={20} className="text-yellow-400" />
              Cấu hình tích điểm
            </div>
            <p className="mt-1 text-sm text-foreground-muted">
              Tùy chỉnh quy tắc tích điểm, hạng thẻ và ưu đãi theo nhóm.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForm(parseLoyaltyConfig(configs))}
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
          </div>
        </div>

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
      </div>

      <div data-hotkey-scope className="rounded-3xl border border-border/70 bg-background-secondary p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Tag size={20} className="text-primary-500" />
              Quản lý nhóm khách hàng
            </div>
            <p className="mt-1 text-sm text-foreground-muted">
              Phân loại khách hàng để áp dụng chính sách giá và chiết khấu.
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 xl:grid-cols-[1.4fr_1fr_140px_1.5fr_auto]">
          <input
            value={groupForm.name}
            onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Tên nhóm"
            className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
          />
          <input
            value={groupForm.pricePolicy}
            onChange={(event) => setGroupForm((current) => ({ ...current, pricePolicy: event.target.value }))}
            placeholder="Chính sách giá"
            className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
          />
          <input
            type="number"
            value={groupForm.discount}
            onChange={(event) => setGroupForm((current) => ({ ...current, discount: Number(event.target.value) }))}
            placeholder="Chiết khấu"
            className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
          />
          <input
            value={groupForm.description}
            onChange={(event) => setGroupForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Mô tả"
            className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
          />
          <button
            type="button"
            onClick={() => groupMutation.mutate(groupForm)}
            disabled={groupMutation.isPending || !groupForm.name.trim()}
            data-hotkey-enter
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {groupMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {groupForm.id ? 'Lưu nhóm' : 'Thêm nhóm'}
          </button>
        </div>

        <div className="mb-6 flex items-center gap-2">
          {GROUP_COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setGroupForm((current) => ({ ...current, color }))}
              className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-105 ${
                groupForm.color === color ? 'border-white' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-background/60">
              <tr className="border-b border-border/60">
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Nhóm</th>
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Chính sách giá</th>
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Chiết khấu</th>
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Mô tả</th>
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Mặc định</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-[0.12em] text-foreground-muted">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingGroups ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-foreground-muted">
                    <Loader2 size={18} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : customerGroups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-foreground-muted">
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
                    <td className="px-5 py-4 text-foreground">{group.pricePolicy}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-primary-500/10 px-3 py-1 text-sm font-semibold text-primary-400">
                        -{group.discount}%
                      </span>
                    </td>
                    <td className="px-5 py-4 text-foreground">{group.description || '—'}</td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setDefaultGroupMutation.mutate(group.id)}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                          group.isDefault ? 'bg-yellow-400/10 text-yellow-300' : 'text-foreground-muted hover:text-yellow-300'
                        }`}
                      >
                        <Star size={16} fill={group.isDefault ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setGroupForm({
                              id: group.id,
                              name: group.name,
                              color: group.color,
                              pricePolicy: group.pricePolicy,
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-background-secondary p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2 text-lg font-bold text-foreground">
          <Trophy size={18} className="text-yellow-400" />
          Top khách hàng theo điểm
        </div>

        <div className="space-y-4">
          {isLoadingTopCustomers ? (
            <div className="flex h-24 items-center justify-center text-foreground-muted">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : (
            topCustomers.map((customer: any, index: number) => (
              <div key={customer.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-background px-4 py-3">
                <div className="flex items-center gap-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400/15 text-sm font-bold text-yellow-300">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{customer.fullName}</div>
                    <div className="mt-0.5 text-sm text-foreground-muted">{customer.phone || '—'}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-yellow-300">{customer.points ?? 0} điểm</div>
                  <div className="mt-1">
                    <TierChip tier={(customer.tier || 'BRONZE') as LoyaltyTierRule['tier']} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
