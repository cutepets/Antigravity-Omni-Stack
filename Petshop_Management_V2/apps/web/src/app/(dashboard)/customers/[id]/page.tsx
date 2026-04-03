'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Phone, Mail, MapPin, Star, Edit2,
  PawPrint, ShoppingBag, Receipt, Calendar,
  AlertCircle, BadgeCheck, Trash2, TrendingUp,
} from 'lucide-react'
import { customerApi } from '@/lib/api/customer.api'
import { CustomerFormModal } from '../_components/customer-form-modal'
import { PetFormModal } from '../../pets/_components/pet-form-modal'

// ── Tier config ────────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<string, { label: string; badgeClass: string; icon: string; barColor: string }> = {
  BRONZE:  { label: 'Đồng',      badgeClass: 'badge-warning', icon: '🥉', barColor: 'bg-warning' },
  SILVER:  { label: 'Bạc',       badgeClass: 'badge-gray',    icon: '🥈', barColor: 'bg-foreground-muted' },
  GOLD:    { label: 'Vàng',      badgeClass: 'badge-accent',  icon: '🥇', barColor: 'bg-accent-500' },
  DIAMOND: { label: 'Kim cương', badgeClass: 'badge-info',    icon: '💎', barColor: 'bg-info' },
}

const TABS = [
  { id: 'pets',   label: 'Danh sách Pet',     icon: PawPrint },
  { id: 'orders', label: 'Lịch sử mua hàng',  icon: ShoppingBag },
  { id: 'debt',   label: 'Công nợ',            icon: Receipt },
  { id: 'spa',    label: 'Spa & Grooming',     icon: null },
  { id: 'hotel',  label: 'Pet Hotel',          icon: null },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n?: number) => (n ?? 0).toLocaleString('vi-VN') + ' đ'
const ymd = (d?: string) =>
  d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false }: {
  label: string; value: string | number; sub?: string; accent?: boolean
}) {
  return (
    <div className="card flex flex-col items-center justify-center text-center gap-1">
      <p className={`text-2xl font-bold ${accent ? 'text-accent-500' : 'text-primary-500'}`}>{value}</p>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {sub && <p className="text-xs text-foreground-muted">{sub}</p>}
    </div>
  )
}

