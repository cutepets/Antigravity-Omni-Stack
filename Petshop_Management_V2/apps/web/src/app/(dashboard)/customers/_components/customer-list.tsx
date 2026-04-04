'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Plus, Pencil, Trash2,
  Download, Upload, ExternalLink, BadgeCheck, AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { customerApi, type ImportCustomerRow } from '@/lib/api/customer.api'
import { CustomerFormModal } from './customer-form-modal'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import type { Customer } from '@petshop/shared'

// ── Tier Badge ─────────────────────────────────────────────────────────────────
const TIER_BADGE: Record<string, string> = {
  BRONZE:  'badge badge-warning',
  SILVER:  'badge badge-gray',
  GOLD:    'badge badge-accent',
  DIAMOND: 'badge badge-info',
}
const TIER_LABEL: Record<string, { label: string; icon: string }> = {
  BRONZE:  { label: 'Đồng',      icon: '🥉' },
  SILVER:  { label: 'Bạc',       icon: '🥈' },
  GOLD:    { label: 'Vàng',      icon: '🥇' },
  DIAMOND: { label: 'Kim cương', icon: '💎' },
}

function TierBadge({ tier }: { tier: string }) {
  const t = TIER_LABEL[tier] ?? TIER_LABEL.BRONZE
  const cls = TIER_BADGE[tier] ?? TIER_BADGE.BRONZE
  return <span className={cls}>{t.icon} {t.label}</span>
}

