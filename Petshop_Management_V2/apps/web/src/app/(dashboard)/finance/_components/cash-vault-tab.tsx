'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownToLine, Banknote, RefreshCw, WalletCards, X } from 'lucide-react'
import { toast } from 'sonner'
import { shiftApi, type CashVaultBranchSummary, type CashVaultEntry, type CashVaultEntryType } from '@/lib/api/shift.api'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useAuthStore } from '@/stores/auth.store'

const DEFAULT_RESERVE_AMOUNT = 2_000_000

function todayString() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function firstDayOfMonth() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN')
}

function parseAmount(value: string) {
  const parsed = Number(value.replace(/\D/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function entryTypeLabel(type: CashVaultEntryType) {
  if (type === 'SHIFT_CLOSE') return 'Chốt ca'
  if (type === 'VAULT_COLLECTION') return 'Thu két'
  return 'Điều chỉnh'
}

function entryTypeClass(type: CashVaultEntryType) {
  if (type === 'SHIFT_CLOSE') return 'border-sky-500/25 bg-sky-500/10 text-sky-300'
  if (type === 'VAULT_COLLECTION') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
  return 'border-amber-500/25 bg-amber-500/10 text-amber-300'
}

function getBranchInitials(name?: string | null) {
  return (name ?? 'CN')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CN'
}

type VaultCollectionModalProps = {
  branch: CashVaultBranchSummary | null
  isOpen: boolean
  onClose: () => void
}


function VaultCollectionModal({ branch, isOpen, onClose }: VaultCollectionModalProps) {
  const queryClient = useQueryClient()
  const [actualCashBefore, setActualCashBefore] = useState('')
  const [targetReserveAmount, setTargetReserveAmount] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!isOpen || !branch) return
    const currentCash = Math.round(branch.currentCashAmount || 0)
    const targetReserve = Math.round(branch.targetReserveAmount || DEFAULT_RESERVE_AMOUNT)
    setActualCashBefore(String(currentCash))
    setTargetReserveAmount(String(targetReserve))
    setAmount(String(Math.max(0, branch.pendingAmount || 0)))
    setNote('')
  }, [branch, isOpen])

  const collectVault = useMutation({
    mutationFn: () => {
      if (!branch) throw new Error('Missing branch')
      return shiftApi.collectVault({
        branchId: branch.branchId,
        actualCashBefore: parseAmount(actualCashBefore),
        targetReserveAmount: parseAmount(targetReserveAmount),
        amount: parseAmount(amount),
        note,
      })
    },
    onSuccess: () => {
      toast.success('Đã ghi nhận thu tiền két')
      queryClient.invalidateQueries({ queryKey: ['finance', 'cash-vault'] })
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Không thể thu tiền két')
    },
  })

  if (!isOpen || !branch) return null

  const beforeAmount = parseAmount(actualCashBefore)
  const reserveAmount = parseAmount(targetReserveAmount)
  const collectAmount = parseAmount(amount)
  const cashAfterAmount = Math.max(0, beforeAmount - collectAmount)
  const pendingAfterAmount = Math.max(0, (branch.pendingAmount || 0) - collectAmount)
  const shortageAfterAmount = Math.max(0, reserveAmount - cashAfterAmount)

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 bg-background-secondary/70 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Thu tiền két</h3>
            <p className="text-sm text-foreground-muted">{branch.branchName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-foreground-muted hover:bg-white/10 hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-foreground-muted">Tiền thực tế trong két</span>
              <input
                value={actualCashBefore ? formatCurrency(parseAmount(actualCashBefore)) : ''}
                onChange={(event) => setActualCashBefore(event.target.value)}
                className="w-full rounded-xl border border-border bg-background-secondary px-3 py-2 text-foreground outline-none focus:border-primary-500"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-foreground-muted">Tiền để lại két</span>
              <input
                value={targetReserveAmount ? formatCurrency(parseAmount(targetReserveAmount)) : ''}
                onChange={(event) => setTargetReserveAmount(event.target.value)}
                className="w-full rounded-xl border border-border bg-background-secondary px-3 py-2 text-foreground outline-none focus:border-primary-500"
              />
            </label>
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-foreground-muted">Số tiền thu</span>
            <input
              value={amount ? formatCurrency(parseAmount(amount)) : ''}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-xl border border-border bg-background-secondary px-3 py-2 text-foreground outline-none focus:border-primary-500"
            />
          </label>

          <div className="grid gap-2 rounded-2xl border border-border/60 bg-background-secondary/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-muted">Tiền còn lại sau thu</span>
              <strong className="text-foreground">{formatCurrency(cashAfterAmount)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Còn chờ thu sau thu</span>
              <strong className="text-emerald-300">{formatCurrency(pendingAfterAmount)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Thiếu mức để lại</span>
              <strong className={shortageAfterAmount > 0 ? 'text-amber-300' : 'text-foreground'}>{formatCurrency(shortageAfterAmount)}</strong>
            </div>
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-foreground-muted">Ghi chú</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background-secondary px-3 py-2 text-foreground outline-none focus:border-primary-500"
              placeholder="Ví dụ: thu gộp 3 ngày, để lại 1.500.000 vì ca trước chi nhiều..."
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/60 bg-background-secondary/40 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-foreground-muted hover:bg-white/10">
            Hủy
          </button>
          <button
            type="button"
            disabled={collectVault.isPending || collectAmount <= 0}
            onClick={() => collectVault.mutate()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2 text-sm font-bold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowDownToLine size={16} />
            {collectVault.isPending ? 'Đang lưu...' : 'Thu tiền két'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CashVaultTab() {
  const activeBranchId = useAuthStore((state) => state.activeBranchId)
  const { allowedBranches, hasRole, isAdminOrManager } = useAuthorization()
  const canCollect = isAdminOrManager() || hasRole(['SUPER_ADMIN', 'ADMIN'])
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth())
  const [dateTo, setDateTo] = useState(todayString())
  const [selectedBranchId, setSelectedBranchId] = useState(activeBranchId ?? allowedBranches[0]?.id ?? '')
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false)

  const summaryQuery = useQuery({
    queryKey: ['finance', 'cash-vault', 'summary', dateFrom, dateTo],
    queryFn: () => shiftApi.vaultSummary({ dateFrom, dateTo }),
  })

  const branchSummaries = useMemo(() => summaryQuery.data?.branches ?? [], [summaryQuery.data?.branches])

  useEffect(() => {
    if (selectedBranchId && branchSummaries.some((branch) => branch.branchId === selectedBranchId)) return
    const fallbackBranchId =
      branchSummaries.find((branch) => branch.branchId === activeBranchId)?.branchId ??
      branchSummaries[0]?.branchId ??
      activeBranchId ??
      allowedBranches[0]?.id ??
      ''
    setSelectedBranchId(fallbackBranchId)
  }, [activeBranchId, allowedBranches, branchSummaries, selectedBranchId])

  const selectedBranch = branchSummaries.find((branch) => branch.branchId === selectedBranchId) ?? null

  const ledgerQuery = useQuery({
    queryKey: ['finance', 'cash-vault', 'ledger', selectedBranchId, dateFrom, dateTo],
    queryFn: () =>
      shiftApi.vaultLedger({
        branchId: selectedBranchId,
        dateFrom,
        dateTo,
        limit: 100,
      }),
    enabled: Boolean(selectedBranchId),
  })

  const entries = useMemo(() => ledgerQuery.data?.entries ?? [], [ledgerQuery.data?.entries])

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid shrink-0 gap-3 lg:grid-cols-4">
          {[
            { label: 'Tiền trong két', value: summaryQuery.data?.totalCurrentCashAmount ?? 0, icon: WalletCards, tone: 'text-primary-300' },
            { label: 'Chờ thu', value: summaryQuery.data?.totalPendingAmount ?? 0, icon: Banknote, tone: 'text-emerald-300' },
            { label: 'Đã thu trong kỳ', value: summaryQuery.data?.totalCollectedAmount ?? 0, icon: ArrowDownToLine, tone: 'text-sky-300' },
            { label: 'Thiếu mức để lại', value: summaryQuery.data?.totalReserveShortageAmount ?? 0, icon: AlertTriangle, tone: 'text-amber-300' },
          ].map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="rounded-2xl border border-border bg-card/95 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-foreground-muted">{card.label}</p>
                  <Icon size={18} className={card.tone} />
                </div>
                <p className={`mt-3 text-2xl font-semibold ${card.tone}`}>{formatCurrency(card.value)}</p>
              </div>
            )
          })}
        </div>

        <div className="shrink-0 rounded-2xl border border-border bg-card/95 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-foreground">Chọn nhanh chi nhánh</h3>
              <p className="text-sm text-foreground-muted">Theo dõi riêng từng két và thu tiền khi cần.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="rounded-xl border border-border bg-background-secondary px-3 py-2 text-sm text-foreground outline-none"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="rounded-xl border border-border bg-background-secondary px-3 py-2 text-sm text-foreground outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  summaryQuery.refetch()
                  ledgerQuery.refetch()
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground-muted hover:text-foreground"
              >
                <RefreshCw size={16} className={summaryQuery.isFetching || ledgerQuery.isFetching ? 'animate-spin' : ''} />
                Tải lại
              </button>
              {canCollect ? (
                <button
                  type="button"
                  disabled={!selectedBranch}
                  onClick={() => setIsCollectModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowDownToLine size={16} />
                  Thu tiền két
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {branchSummaries.map((branch) => {
              const isActive = branch.branchId === selectedBranchId
              return (
                <button
                  key={branch.branchId}
                  type="button"
                  onClick={() => setSelectedBranchId(branch.branchId)}
                  className={`min-w-[190px] rounded-2xl border p-3 text-left transition-colors ${
                    isActive
                      ? 'border-primary-500/50 bg-primary-500/12 text-primary-100'
                      : 'border-border/70 bg-background-secondary text-foreground-muted hover:border-border hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-xs font-black">{getBranchInitials(branch.branchName)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{branch.branchName}</p>
                      <p className="text-xs opacity-80">Chờ thu {formatCurrency(branch.pendingAmount)}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {selectedBranch ? (
          <div className="grid shrink-0 gap-3 md:grid-cols-4">
            {[
              { label: 'Két hiện tại', value: selectedBranch.currentCashAmount, tone: 'text-foreground' },
              { label: 'Mức để lại', value: selectedBranch.targetReserveAmount, tone: 'text-primary-300' },
              { label: 'Chờ thu', value: selectedBranch.pendingAmount, tone: 'text-emerald-300' },
              { label: 'Thiếu để lại', value: selectedBranch.reserveShortageAmount, tone: selectedBranch.reserveShortageAmount > 0 ? 'text-amber-300' : 'text-foreground' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-border bg-card/95 p-4">
                <p className="text-sm text-foreground-muted">{item.label}</p>
                <p className={`mt-2 text-xl font-bold ${item.tone}`}>{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card/95">
          <table className="w-full min-w-[1320px] text-left text-sm">
            <thead className="sticky top-0 bg-background-secondary text-xs uppercase text-foreground-muted">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Loại dòng</th>
                <th className="px-4 py-3">Người thực hiện</th>
                <th className="px-4 py-3 text-right">Két trước</th>
                <th className="px-4 py-3 text-right">Phát sinh</th>
                <th className="px-4 py-3 text-right">Bán được</th>
                <th className="px-4 py-3 text-right">Bù két</th>
                <th className="px-4 py-3 text-right">Thực rút</th>
                <th className="px-4 py-3 text-right">Thu tiền</th>
                <th className="px-4 py-3 text-right">Két sau</th>
                <th className="px-4 py-3 text-right">Chờ thu</th>
                <th className="px-4 py-3 text-right">Thiếu để lại</th>
                <th className="px-4 py-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {ledgerQuery.isLoading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-foreground-muted">Đang tải timeline thu két...</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-foreground-muted">Chưa có dòng tiền két trong khoảng thời gian này.</td>
                </tr>
              ) : (
                entries.map((entry: CashVaultEntry) => (
                  <tr key={entry.id} className="border-t border-border/70 hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{formatDateTime(entry.occurredAt)}</div>
                      {entry.shiftStaffName ? <div className="text-xs text-foreground-muted">Ca: {entry.shiftStaffName}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${entryTypeClass(entry.entryType)}`}>
                        {entryTypeLabel(entry.entryType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">{entry.performedByName ?? entry.shiftStaffName ?? '-'}</td>
                    <td className="px-4 py-3 text-right">{entry.cashBeforeAmount === null || entry.cashBeforeAmount === undefined ? '-' : formatCurrency(entry.cashBeforeAmount)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${entry.deltaAmount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {entry.deltaAmount >= 0 ? '+' : ''}
                      {formatCurrency(entry.deltaAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-sky-300">{entry.entryType === 'SHIFT_CLOSE' ? formatCurrency(entry.netCashAmount) : '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-300">{entry.entryType === 'SHIFT_CLOSE' ? formatCurrency(entry.reserveTopUpAmount) : '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-300">{entry.entryType === 'SHIFT_CLOSE' ? formatCurrency(entry.withdrawableAmount) : '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-sky-300">{entry.collectedAmount > 0 ? formatCurrency(entry.collectedAmount) : '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{formatCurrency(entry.cashAfterAmount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-300">{formatCurrency(entry.pendingAmount)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${entry.reserveShortageAmount > 0 ? 'text-amber-300' : 'text-foreground-muted'}`}>
                      {formatCurrency(entry.reserveShortageAmount)}
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-foreground-muted">
                      <div className="line-clamp-2">{entry.note ?? (entry.entryType === 'SHIFT_CLOSE' ? 'Tự động ghi nhận khi chốt ca' : '-')}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VaultCollectionModal branch={selectedBranch} isOpen={isCollectModalOpen} onClose={() => setIsCollectModalOpen(false)} />
    </>
  )
}
