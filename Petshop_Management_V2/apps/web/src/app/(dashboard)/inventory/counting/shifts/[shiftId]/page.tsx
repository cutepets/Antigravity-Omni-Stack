'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, AlertTriangle, XCircle, Save, Send, Package } from 'lucide-react'
import { stockCountApi } from '@/lib/api/stock-count.api'
import { useRouter } from 'next/navigation'

export default function ShiftCountingPage({ params }: { params: { shiftId: string } }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  const { data: shiftData, isLoading } = useQuery({
    queryKey: ['stock-count-shift', params.shiftId],
    queryFn: () => stockCountApi.getShiftSession(params.shiftId),
  })

  const shift = (shiftData as any)?.data ?? null
  const items = shift?.items ?? []

  const submitCountMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { countedQuantity: number; notes?: string } }) =>
      stockCountApi.submitCountItem(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-count-shift', params.shiftId] })
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => stockCountApi.completeShiftSession(params.shiftId),
    onSuccess: () => {
      alert('Ca kiểm đã hoàn thành!')
      router.push('/inventory/counting')
    },
  })

  const handleCountChange = (itemId: string, value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 0) {
      setCounts((prev) => ({ ...prev, [itemId]: num }))
    }
  }

  const handleNoteChange = (itemId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [itemId]: value }))
  }

  const handleSave = async (itemId: string) => {
    const countedQuantity = counts[itemId]
    if (countedQuantity === undefined || countedQuantity === null) return

    await submitCountMutation.mutateAsync({
      itemId,
      data: {
        countedQuantity,
        notes: notes[itemId],
      },
    })
  }

  const handleComplete = async () => {
    const allCounted = items.every((item: any) => counts[item.id] !== undefined && counts[item.id] !== null)
    if (!allCounted) {
      alert('Vui lòng kiểm hết tất cả sản phẩm trước khi hoàn thành!')
      return
    }

    if (!confirm('Xác nhận hoàn thành ca kiểm này?')) return

    await completeMutation.mutateAsync()
  }

  if (isLoading) {
    return <div className="p-8 text-center text-foreground-muted">Đang tải...</div>
  }

  if (!shift) {
    return <div className="p-8 text-center text-error">Không tìm thấy ca kiểm</div>
  }

  const shiftLabel = shift.shift?.replace('_', ' | Ca ') ?? ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{shiftLabel}</h2>
          <p className="text-sm text-foreground-muted">
            Ngày kiểm: {shift.countDate ? new Date(shift.countDate).toLocaleDateString('vi-VN') : '—'}
            {shift.counter && ` · Người kiểm: ${shift.counter.fullName}`}
          </p>
        </div>
        <button
          onClick={handleComplete}
          disabled={completeMutation.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          <Send size={16} /> Hoàn thành ca
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{items.length}</div>
          <div className="text-xs text-foreground-muted">Tổng sản phẩm</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-500">
            {Object.keys(counts).length}
          </div>
          <div className="text-xs text-foreground-muted">Đã kiểm</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-amber-500">
            {items.length - Object.keys(counts).length}
          </div>
          <div className="text-xs text-foreground-muted">Còn lại</div>
        </div>
      </div>

      {/* Count Table */}
      <div className="rounded-2xl border border-border bg-card">
        <table className="w-full">
          <thead className="border-b border-border bg-background-secondary text-xs font-semibold uppercase text-foreground-muted">
            <tr>
              <th className="px-4 py-3 text-left">Mã SP</th>
              <th className="px-4 py-3 text-left">Tên sản phẩm</th>
              <th className="px-4 py-3 text-right">Hệ thống</th>
              <th className="px-4 py-3 text-right">Thực tế</th>
              <th className="px-4 py-3 text-right">Chênh lệch</th>
              <th className="px-4 py-3 text-left">Ghi chú</th>
              <th className="px-4 py-3 text-center">Lưu</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => {
              const counted = counts[item.id] ?? item.countedQuantity
              const systemQty = item.systemQuantity ?? 0
              const variance = counted !== undefined && counted !== null ? counted - systemQty : null
              const varianceTone = variance === null ? '' : variance === 0 ? 'text-emerald-600' : variance > 0 ? 'text-amber-600' : 'text-red-600'

              return (
                <tr key={item.id} className="border-b border-border/50 transition-colors hover:bg-background-secondary/40">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-md">
                      {item.product?.sku ?? item.variant?.sku ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{item.product?.name ?? item.variant?.name ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {systemQty}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      value={counted ?? ''}
                      onChange={(e) => handleCountChange(item.id, e.target.value)}
                      className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-right text-sm font-semibold text-foreground focus:border-primary-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${varianceTone}`}>
                    {variance !== null && variance !== undefined ? (
                      <span className="inline-flex items-center gap-1">
                        {variance === 0 && <CheckCircle2 size={14} />}
                        {variance > 0 && <AlertTriangle size={14} />}
                        {variance < 0 && <XCircle size={14} />}
                        {variance > 0 ? `+${variance}` : variance}
                      </span>
                    ) : (
                      <span className="text-foreground-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={notes[item.id] ?? item.notes ?? ''}
                      onChange={(e) => handleNoteChange(item.id, e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary-500 focus:outline-none"
                      placeholder="Ghi chú..."
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleSave(item.id)}
                      disabled={counted === undefined || counted === null}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary-500 px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-30"
                    >
                      <Save size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