// ── Info Row ──────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, isZalo = false }: {
  icon: any; label: string; value?: string | null; isZalo?: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <Icon size={14} className="text-foreground-muted" />
      <span className="text-foreground-muted">{label}:</span>
      <span className="text-foreground font-medium">{value || '—'}</span>
      {isZalo && value && (
        <span className="ml-1 badge badge-info text-[10px]">Zalo</span>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('pets')
  const [editOpen, setEditOpen] = useState(false)
  const [petFormOpen, setPetFormOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.getCustomer(id),
    enabled: !!id,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-[60vh] text-foreground-muted text-sm gap-3">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary-500" />
      Đang tải thông tin...
    </div>
  )

  if (error || !data?.data) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-foreground-muted">
      <AlertCircle size={48} className="text-error/50" />
      <p className="text-lg font-medium text-foreground">Không tìm thấy khách hàng</p>
      <button onClick={() => router.back()} className="text-primary-500 hover:underline text-sm">
        ← Quay lại danh sách
      </button>
    </div>
  )

  const customer = data.data as any
  const tier = TIER_CONFIG[customer?.tier] ?? TIER_CONFIG.BRONZE

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">

      {/* ── Breadcrumb ── */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-[13px] text-foreground-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} />
        Khách hàng / <span className="text-foreground font-medium">{customer.fullName}</span>
      </button>

      {/* ── Hero card ── */}
      <div className="card p-0 overflow-hidden">
        {/* Top Header */}
        <div className="p-6 flex flex-wrap items-start justify-between gap-6 border-b border-border">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-2xl font-bold text-white shrink-0 shadow-lg shadow-primary-500/20">
              {customer.fullName?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                <h1 className="text-xl font-bold text-foreground">{customer.fullName}</h1>

                {/* Tier Badge */}
                <span className={`${tier.badgeClass} flex items-center gap-1`}>
                  <Star size={10} /> {tier.label}
                </span>

                {/* Active badge */}
                {customer.isActive !== false ? (
                  <span className="badge-success flex items-center gap-1">
                    <BadgeCheck size={11} /> Hoạt động
                  </span>
                ) : (
                  <span className="badge-error">Vô hiệu</span>
                )}
              </div>
              <div className="text-[13px] text-foreground-muted font-mono">
                id:{customer.id?.substring(0, 8)} · {customer.customerCode}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="btn-outline px-4 py-2 rounded-xl text-sm"
            >
              <Edit2 size={14} /> Chỉnh sửa
            </button>
            <button className="flex items-center justify-center p-2.5 rounded-xl border border-error/30 bg-error/10 hover:bg-error/20 text-error transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Info Rows */}
        <div className="p-4 px-6 flex flex-wrap items-center gap-x-10 gap-y-2.5 bg-background-tertiary/50">
          <InfoRow icon={Phone}    label="SĐT"     value={customer.phone}    isZalo />
          <InfoRow icon={Mail}     label="Email"   value={customer.email} />
          <InfoRow icon={MapPin}   label="Địa chỉ" value={customer.address} />
          <InfoRow icon={Receipt}  label="MST"     value={customer.taxCode} />
          <InfoRow icon={Calendar} label="Ngày tạo" value={ymd(customer.createdAt)} />
        </div>
      </div>

      {/* ── Tier Progress ── */}
      <div className="card flex items-center justify-between gap-6 flex-wrap">
        <div>
          <span className="text-xs text-foreground-muted uppercase tracking-wider font-bold block mb-1">
            Hạng theo chi tiêu 6 tháng gần nhất
          </span>
          <div className="flex items-center gap-1.5 font-bold text-accent-500">
            <Star size={14} /> {tier.label}
          </div>
        </div>
        <div className="text-right flex-1 min-w-[200px]">
          <span className="text-xs text-foreground-muted block mb-2">
            Cần chi thêm <strong className="text-foreground">30.000.000 đ</strong> để lên hạng <strong className="text-primary-500">Bạch Kim</strong>
          </span>
          <div className="h-1.5 bg-background-tertiary rounded-full overflow-hidden">
            <div className={`h-full ${tier.barColor} rounded-full transition-all`} style={{ width: '30%' }} />
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tổng chi tiêu"     value={fmt(customer.totalSpent)}   sub="Toàn thời gian" />
        <StatCard label="Chi tiêu 6 tháng"  value={fmt(customer.periodSpent)}  sub="Căn cứ xét hạng" />
        <StatCard label="Điểm còn lại"      value={`${customer.points ?? 0} điểm`} sub={`Đã dùng ${customer.pointsUsed ?? 0} điểm`} accent />
        <StatCard label="Công nợ"           value="0 đ" sub="0 đơn chưa TT" />
      </div>

      {/* ── Tabs ── */}
      <div className="card p-0 overflow-hidden min-h-[400px]">
        {/* Tab bar */}
        <div className="flex overflow-x-auto border-b border-border no-scrollbar">
          {TABS.map(({ id: tid, label, icon: Icon }) => {
            const isActive = activeTab === tid
            return (
              <button
                key={tid}
                onClick={() => setActiveTab(tid)}
                className={`flex items-center gap-2 px-6 py-4 text-[13px] font-medium transition-colors whitespace-nowrap border-b-2 shrink-0 ${
                  isActive
                    ? 'text-primary-500 border-primary-500'
                    : 'text-foreground-muted border-transparent hover:text-foreground'
                }`}
              >
                {Icon && <Icon size={16} />}
                {label}
              </button>
            )
          })}
        </div>

        <div className="p-6">
          {/* ── Pets tab ── */}
          {activeTab === 'pets' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="flex items-center gap-2 text-foreground font-semibold">
                  <PawPrint size={18} className="text-primary-500" />
                  Thú cưng ({customer.pets?.length || 0})
                </h3>
                <button
                  onClick={() => setPetFormOpen(true)}
                  className="btn-primary liquid-button px-4 py-2 rounded-xl text-sm"
                >
                  + Thêm Pet
                </button>
              </div>

              {!customer.pets?.length ? (
                <div className="flex flex-col items-center justify-center py-20 text-foreground-muted gap-3">
                  <PawPrint size={36} className="opacity-30" />
                  <p>Chưa có thú cưng nào</p>
                  <button
                    onClick={() => setPetFormOpen(true)}
                    className="btn-primary liquid-button px-5 py-2.5 rounded-xl text-sm mt-2"
                  >
                    + Thêm Pet đầu tiên
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customer.pets.map((pet: any) => (
                    <div
                      key={pet.id}
                      className="bg-background-tertiary rounded-2xl p-5 border border-border hover:border-primary-500/40 transition-colors"
                    >
                      <div className="flex gap-4 items-center mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shrink-0 shadow-md shadow-primary-500/20">
                          <PawPrint size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-base leading-none mb-1.5">{pet.name}</p>
                          <p className="text-xs text-foreground-muted">{pet.species} · {pet.breed || 'Chưa xác định'}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs bg-background-secondary rounded-lg p-2.5 border border-border">
                        <span className="flex items-center gap-1.5 text-foreground-muted">
                          <span className={pet.gender === 'MALE' ? 'text-info' : 'text-accent-500'}>
                            {pet.gender === 'MALE' ? '♂' : '♀'}
                          </span>
                          {pet.gender === 'MALE' ? 'Đực' : 'Cái'}
                        </span>
                        <span className="font-mono text-primary-500">{pet.petCode}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Orders tab ── */}
          {activeTab === 'orders' && (
            <div>
              {!customer.orders?.length ? (
                <div className="flex flex-col items-center justify-center py-20 text-foreground-muted gap-3">
                  <ShoppingBag size={36} className="opacity-30" />
                  <p>Chưa có đơn hàng nào</p>
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {['Mã đơn', 'Ngày', 'Tổng tiền', 'Trạng thái', 'Thanh toán'].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customer.orders.map((o: any) => (
                        <tr key={o.id}>
                          <td className="font-mono text-primary-500">{o.orderNumber}</td>
                          <td>{ymd(o.createdAt)}</td>
                          <td className="font-semibold text-foreground">{fmt(o.total)}</td>
                          <td>
                            <span className="badge badge-info">{o.status}</span>
                          </td>
                          <td>
                            <span className={o.paymentStatus === 'PAID' ? 'badge-success' : 'badge-warning'}>
                              {o.paymentStatus === 'PAID' ? 'Đã TT' : 'Chưa TT'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Other tabs placeholder ── */}
          {['debt', 'spa', 'hotel'].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center py-20 text-foreground-muted gap-3">
              <TrendingUp size={36} className="opacity-30" />
              <p>Module đang cập nhật...</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CustomerFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        initialData={customer}
      />
      <PetFormModal
        isOpen={petFormOpen}
        onClose={() => setPetFormOpen(false)}
        fixedCustomerId={customer.id}
      />
    </div>
  )
}
