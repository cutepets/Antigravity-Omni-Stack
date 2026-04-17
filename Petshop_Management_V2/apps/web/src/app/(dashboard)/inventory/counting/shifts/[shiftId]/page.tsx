'use client'
import Image from 'next/image';

import { use, useEffect, useState, useRef, KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Save,
  Send,
  XCircle,
  Package,
  Calculator,
  MapPin,
  Minus,
  Plus,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { stockCountApi } from '@/lib/api/stock-count.api'


function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString('vi-VN')
}

function safeCalc(expr: unknown): number | null {
  if (!expr || typeof expr !== 'string') return null
  const normalized = expr.replace(/[xX×]/g, '*').replace(/[^0-9+\-*/().]/g, '')
  if (!normalized) return null
  try {
    const result = Function('"use strict"; return (' + normalized + ')')()
    return typeof result === 'number' && isFinite(result) ? Math.round(result * 1000) / 1000 : null
  } catch {
    return null
  }
}

// Không cần calcInputWidth nữa — input tự mở rộng theo container

export default function ShiftCountingPage({ params }: { params: Promise<{ shiftId: string }> }) {
  const { shiftId } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [variances, setVariances] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [savedVariances, setSavedVariances] = useState<Record<string, string>>({})
  const [showQuickCalc, setShowQuickCalc] = useState(false)
  const [quickCalc, setQuickCalc] = useState<Record<string, string>>({})

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const { data: shiftResponse, isLoading } = useQuery({
    queryKey: ['stock-count-shift', shiftId],
    queryFn: () => stockCountApi.getShiftSession(shiftId),
  })

  const shift = (shiftResponse as any)?.data ?? null
  const items = shift?.items ?? []
  const branch = shift?.session?.branch ?? null

  useEffect(() => {
    const saved = localStorage.getItem(`quick-calc-${shiftId}`)
    if (saved) {
      try { setQuickCalc(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [shiftId])

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(`quick-calc-${shiftId}`, JSON.stringify(quickCalc))
    }, 500)
    return () => clearTimeout(timeout)
  }, [quickCalc, shiftId])

  useEffect(() => {
    if (!items.length) return
    const nextVariances: Record<string, string> = {}
    const nextSaved: Record<string, string> = {}
    const nextNotes: Record<string, string> = {}
    for (const item of items) {
      const val = item.variance === null || item.variance === undefined ? '' : String(item.variance)
      nextVariances[item.id] = val
      nextSaved[item.id] = val
      nextNotes[item.id] = item.notes ?? ''
    }
    setVariances(nextVariances)
    setSavedVariances(nextSaved)
    setNotes(nextNotes)
  }, [items])

  const submitCountMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { variance: number; notes?: string } }) =>
      stockCountApi.submitCountItem(itemId, data),
    onSuccess: (_, variables) => {
      setSavedVariances((prev) => ({ ...prev, [variables.itemId]: String(variables.data.variance) }))
      queryClient.invalidateQueries({ queryKey: ['stock-count-session'] })
      queryClient.invalidateQueries({ queryKey: ['stock-count-progress'] })
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => stockCountApi.completeShiftSession(shiftId),
    onSuccess: () => {
      alert('Ca kiểm đã được gửi quản lý duyệt.')
      router.push('/inventory/counting')
    },
  })

  const handleVarianceChange = (itemId: string, value: string) => {
    if (value === '' || /^-?\d+$/.test(value)) {
      setVariances((cur) => ({ ...cur, [itemId]: value }))
    }
  }

  const adjustVariance = (itemId: string, delta: 1 | -1) => {
    const cur = variances[itemId]
    const num = cur === '' || cur === undefined ? 0 : Number(cur)
    handleVarianceChange(itemId, String(num + delta))
  }

  const saveItem = async (itemId: string) => {
    const raw = variances[itemId]
    if (raw === '' || raw === undefined) return
    if (savedVariances[itemId] === raw) return
    try {
      await submitCountMutation.mutateAsync({
        itemId,
        data: { variance: Number(raw), notes: notes[itemId] },
      })
    } catch (err) {
      console.error('Failed to save item', itemId, err)
    }
  }

  const handleSaveAll = async () => {
    const dirty = items.filter(
      (item: any) => variances[item.id] !== '' && variances[item.id] !== savedVariances[item.id],
    )
    if (dirty.length === 0) return
    try {
      await Promise.all(
        dirty.map((item: any) =>
          submitCountMutation.mutateAsync({
            itemId: item.id,
            data: { variance: Number(variances[item.id]), notes: notes[item.id] },
          }),
        ),
      )
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Có lỗi khi lưu các thay đổi.'
      alert(Array.isArray(msg) ? msg.join('\n') : msg)
    }
  }

  const handleComplete = async () => {
    if (!items.every((item: any) => variances[item.id] !== '')) {
      alert('Vui lòng nhập chênh lệch cho toàn bộ sản phẩm trước khi hoàn thành ca.')
      return
    }
    if (items.some((item: any) => variances[item.id] !== '' && variances[item.id] !== savedVariances[item.id])) {
      alert('Bạn đang có dữ liệu chưa lưu! Vui lòng nhấn "Lưu tất cả" trước khi hoàn thành.')
      return
    }
    if (!confirm('Xác nhận hoàn thành ca kiểm này?')) return
    try {
      await completeMutation.mutateAsync()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Không thể hoàn thành ca kiểm này.'
      alert(Array.isArray(msg) ? msg.join('\n') : msg)
    }
  }

  // ↑↓ chuyển dòng · ←/→ luôn tăng/giảm số (bỏ hẳn di chuyển con trỏ) · Enter lưu & xuống
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>, idx: number, itemId: string) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      inputRefs.current[idx + 1]?.focus()
      inputRefs.current[idx + 1]?.select()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      inputRefs.current[idx - 1]?.focus()
      inputRefs.current[idx - 1]?.select()
    } else if (e.key === 'ArrowRight') {
      // Luôn tăng số, không di chuyển con trỏ
      e.preventDefault()
      adjustVariance(itemId, 1)
    } else if (e.key === 'ArrowLeft') {
      // Luôn giảm số, không di chuyển con trỏ
      e.preventDefault()
      adjustVariance(itemId, -1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      saveItem(itemId)
      inputRefs.current[idx + 1]?.focus()
      inputRefs.current[idx + 1]?.select()
    }
  }

  if (isLoading) return <div className="p-8 text-center text-foreground-muted">Đang tải ca kiểm...</div>
  if (!shift) return <div className="p-8 text-center text-error">Không tìm thấy ca kiểm</div>

  const completedCount = items.filter((item: any) => variances[item.id] !== '').length
  const dirtyCount = items.filter(
    (item: any) => variances[item.id] !== '' && variances[item.id] !== savedVariances[item.id],
  ).length

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">{shift.shiftLabel ?? shift.shift}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground-muted">
            <span>Ngày kiểm: {shift.countDate ? formatDate(shift.countDate) : '—'}</span>
            {shift.counter?.fullName && <span>· Người kiểm: <strong className="text-foreground">{shift.counter.fullName}</strong></span>}
            {branch && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-2.5 py-0.5 text-xs font-semibold text-primary-600">
                <MapPin size={11} />
                {branch.name}{branch.code ? ` (${branch.code})` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowQuickCalc((v) => !v)}
            className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
              showQuickCalc
                ? 'border-primary-500 bg-primary-500/10 text-primary-600'
                : 'border-border bg-card text-foreground hover:bg-background-secondary'
            }`}
          >
            <Calculator size={15} />
            {showQuickCalc ? 'Ẩn tính nhanh' : 'Tính nhanh'}
          </button>

          <button
            onClick={handleSaveAll}
            disabled={submitCountMutation.isPending || shift.status !== 'DRAFT' || dirtyCount === 0}
            className="relative inline-flex h-9 items-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            <Save size={15} /> Lưu tất cả
            {dirtyCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                {dirtyCount}
              </span>
            )}
          </button>

          <button
            onClick={handleComplete}
            disabled={completeMutation.isPending || shift.status !== 'DRAFT'}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:opacity-50"
          >
            <Send size={15} /> Hoàn thành ca
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{items.length}</div>
          <div className="text-xs text-foreground-muted">Tổng dòng hàng</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-500">{completedCount}</div>
          <div className="text-xs text-foreground-muted">Đã nhập chênh lệch</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-amber-500">{items.length - completedCount}</div>
          <div className="text-xs text-foreground-muted">Còn lại</div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl border border-border bg-card overflow-x-auto pb-4">
        <table className="w-full min-w-max">
          <thead className="border-b border-border bg-background-secondary text-xs font-semibold uppercase text-foreground-muted">
            <tr>
              <th className="px-3 py-3 text-center">Ảnh</th>
              <th className="px-3 py-3 text-left">Mã SP</th>
              <th className="px-3 py-3 text-left">Tên sản phẩm</th>
              {showQuickCalc && (
                <>
                  {/* w-0 + min-w để browser không tự stretch — kết hợp overflow-hidden trên td */}
                  <th className="border-l border-border bg-primary-500/5 py-3 pl-2 pr-1 text-left" style={{ width: '1px' }}>Tính nhanh</th>
                  <th className="border-r border-border bg-primary-500/5 px-2 py-3 text-right" style={{ width: '52px' }}>KQ</th>
                </>
              )}
              <th className="px-3 py-3 text-right">Hệ thống</th>
              <th className="px-3 py-3 text-center">Chênh lệch</th>
              <th className="px-3 py-3 text-right">Thực tế</th>
              <th className="px-3 py-3 text-left">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => {
              const varianceValue = variances[item.id]
              const isDirty = varianceValue !== '' && varianceValue !== savedVariances[item.id]
              const parsedVariance = varianceValue === '' || varianceValue === undefined ? null : Number(varianceValue)
              const actualQuantity = parsedVariance === null ? null : Math.max(0, (item.systemQuantity ?? 0) + parsedVariance)
              const sysQty = item.systemQuantity ?? 0
              const isLargeVariance = sysQty > 0 && parsedVariance !== null && Math.abs(parsedVariance) / sysQty > 0.1

              let varianceTone = 'text-foreground-muted'
              if (parsedVariance !== null) {
                varianceTone = parsedVariance === 0 ? 'text-emerald-600' : parsedVariance > 0 ? 'text-amber-600' : 'text-red-600'
              }

              const productImgUrl = item.variant?.image ?? item.product?.image
              const expr = quickCalc[item.id] ?? ''
              const calcResult = safeCalc(expr)
              const canEdit = shift.status === 'DRAFT'

              return (
                <tr
                  key={item.id}
                  className={`border-b transition-colors hover:bg-background-secondary/40 ${
                    isDirty ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/50'
                  } ${isLargeVariance && !isDirty ? 'bg-red-500/5' : ''}`}
                >
                  {/* Ảnh */}
                  <td className="px-3 py-2">
                    <div className="relative group/imgcell mx-auto flex h-8 w-8 shrink-0 items-center justify-center rounded bg-background-secondary">
                      {productImgUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <Image src={productImgUrl} alt="" className="h-8 w-8 rounded object-cover" width={400} height={400} unoptimized />
                          <div className="pointer-events-none absolute left-10 top-0 z-50 hidden group-hover/imgcell:block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <Image src={productImgUrl} alt="" className="h-44 w-44 max-w-none rounded-xl border-2 border-border bg-card object-cover shadow-2xl" width={400} height={400} unoptimized />
                          </div>
                        </>
                      ) : (
                        <Package size={16} className="text-foreground-muted" />
                      )}
                    </div>
                  </td>

                  {/* Mã */}
                  <td className="px-3 py-2">
                    <span className="rounded-md bg-primary-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary-500">
                      {item.variant?.sku ?? item.product?.sku ?? '—'}
                    </span>
                  </td>

                  {/* Tên */}
                  <td className="px-3 py-2 min-w-[180px]">
                    <div className="font-medium text-foreground leading-tight">{item.product?.name ?? 'Sản phẩm'}</div>
                    {item.variant?.name && <div className="text-xs text-foreground-muted">↳ {item.variant.name}</div>}
                  </td>

                  {/* Tính nhanh */}
                  {showQuickCalc && (
                    <>
                      {/* overflow-hidden + w-px để cột co nhỏ, input mở rộng theo nội dung bên trong */}
                      <td className="border-l border-border bg-primary-500/5 px-1 py-2" style={{ width: '1px' }}>
                        <input
                          type="text"
                          value={expr}
                          onChange={(e) => setQuickCalc((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          size={Math.max(7, (expr || '').length + 1)}
                          className="block rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:border-primary-500 focus:outline-none"
                          disabled={!canEdit}
                        />
                      </td>
                      <td className={`border-r border-border bg-primary-500/5 px-2 py-2 text-right font-mono text-sm font-semibold tabular-nums ${calcResult !== null ? 'text-primary-600' : 'text-foreground-muted'}`} style={{ width: '52px' }}>
                        {calcResult !== null ? calcResult : '—'}
                      </td>
                    </>
                  )}

                  {/* Hệ thống */}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                    {item.systemQuantity ?? 0}
                  </td>

                  {/* Chênh lệch — POS-style +/- control */}
                  <td className="px-3 py-2">
                    <div
                      className={`flex items-center rounded-lg overflow-hidden h-8 transition-colors w-fit mx-auto ${
                        isDirty
                          ? 'border border-amber-500 bg-amber-500/5'
                          : 'border border-border bg-background focus-within:border-primary-500'
                      }`}
                    >
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={!canEdit}
                        onClick={() => adjustVariance(item.id, -1)}
                        className="flex h-full items-center justify-center px-2 text-foreground-muted transition-colors hover:bg-background-secondary disabled:opacity-40"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        ref={(el) => { inputRefs.current[idx] = el }}
                        type="text"
                        inputMode="numeric"
                        value={varianceValue ?? ''}
                        onChange={(e) => handleVarianceChange(item.id, e.target.value)}
                        onKeyDown={(e) => handleInputKeyDown(e, idx, item.id)}
                        onBlur={() => saveItem(item.id)}
                        className={`w-14 border-none bg-transparent text-center text-sm font-bold text-foreground outline-none ${isDirty ? 'text-amber-700' : ''}`}
                        placeholder="0"
                        disabled={!canEdit}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={!canEdit}
                        onClick={() => adjustVariance(item.id, 1)}
                        className="flex h-full items-center justify-center px-2 text-foreground-muted transition-colors hover:bg-background-secondary disabled:opacity-40"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </td>

                  {/* Thực tế */}
                  <td className={`px-3 py-2 text-right font-bold tabular-nums ${varianceTone}`}>
                    {parsedVariance === null ? (
                      <span className="text-foreground-muted">—</span>
                    ) : (
                      <span className="inline-flex items-center justify-end gap-1">
                        {parsedVariance === 0 && <CheckCircle2 size={13} className="shrink-0" />}
                        {parsedVariance > 0 && <AlertTriangle size={13} className="shrink-0" />}
                        {parsedVariance < 0 && <XCircle size={13} className="shrink-0" />}
                        {actualQuantity}
                      </span>
                    )}
                  </td>

                  {/* Ghi chú */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={notes[item.id] ?? ''}
                      onChange={(e) => setNotes((cur) => ({ ...cur, [item.id]: e.target.value }))}
                      onBlur={() => saveItem(item.id)}
                      className="w-full min-w-[110px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary-500 focus:outline-none"
                      placeholder="Ghi chú..."
                      disabled={!canEdit}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-foreground-muted text-right">
        💡 <strong>↑↓</strong> chuyển dòng &nbsp;·&nbsp; <strong>←→</strong> tăng/giảm chênh lệch &nbsp;·&nbsp; <strong>Enter</strong> lưu &amp; xuống dòng
      </div>
    </div>
  )
}