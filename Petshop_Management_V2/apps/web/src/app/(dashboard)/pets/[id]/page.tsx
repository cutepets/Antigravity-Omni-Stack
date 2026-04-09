'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Edit2, Trash2, AlertCircle, Scale,
  Syringe, History, StickyNote, Phone,
  ChevronRight, Plus, Scissors, Hotel, BadgeCheck,
  BarChart2, Cpu, Palette,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts'
import { petApi } from '@/lib/api/pet.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { PetFormModal } from '../_components/pet-form-modal'
import { useAuthorization } from '@/hooks/useAuthorization'
import { loadTempsFromDB, TemperEntry, getTemperStyle } from '../_components/pet-settings-modal'
import { useEffect } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function calcAge(dob?: string | null) {
  if (!dob) return null
  const now = new Date()
  const birth = new Date(dob)
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  if (months < 0) { years--; months += 12 }
  if (years > 0) return `${years} tuổi${months > 0 ? ` ${months} tháng` : ''}`
  return `${months} tháng tuổi`
}

// ── Sub-components ────────────────────────────────────────────────────────────
function QuickStatCard({ icon: Icon, label, value, sub, iconClass = 'text-primary-500' }: {
  icon: any; label: string; value: string; sub?: string; iconClass?: string
}) {
  return (
    <div className="card flex items-center gap-3 py-3">
      <div className={`w-9 h-9 rounded-xl bg-background-tertiary flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground-muted">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
        {sub && <p className="text-xs text-foreground-muted">{sub}</p>}
      </div>
    </div>
  )
}

// Service badge colors
const SERVICE_BADGE: Record<string, string> = {
  'Pet Hotel':  'badge-info',
  'Grooming':   'badge-accent',
  'Spa':        'badge-accent',
  'Vet':        'badge-error',
  'checkup':    'badge-error',
  'DEFAULT':    'badge-gray',
}
function serviceBadge(type: string) {
  return SERVICE_BADGE[type] || SERVICE_BADGE.DEFAULT
}

// Status badge
function statusBadge(status: string) {
  if (status === 'ACTIVE' || status === 'COMPLETED') return 'badge-success'
  if (status === 'CANCELLED') return 'badge-error'
  return 'badge-warning'
}

// Vaccination timeline status
function vaccStatus(vac: any) {
  if (!vac.nextDueDate) return { label: 'Hoàn thành', cls: 'badge-success' }
  const due = new Date(vac.nextDueDate)
  const now = new Date()
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0) return { label: 'Quá hạn', cls: 'badge-error' }
  if (diffDays <= 30) return { label: `${diffDays}d nữa`, cls: 'badge-warning' }
  return { label: fmt(vac.nextDueDate), cls: 'badge-gray' }
}

// ── Tabs config ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'services',    label: 'Lịch sử dịch vụ', icon: Scissors },
  { id: 'vaccines',   label: 'Tiêm phòng',       icon: Syringe },
  { id: 'weight',     label: 'Cân nặng',          icon: BarChart2 },
  { id: 'notes',      label: 'Ghi chú',           icon: StickyNote },
  { id: 'updates',    label: 'Lịch sử cập nhật',  icon: History },
]

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthorization()
  const canUpdate = hasPermission('pet.update')
  const canDelete = hasPermission('pet.delete')

  const [activeTab, setActiveTab] = useState('services')
  const [editOpen, setEditOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['pet', id],
    queryFn: () => petApi.getPet(id),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => petApi.deletePet(id),
    onSuccess: () => {
      toast.success('Đã xoá thú cưng')
      queryClient.invalidateQueries({ queryKey: ['pets'] })
      router.replace('/pets')
    },
    onError: () => toast.error('Không thể xoá thú cưng này'),
  })

  // ── Loading / Error states ──
  const [temperConfig, setTemperConfig] = useState<TemperEntry[]>([])
  useEffect(() => {
    loadTempsFromDB().then(setTemperConfig).catch(() => {})
  }, [])

  if (isLoading) return (
    <div className="flex items-center justify-center h-[60vh] text-foreground-muted text-sm gap-3">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary-500" />
      Đang tải hồ sơ thú cưng...
    </div>
  )

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-foreground-muted">
      <AlertCircle size={40} className="text-error/50" />
      <p className="text-lg font-medium text-foreground">Không tìm thấy thú cưng</p>
      <button onClick={() => router.back()} className="text-primary-500 hover:underline text-sm">
        ← Quay lại danh sách
      </button>
    </div>
  )

  const pet = data as any
  const age = calcAge(pet.dateOfBirth)
  const lastVaccination = pet.vaccinations?.[0]
  const lastWeightLog = pet.weightLogs?.[0]
  const genderLabel = pet.gender === 'MALE' ? '♂ Đực' : pet.gender === 'FEMALE' ? '♀ Cái' : '— Chưa rõ'
  const genderColor = pet.gender === 'MALE' ? 'text-info' : pet.gender === 'FEMALE' ? 'text-pink-400' : 'text-foreground-muted'
  const speciesEmoji = pet.species === 'Chó' ? '🐕' : pet.species === 'Mèo' ? '🐱' : '🐾'
  
  const temperInfo = pet.temperament ? temperConfig.find(t => t.name === pet.temperament) : null
  const temperStyle = temperInfo ? getTemperStyle(temperInfo.color) : getTemperStyle('gray')

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-5">

      {/* ── Breadcrumb ── */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-[13px] text-foreground-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} />
        Thú cưng <ChevronRight size={12} />
        <span className="text-foreground font-medium">{pet.name}</span>
      </button>

      {/* ── Hero Card ── */}
      <div className="card p-0 overflow-hidden">
        {/* Top section */}
        <div className="p-6 flex flex-wrap items-start gap-6 border-b border-border">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-primary-400/20 to-primary-600/20 border border-primary-500/20 flex items-center justify-center text-4xl shrink-0 overflow-hidden">
            {pet.avatar ? (
              <img
                src={pet.avatar.startsWith('data:')
                  ? pet.avatar
                  : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${pet.avatar}`
                }
                alt={pet.name}
                className="w-full h-full object-cover"
              />
            ) : (
              speciesEmoji
            )}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <h1 className="text-2xl font-bold text-foreground">{pet.name}</h1>

              {/* Species badge */}
              <span className="badge-info text-xs">
                {pet.species?.toUpperCase().substring(0, 3)}
              </span>

              {pet.breed && (
                <span className="badge-gray text-xs">{pet.breed}</span>
              )}

              {pet.temperament && (
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${temperStyle.bg} ${temperStyle.text} ${temperStyle.border}`}>
                  {pet.temperament}
                </span>
              )}

              {/* Gender */}
              <span className={`text-sm font-semibold ${genderColor}`}>{genderLabel}</span>

              {/* Age */}
              {age && <span className="text-sm text-foreground-muted">{age}</span>}

              {/* Status */}
              {pet.isActive === false && (
                <span className="badge-error text-xs">Ngừng HĐ</span>
              )}
            </div>

            {/* Secondary info row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-foreground-muted">
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-primary-500 text-xs font-bold bg-primary-500/10 px-2 py-0.5 rounded">
                  {pet.petCode}
                </span>
              </span>
              {pet.color && (
                <span className="flex items-center gap-1.5">
                  <Palette size={13} /> {pet.color}
                </span>
              )}
              {pet.microchipId && (
                <span className="flex items-center gap-1.5 font-mono text-xs">
                  <Cpu size={13} /> {pet.microchipId}
                </span>
              )}
            </div>

            {/* Allergy alert */}
            {pet.allergies && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-error/10 border border-error/30 rounded-xl text-sm text-error">
                <AlertCircle size={14} className="shrink-0" />
                <span className="font-medium">Dị ứng:</span>
                <span>{pet.allergies}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => router.push(`/grooming?action=new&petId=${pet.id}`)}
              className="btn px-3 py-2 rounded-xl text-sm flex items-center gap-1.5 whitespace-nowrap"
            >
              <Scissors size={14} /> Spa
            </button>
            <button
              onClick={() => router.push(`/hotel?action=new&petId=${pet.id}`)}
              className="btn flex items-center justify-center w-9 h-9 rounded-xl !p-0"
              title="Đặt phòng Hotel"
            >
              <Hotel size={14} />
            </button>
            {canUpdate && (
              <button
                onClick={() => setEditOpen(true)}
                className="btn-outline px-4 py-2 rounded-xl text-sm flex items-center gap-1.5"
              >
                <Edit2 size={14} /> Chỉnh sửa
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => {
                  if (window.confirm(`Xoá thú cưng "${pet.name}"? Hành động này không thể hoàn tác.`))
                    deleteMutation.mutate()
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center justify-center p-2.5 rounded-xl border border-error/30 bg-error/10 hover:bg-error/20 text-error transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Owner + Weight + Last vaccination row */}
        <div className="px-6 py-4 bg-background-tertiary/50 flex flex-wrap items-center gap-x-8 gap-y-3">
          {/* Owner */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold">
              {pet.customer?.fullName?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Chủ sở hữu</p>
              <p className="text-sm font-semibold text-foreground">{pet.customer?.fullName}</p>
            </div>
            <a
              href={`/customers/${pet.customer?.id}`}
              className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors ml-1"
            >
              <Phone size={11} /> {pet.customer?.phone}
              <ChevronRight size={11} />
            </a>
          </div>

          <div className="h-6 w-px bg-border hidden sm:block" />

          {/* Weight */}
          <div className="flex items-center gap-2">
            <Scale size={15} className="text-foreground-muted" />
            <div>
              <p className="text-xs text-foreground-muted">Cân nặng</p>
              <p className="text-sm font-semibold text-foreground">
                {lastWeightLog?.weight ?? pet.weight ?? '—'} kg
              </p>
            </div>
            {canUpdate && (
              <button
                onClick={() => setActiveTab('weight')}
                className="w-6 h-6 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 flex items-center justify-center text-primary-400 transition-colors"
                title="Cập nhật cân nặng"
              >
                <Plus size={12} />
              </button>
            )}
          </div>

          <div className="h-6 w-px bg-border hidden sm:block" />

          {/* Last vaccination */}
          <div className="flex items-center gap-2">
            <Syringe size={15} className={lastVaccination ? 'text-success' : 'text-foreground-muted'} />
            <div>
              <p className="text-xs text-foreground-muted">
                {lastVaccination ? 'Mũi tiêm gần nhất' : 'Tiêm phòng'}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {lastVaccination
                  ? `${lastVaccination.vaccineName} · ${fmt(lastVaccination.date)}`
                  : 'Chưa có lịch sử'}
              </p>
            </div>
          </div>

          {pet.dateOfBirth && (
            <>
              <div className="h-6 w-px bg-border hidden sm:block" />
              <div>
                <p className="text-xs text-foreground-muted">Ngày sinh</p>
                <p className="text-sm font-semibold text-foreground">{fmt(pet.dateOfBirth)}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickStatCard
          icon={Scissors}
          label="Dịch vụ đã dùng"
          value={`${pet.groomingSessions?.length ?? 0} lần`}
          sub="Tổng lịch sử"
          iconClass="text-accent-500"
        />
        <QuickStatCard
          icon={Hotel}
          label="Pet Hotel"
          value={pet.hotelStays?.length > 0 ? `${pet.hotelStays.length} lần lưu trú` : 'Chưa có'}
          iconClass="text-info"
        />
        <QuickStatCard
          icon={Syringe}
          label="Lịch tiêm"
          value={lastVaccination ? `${pet.vaccinations?.length ?? 0} mũi` : 'Chưa có'}
          sub={lastVaccination ? `Gần nhất: ${fmt(lastVaccination?.date)}` : 'Thêm lịch tiêm'}
          iconClass="text-success"
        />
        <QuickStatCard
          icon={BarChart2}
          label="Cân nặng hiện tại"
          value={`${lastWeightLog?.weight ?? pet.weight ?? '—'} kg`}
          sub={lastWeightLog ? `Cập nhật ${fmt(lastWeightLog?.date)}` : 'Chưa theo dõi'}
          iconClass="text-warning"
        />
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
                className={`flex items-center gap-2 px-5 py-4 text-[13px] font-medium transition-colors whitespace-nowrap border-b-2 shrink-0 ${
                  isActive
                    ? 'text-primary-500 border-primary-500'
                    : 'text-foreground-muted border-transparent hover:text-foreground'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            )
          })}
        </div>

        <div className="p-6">

          {/* ── Tab: Lịch sử dịch vụ ── */}
          {activeTab === 'services' && (
            <ServiceHistoryTab pet={pet} />
          )}

          {/* ── Tab: Tiêm phòng ── */}
          {activeTab === 'vaccines' && (
            <VaccineTab vaccinations={pet.vaccinations ?? []} />
          )}

          {/* ── Tab: Cân nặng ── */}
          {activeTab === 'weight' && (
            <WeightTab pet={pet} weightLogs={pet.weightLogs ?? []} />
          )}

          {/* ── Tab: Ghi chú ── */}
          {activeTab === 'notes' && (
            <NotesTab notes={pet.notes} />
          )}

          {/* ── Tab: Lịch sử cập nhật ── */}
          {activeTab === 'updates' && (
            <UpdatesTab pet={pet} />
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <PetFormModal
          isOpen={editOpen}
          onClose={() => {
            setEditOpen(false)
            queryClient.invalidateQueries({ queryKey: ['pet', id] })
          }}
          initialData={pet}
        />
      )}
    </div>
  )
}