// ── CSV export helper ──────────────────────────────────────────────────────────
function downloadCSV(data: any[], filename: string) {
  const headers = ['Mã KH', 'Họ tên', 'SĐT', 'Email', 'Địa chỉ', 'Hạng', 'Điểm', 'Tổng chi tiêu', 'Số đơn', 'Ngày tạo']
  const rows = data.map(c => [
    c.customerCode, c.fullName, c.phone, c.email ?? '',
    c.address ?? '', c.tier, c.points ?? 0, c.totalSpent ?? 0,
    c.totalOrders ?? 0,
    c.createdAt ? new Date(c.createdAt).toLocaleDateString('vi-VN') : '',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Main component ─────────────────────────────────────────────────────────────
export function CustomerList() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [tier, setTier] = useState('')
  const [isActiveFilter, setIsActiveFilter] = useState('')
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, tier, isActiveFilter, page],
    queryFn: () => customerApi.getCustomers({
      search,
      tier: tier || undefined,
      isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
      page,
      limit: 15,
    }),
  })

  const deleteMutation = useMutation({
    mutationFn: customerApi.deleteCustomer,
    onSuccess: () => {
      toast.success('Đã xoá khách hàng')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Không thể xoá khách hàng này'
      toast.error(msg)
    },
  })

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await customerApi.exportCustomers({
        tier: tier || undefined,
        isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
      })
      downloadCSV(res.data, `khach-hang-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success(`Đã export ${res.data.length} khách hàng`)
    } catch {
      toast.error('Lỗi export dữ liệu')
    } finally {
      setIsExporting(false)
    }
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    try {
      const text = await file.text()
      const lines = text.replace(/\r/g, '').split('\n').filter(Boolean)
      const rows: ImportCustomerRow[] = lines.slice(1).map(line => {
        const cols = line.match(/(\".*?\"|[^,]+)/g)?.map(c => c.replace(/^\"|\"$/g, '').trim()) ?? []
        return { customerCode: cols[0] || '', fullName: cols[1] || '', phone: cols[2] || '', email: cols[3] || '', address: cols[4] || '', tier: cols[5] || 'BRONZE' }
      }).filter(r => r.fullName)

      if (!rows.length) { toast.error('File không có dữ liệu hợp lệ'); return }
      const res = await customerApi.importCustomers(rows)
      const { created, updated, errors } = res.data
      toast.success(`Import xong: ${created} tạo mới, ${updated} cập nhật${errors.length ? ` (${errors.length} lỗi)` : ''}`)
      if (errors.length) console.warn('Import errors:', errors)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi import file')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = (c: Customer) => {
    if (window.confirm(`Xoá khách hàng "${c.fullName}"?\n\nHệ thống sẽ kiểm tra trước khi xoá.`)) {
      deleteMutation.mutate(c.id)
    }
  }

  // ── Data ────────────────────────────────────────────────────────────────────
  const customers = (data as any)?.data ?? []
  const total = (data as any)?.total ?? 0
  const totalPages = (data as any)?.totalPages ?? 1

  return (
    <div className="card overflow-hidden p-0">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border flex-wrap">

        {/* Filters */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              placeholder="Tìm theo tên, SĐT, mã KH..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="form-input pl-9"
            />
          </div>
          {/* Tier filter */}
          <select
            value={tier}
            onChange={e => { setTier(e.target.value); setPage(1) }}
            className="form-input w-auto min-w-[140px]"
          >
            <option value="">Tất cả hạng</option>
            <option value="BRONZE">🥉 Đồng</option>
            <option value="SILVER">🥈 Bạc</option>
            <option value="GOLD">🥇 Vàng</option>
            <option value="DIAMOND">💎 Kim cương</option>
          </select>
          {/* Active filter */}
          <select
            value={isActiveFilter}
            onChange={e => { setIsActiveFilter(e.target.value); setPage(1) }}
            className="form-input w-auto min-w-[160px]"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">✅ Hoạt động</option>
            <option value="false">🚫 Vô hiệu hoá</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn-outline h-9 px-4 rounded-xl text-sm"
          >
            <Download size={15} /> {isExporting ? 'Đang xuất...' : 'Export'}
          </button>

          <label className="btn-outline h-9 px-4 rounded-xl text-sm cursor-pointer">
            <Upload size={15} /> {isImporting ? 'Đang nhập...' : 'Import'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportFile}
              disabled={isImporting}
            />
          </label>

          <button
            onClick={() => { setEditingCustomer(null); setIsModalOpen(true) }}
            className="btn-primary liquid-button h-9 px-4 rounded-xl text-sm"
          >
            <Plus size={15} /> Thêm khách hàng
          </button>
        </div>
      </div>

      {/* ── Summary bar ── */}
      <div className="px-4 py-2 bg-background-tertiary border-b border-border text-xs text-foreground-muted">
        Tổng <strong className="text-foreground">{total}</strong> khách hàng
        {search && <span> · tìm kiếm "<em>{search}</em>"</span>}
      </div>

      {/* ── Table ── */}
      <div className="w-full overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {['Mã KH', 'Khách hàng', 'Liên hệ', 'Hạng / Điểm', 'Chi tiêu', 'Trạng thái', 'Thao tác'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-foreground-muted text-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-6 w-6 rounded-full border-2 border-border border-t-primary-500 animate-spin" />
                    Đang tải dữ liệu...
                  </div>
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-foreground-muted">
                    <Search size={32} className="opacity-30" />
                    <p className="text-sm">Không tìm thấy khách hàng nào</p>
                    {search && <p className="text-xs">Thử xoá bộ lọc hoặc đổi từ khoá</p>}
                  </div>
                </td>
              </tr>
            ) : (
              customers.map((c: any) => (
                <tr key={c.id}>
                  {/* Mã KH */}
                  <td>
                    <span className="font-mono text-xs font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-md">
                      {c.customerCode}
                    </span>
                  </td>

                  {/* Họ tên */}
                  <td>
                    <div
                      onClick={() => router.push(`/customers/${c.id}`)}
                      className="flex items-center gap-1.5 font-semibold text-foreground cursor-pointer hover:text-primary-500 transition-colors"
                    >
                      {c.fullName}
                      <ExternalLink size={11} className="text-foreground-muted" />
                    </div>
                    {c.notes && (
                      <div className="text-xs text-foreground-muted mt-0.5 truncate max-w-[180px]">{c.notes}</div>
                    )}
                  </td>

                  {/* Liên hệ */}
                  <td>
                    <div className="text-sm font-medium text-foreground">{c.phone}</div>
                    {c.email && <div className="text-xs text-foreground-muted mt-0.5">{c.email}</div>}
                  </td>

                  {/* Hạng / Điểm */}
                  <td>
                    <TierBadge tier={c.tier} />
                    <div className="text-xs text-foreground-muted mt-1">{(c.points ?? 0).toLocaleString()} pts</div>
                  </td>

                  {/* Chi tiêu */}
                  <td>
                    <div className="text-sm font-semibold text-foreground">
                      {(c.totalSpent ?? 0).toLocaleString('vi-VN')}₫
                    </div>
                    <div className="text-xs text-foreground-muted mt-0.5">{c.totalOrders ?? 0} đơn</div>
                  </td>

                  {/* Trạng thái */}
                  <td>
                    {c.isActive !== false ? (
                      <span className="badge-success">
                        <BadgeCheck size={11} /> Hoạt động
                      </span>
                    ) : (
                      <span className="badge-error">
                        <AlertCircle size={11} /> Vô hiệu
                      </span>
                    )}
                  </td>

                  {/* Thao tác */}
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { setEditingCustomer(c); setIsModalOpen(true) }}
                        title="Sửa"
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary text-primary-500 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        title="Xoá"
                        disabled={deleteMutation.isPending}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-error/30 bg-error/10 hover:bg-error/20 text-error transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-foreground-muted">Trang {page} / {totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                    page === p
                      ? 'bg-primary-500 text-white border border-primary-500'
                      : 'border border-border bg-background-secondary hover:bg-background-tertiary text-foreground-muted'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            {totalPages > 5 && (
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      <CustomerFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingCustomer}
      />
    </div>
  )
}