// ── Tab Components ─────────────────────────────────────────────────────────────

function ServiceHistoryTab({ pet }: { pet: any }) {
  // Merge grooming + hotel stays into unified service list
  const services: any[] = []

  if (pet.groomingSessions?.length) {
    pet.groomingSessions.forEach((g: any) => {
      services.push({
        id: g.id,
        code: g.sessionCode,
        type: 'Grooming',
        content: g.notes || '—',
        date: g.startTime || g.createdAt,
        status: g.status,
      })
    })
  }
  if (pet.hotelStays?.length) {
    pet.hotelStays.forEach((h: any) => {
      services.push({
        id: h.id,
        code: h.stayCode,
        type: 'Pet Hotel',
        content: h.lineType || 'REGULAR',
        date: h.checkIn,
        status: h.status,
      })
    })
  }

  services.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (!services.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-foreground-muted gap-3">
      <Scissors size={36} className="opacity-30" />
      <p className="text-sm">Chưa có lịch sử dịch vụ</p>
    </div>
  )

  return (
    <div>
      <h3 className="flex items-center gap-2 text-foreground font-semibold mb-4">
        <Scissors size={16} className="text-primary-500" />
        Lịch sử dịch vụ ({services.length})
      </h3>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Dịch vụ</th>
              <th>Nội dung</th>
              <th>Thời gian</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className="font-mono text-xs font-semibold text-primary-400">
                    {s.code || s.id.substring(0, 8)}
                  </span>
                </td>
                <td>
                  <span className={`${serviceBadge(s.type)} text-xs`}>{s.type}</span>
                </td>
                <td className="text-sm text-foreground-muted">{s.content}</td>
                <td className="text-sm text-foreground-muted">{fmtDateTime(s.date)}</td>
                <td>
                  <span className={`${statusBadge(s.status)} text-xs`}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VaccineTab({ vaccinations }: { vaccinations: any[] }) {
  if (!vaccinations.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-foreground-muted gap-3">
      <Syringe size={36} className="opacity-30" />
      <p className="text-sm">Chưa có lịch sử tiêm phòng</p>
    </div>
  )

  return (
    <div>
      <h3 className="flex items-center gap-2 text-foreground font-semibold mb-5">
        <Syringe size={16} className="text-success" />
        Lịch sử tiêm phòng ({vaccinations.length} mũi)
      </h3>

      {/* Timeline */}
      <div className="space-y-3">
        {vaccinations.map((vac: any, i: number) => {
          const s = vaccStatus(vac)
          return (
            <div key={vac.id} className="flex gap-4 items-start">
              {/* Timeline dot */}
              <div className="flex flex-col items-center shrink-0 mt-1">
                <div className={`w-3 h-3 rounded-full border-2 ${
                  i === 0 ? 'border-success bg-success' : 'border-border bg-background-tertiary'
                }`} />
                {i < vaccinations.length - 1 && (
                  <div className="w-px h-8 bg-border mt-1" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-3 border-b border-border last:border-b-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground">{vac.vaccineName}</span>
                  <span className={`${s.cls} text-xs`}>{s.label}</span>
                  {i === 0 && <span className="badge-success text-xs">Mới nhất</span>}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-foreground-muted">
                  <span>Ngày tiêm: <strong className="text-foreground">{fmt(vac.date)}</strong></span>
                  {vac.nextDueDate && (
                    <span>Mũi tiếp: <strong className="text-foreground">{fmt(vac.nextDueDate)}</strong></span>
                  )}
                  {vac.veterinarian && <span>Bác sĩ: {vac.veterinarian}</span>}
                  {vac.notes && <span className="italic">{vac.notes}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

 function WeightTab({ pet, weightLogs }: { pet: any; weightLogs: any[] }) {
  const chartData = [...weightLogs].reverse().map(log => ({
    date: fmt(log.date),
    weight: log.weight,
    notes: log.notes
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="flex items-center gap-2 text-foreground font-semibold">
          <BarChart2 size={16} className="text-warning" />
          Theo dõi cân nặng
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">
            Hiện tại: <strong className="text-foreground">{pet.weight ?? '—'} kg</strong>
          </span>
        </div>
      </div>

      {weightLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-foreground-muted gap-3">
          <Scale size={36} className="opacity-30" />
          <p className="text-sm">Chưa có lịch sử cân nặng</p>
          <p className="text-xs text-foreground-muted/70">
            Cân nặng sẽ được ghi lại mỗi lần cập nhật hoặc dịch vụ spa
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Chart */}
          <div className="h-[250px] w-full bg-background-tertiary/20 rounded-xl border border-border p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--color-foreground-muted)' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--color-foreground-muted)' }} axisLine={false} tickLine={false} dx={-10} unit="kg" />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--color-foreground-muted)', fontSize: '12px', marginBottom: '4px' }}
                  itemStyle={{ color: 'var(--color-warning)', fontSize: '14px', fontWeight: 600 }}
                />
                <Line type="monotone" dataKey="weight" name="Cân nặng" stroke="var(--color-warning)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-warning)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2.5">
            {weightLogs.map((log: any) => (
              <div key={log.id} className="flex items-center gap-4 px-4 py-3 bg-background-tertiary/60 rounded-xl border border-border">
                <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                  <Scale size={16} className="text-warning" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{log.weight} kg</p>
                  <p className="text-xs text-foreground-muted">{fmt(log.date)}</p>
                </div>
                {log.notes && (
                  <p className="text-xs text-foreground-muted italic">{log.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function NotesTab({ notes }: { notes?: string }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-foreground font-semibold mb-4">
        <StickyNote size={16} className="text-accent-500" />
        Ghi chú
      </h3>
      {notes ? (
        <div className="p-4 bg-warning/5 border border-warning/20 rounded-xl text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {notes}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-foreground-muted gap-3">
          <StickyNote size={36} className="opacity-30" />
          <p className="text-sm">Chưa có ghi chú nào</p>
          <p className="text-xs text-foreground-muted/70">Ghi chú dị ứng, lưu ý phục vụ sẽ hiển thị tại đây</p>
        </div>
      )}
    </div>
  )
}

function UpdatesTab({ pet }: { pet: any }) {
  const fmt2 = fmtDateTime
  const changes = [
    { label: 'Tạo hồ sơ', date: pet.createdAt, icon: BadgeCheck, cls: 'text-success' },
    ...(pet.updatedAt !== pet.createdAt
      ? [{ label: 'Cập nhật gần nhất', date: pet.updatedAt, icon: Edit2, cls: 'text-primary-500' }]
      : []),
  ]
  return (
    <div>
      <h3 className="flex items-center gap-2 text-foreground font-semibold mb-4">
        <History size={16} className="text-foreground-muted" />
        Lịch sử cập nhật
      </h3>
      <div className="space-y-3">
        {changes.map((c, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 bg-background-tertiary/60 rounded-xl border border-border">
            <c.icon size={16} className={c.cls} />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{c.label}</p>
              <p className="text-xs text-foreground-muted">{fmt2(c.date)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
