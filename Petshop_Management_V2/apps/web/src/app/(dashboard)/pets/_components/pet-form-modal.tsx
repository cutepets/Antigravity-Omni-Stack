'use client'

import { useEffect, useState, useMemo, useRef } from 'react'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Save, AlertCircle, Camera, Search, ChevronDown, User, Scale, Phone } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { petApi } from '@/lib/api/pet.api'
import { customerApi } from '@/lib/api/customer.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { loadBreedsFromDB, BreedEntry, loadTempsFromDB, TemperEntry } from './pet-settings-modal'

const petSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên thú cưng'),
  species: z.string().min(1, 'Vui lòng chọn loài'),
  breed: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'UNKNOWN']).optional(),
  weight: z.number({ invalid_type_error: 'Vui lòng nhập số' }).optional(),
  dateOfBirth: z.string().optional(),
  microchipId: z.string().optional(),
  notes: z.string().optional(),
  customerId: z.string().min(1, 'Vui lòng chọn chủ sở hữu'),
  color: z.string().optional(),
  allergies: z.string().optional(),
  temperament: z.string().optional(),
  isActive: z.boolean().optional(),
})

type FormData = z.infer<typeof petSchema>

interface Props {
  isOpen: boolean
  onClose: () => void
  initialData?: any
  fixedCustomerId?: string
}

const SPECIES_OPTIONS = [
  { value: 'Chó', label: 'Chó', emoji: '🐕' },
  { value: 'Mèo', label: 'Mèo', emoji: '🐱' },
  { value: 'Khác', label: 'Khác', emoji: '🐾' },
]

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Đực', symbol: '♂' },
  { value: 'FEMALE', label: 'Cái', symbol: '♀' },
  { value: 'UNKNOWN', label: 'Chưa rõ', symbol: '?' },
]

// ── Owner Combobox ─────────────────────────────────────────────────────────────
function OwnerCombobox({
  value,
  onChange,
  customers,
  isLoading,
  fixedCustomerId,
  error,
}: {
  value: string
  onChange: (id: string) => void
  customers: any[]
  isLoading: boolean
  fixedCustomerId?: string
  error?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = customers.find((c) => c.id === value)

  const filtered = useMemo(() => {
    if (!search.trim()) return customers.slice(0, 50)
    const q = search.toLowerCase()
    return customers.filter(
      (c) =>
        c.fullName?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
    ).slice(0, 30)
  }, [search, customers])

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (fixedCustomerId && selected) {
    return (
      <div className={`form-input flex items-center gap-2.5 bg-background-tertiary/60 cursor-not-allowed`}>
        <div className="w-7 h-7 rounded-lg bg-linear-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {selected.fullName?.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{selected.fullName}</div>
          <div className="text-xs text-foreground-muted">{selected.phone}</div>
        </div>
        <span className="ml-auto text-xs badge-success">Đã khóa</span>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`form-input w-full flex items-center gap-2.5 text-left ${error ? 'border-error focus:ring-error/20' : ''
          }`}
      >
        {selected ? (
          <>
            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {selected.fullName?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{selected.fullName}</div>
              <div className="text-xs text-foreground-muted">{selected.phone}</div>
            </div>
          </>
        ) : (
          <>
            <User size={15} className="text-foreground-muted shrink-0" />
            <span className="text-foreground-muted text-sm flex-1">
              {isLoading ? 'Đang tải...' : 'Tìm theo tên hoặc số điện thoại...'}
            </span>
          </>
        )}
        <ChevronDown size={15} className={`text-foreground-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-background-secondary border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nhập tên hoặc SĐT..."
                className="form-input pl-8 py-2 text-sm w-full"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-foreground-muted">Không tìm thấy khách hàng</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id); setOpen(false); setSearch('') }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background-tertiary transition-colors ${c.id === value ? 'bg-primary-500/10 text-primary-400' : ''
                    }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-linear-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {c.fullName?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{c.fullName}</div>
                    <div className="text-xs text-foreground-muted flex items-center gap-1">
                      <Phone size={10} /> {c.phone}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Breed Autocomplete ────────────────────────────────────────────────────────
function BreedAutocomplete({
  value,
  onChange,
  breeds,
}: {
  value: string
  onChange: (val: string) => void
  breeds: any[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!value.trim()) return breeds
    const q = value.toLowerCase()
    return breeds.filter((b) => b.name.toLowerCase().includes(q))
  }, [value, breeds])

  const isExactMatch = useMemo(() => {
    return breeds.some(b => b.name.toLowerCase() === value.trim().toLowerCase())
  }, [value, breeds])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Chọn hoặc nhập giống..."
          className="form-input w-full pr-8"
        />
        <ChevronDown
          size={15}
          onClick={() => setOpen(o => !o)}
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted cursor-pointer transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (breeds.length > 0 || value.trim()) && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-background-secondary border border-border rounded-xl shadow-2xl z-50 overflow-hidden max-h-52 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => { onChange(b.name); setOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-background-tertiary transition-colors"
              >
                {b.name}
              </button>
            ))
          ) : null}

          {value.trim() && !isExactMatch && (
            <button
              type="button"
              onClick={() => { setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-primary-500 font-medium hover:bg-primary-500/10 transition-colors border-t border-border"
            >
              + Thêm giống mới: &quot;{value}&quot;
            </button>
          )}

          {filtered.length === 0 && !value.trim() && (
            <div className="py-4 text-center text-xs text-foreground-muted">Không có dữ liệu giống</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export function PetFormModal({ isOpen, onClose, initialData, fixedCustomerId }: Props) {
  const isEditing = !!initialData
  const queryClient = useQueryClient()

  const [mounted, setMounted] = useState(false)
  const [breeds, setBreeds] = useState<BreedEntry[]>([])
  const [tempers, setTempers] = useState<TemperEntry[]>([])
  const [breedInput, setBreedInput] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  // Populate avatar from initialData when opening edit modal
  useEffect(() => {
    if (isOpen) {
      setAvatarUrl(
        initialData?.avatar
          ? initialData.avatar.startsWith('data:')
            ? initialData.avatar // already base64
            : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${initialData.avatar}`
          : null
      )
    } else {
      setAvatarUrl(null)
    }
  }, [isOpen, initialData?.avatar])

  useEffect(() => {
    setMounted(true)
    if (isOpen) {
      loadBreedsFromDB().then(setBreeds).catch(() => { })
      loadTempsFromDB().then(setTempers).catch(() => { })
    }
  }, [isOpen])

  const { data: customerData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: () => customerApi.getCustomers({ limit: 200 }),
    enabled: !fixedCustomerId,
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(petSchema),
    defaultValues: {
      name: initialData?.name || '',
      species: initialData?.species || 'Chó',
      breed: initialData?.breed || '',
      gender: initialData?.gender || 'UNKNOWN',
      weight: initialData?.weight || undefined,
      dateOfBirth: initialData?.dateOfBirth
        ? new Date(initialData.dateOfBirth).toISOString().split('T')[0]
        : '',
      microchipId: initialData?.microchipId || '',
      notes: initialData?.notes || '',
      customerId: initialData?.customerId || fixedCustomerId || '',
      color: initialData?.color || '',
      allergies: initialData?.allergies || '',
      temperament: initialData?.temperament || '',
      isActive: initialData ? initialData.isActive : true,
    },
  })

  const currentSpecies = watch('species')
  const currentGender = watch('gender')
  const currentCustomerId = watch('customerId')

  const availableBreeds = useMemo(
    () => breeds.filter((b) => b.species === currentSpecies),
    [breeds, currentSpecies]
  )

  const customers = useMemo(() => {
    // If fixedCustomerId, build a minimal list from initialData or empty
    if (fixedCustomerId) {
      if (initialData?.customer) return [initialData.customer]
      return []
    }
    return customerData?.data ?? []
  }, [customerData, fixedCustomerId, initialData])

  // Pre-populate breed input when editing
  useEffect(() => {
    if (initialData?.breed) setBreedInput(initialData.breed)
  }, [initialData?.breed])

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: any = {
        ...data,
        breed: breedInput.trim() || data.breed || undefined,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        avatar: avatarUrl || undefined,
      }
      return isEditing
        ? petApi.updatePet({ id: initialData.id, ...payload })
        : petApi.createPet(payload)
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Lưu thú cưng thành công' : 'Thêm thú cưng thành công')
      queryClient.invalidateQueries({ queryKey: ['pets'] })
      queryClient.invalidateQueries({ queryKey: ['customer', fixedCustomerId] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại')
    },
  })

  useEffect(() => {
    if (fixedCustomerId && !initialData) setValue('customerId', fixedCustomerId)
  }, [fixedCustomerId, initialData, setValue])

  if (!isOpen || !mounted) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-background-base/80 backdrop-blur-sm" />

      <div className="card p-0 relative w-full flex flex-col max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">

        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-border bg-background-tertiary flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐾</span>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isEditing ? 'Cập nhật thú cưng' : 'Thêm thú cưng mới'}
              </h2>
              <p className="text-xs text-foreground-muted mt-0.5">
                {isEditing ? `Đang sửa: ${initialData?.name}` : 'Điền đầy đủ để quản lý tốt hơn'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <form id="pet-form" onSubmit={handleSubmit((d) => mutation.mutate(d))}>

            {/* ── Row 1: Avatar + Tên + Loài ── */}
            <div className="flex gap-5 items-start mb-5">
              {/* Avatar placeholder */}
              <div className="shrink-0">
                <label
                  className="group relative flex w-20 h-20 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-border bg-background-tertiary transition-colors hover:border-primary-500 hover:bg-background-tertiary/80"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="pet" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-foreground-muted">
                      <Camera size={18} className="group-hover:text-primary-400 transition-colors" />
                      <span className="text-[10px] text-center leading-tight">Ảnh<br />đại diện</span>
                    </div>
                  )}
                  <div className="absolute inset-0 hidden items-center justify-center bg-background-base/60 text-[10px] font-bold uppercase tracking-wider text-white group-hover:flex">
                    {avatarUrl ? 'Đổi ảnh' : 'Chọn ảnh'}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      try {
                        const reader = new FileReader()
                        reader.onload = () => setAvatarUrl(reader.result as string)
                        reader.readAsDataURL(file)
                      } catch {
                        toast.error('Không thể đọc ảnh')
                      }
                    }}
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="mt-1 text-[10px] font-medium text-foreground-muted hover:text-error transition-colors w-20 text-center"
                  >
                    Xóa ảnh
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-4">
                {/* Tên */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Tên thú cưng <span className="text-error">*</span>
                  </label>
                  <input
                    {...register('name')}
                    placeholder="Mochi, Bông, Lucky..."
                    className={`form-input w-full ${errors.name ? 'border-error' : ''}`}
                  />
                  {errors.name && (
                    <p className="text-error text-xs flex items-center gap-1 mt-1.5">
                      <AlertCircle size={11} /> {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Loài — Toggle buttons compact */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Loài</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {SPECIES_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => { setValue('species', s.value); setBreedInput('') }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium transition-all whitespace-nowrap ${currentSpecies === s.value
                            ? 'bg-primary-500 border-primary-500 text-white shadow-sm shadow-primary-500/25'
                            : 'border-border bg-background-tertiary text-foreground-muted hover:border-primary-500/40 hover:text-foreground'
                          }`}
                      >
                        <span>{s.emoji}</span> {s.label}
                      </button>
                    ))}

                    {/* isActive toggle — inline, small */}
                    {isEditing && (
                      <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-xs text-foreground-muted">Hoạt động</span>
                        <div className="relative inline-flex h-5 w-9 shrink-0 items-center">
                          <input
                            type="checkbox"
                            id="isActiveToggle"
                            {...register('isActive')}
                            className="peer sr-only"
                          />
                          <div className="pointer-events-none h-5 w-9 rounded-full bg-background-tertiary border border-border peer-checked:bg-primary-500 peer-checked:border-primary-500 transition-colors" />
                          <div className="pointer-events-none absolute left-0.5 h-4 w-4 rounded-full bg-foreground-muted shadow transition-transform peer-checked:translate-x-4 peer-checked:bg-white" />
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 2: Giới tính + Ngày sinh + Cân nặng ── */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Giới tính <span className="text-error">*</span>
                </label>
                <div className="flex gap-1.5">
                  {GENDER_OPTIONS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setValue('gender', g.value as any)}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-sm font-semibold transition-all ${currentGender === g.value
                          ? g.value === 'MALE'
                            ? 'bg-info/20 border-info text-info'
                            : g.value === 'FEMALE'
                              ? 'bg-pink-500/20 border-pink-400 text-pink-400'
                              : 'bg-background-tertiary border-border text-foreground-muted'
                          : 'border-border bg-background-tertiary text-foreground-muted hover:border-border/80'
                        }`}
                    >
                      <span>{g.symbol}</span>
                      <span className="text-xs hidden sm:inline">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Ngày sinh</label>
                <input
                  type="date"
                  {...register('dateOfBirth')}
                  className="form-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <Scale size={13} className="inline mr-1" />
                  Cân nặng (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  {...register('weight', { valueAsNumber: true })}
                  placeholder="VD: 4.5"
                  className={`form-input w-full ${errors.weight ? 'border-error' : ''}`}
                />
              </div>
            </div>

            {/* ── Row 3: Giống + Tính cách ── */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Giống</label>
                <BreedAutocomplete
                  value={breedInput}
                  onChange={setBreedInput}
                  breeds={availableBreeds}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Tính cách</label>
                <select {...register('temperament')} className="form-input w-full">
                  <option value="">Chưa đánh giá</option>
                  {tempers.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Row 4: Màu sắc + Mã chip ── */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Màu sắc</label>
                <input
                  {...register('color')}
                  placeholder="Vàng, Trắng, Đen trắng..."
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Mã Microchip</label>
                <input
                  {...register('microchipId')}
                  placeholder="Nhập mã chip nếu có..."
                  className="form-input w-full"
                />
              </div>
            </div>

            {/* ── Row 5: Chủ thú cưng ── */}
            {!fixedCustomerId && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Chủ thú cưng <span className="text-error">*</span>
                </label>
                <OwnerCombobox
                  value={currentCustomerId}
                  onChange={(id) => setValue('customerId', id)}
                  customers={customers}
                  isLoading={isLoadingCustomers}
                  error={errors.customerId?.message}
                />
                {errors.customerId && (
                  <p className="text-error text-xs flex items-center gap-1 mt-1.5">
                    <AlertCircle size={11} /> {errors.customerId.message}
                  </p>
                )}
              </div>
            )}

            {/* Fixed customer display */}
            {fixedCustomerId && customers.length > 0 && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-foreground mb-1.5">Chủ thú cưng</label>
                <OwnerCombobox
                  value={currentCustomerId}
                  onChange={() => { }}
                  customers={customers}
                  isLoading={false}
                  fixedCustomerId={fixedCustomerId}
                />
              </div>
            )}

            {/* ── Row 6: Dị ứng ── */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                <span className="text-warning mr-1">⚠️</span>
                Ghi chú dị ứng / Lưu ý phục vụ
              </label>
              <textarea
                {...register('allergies')}
                placeholder="Dị ứng với..., lưu ý đặc biệt khi phục vụ..."
                rows={2}
                className="form-input py-3 w-full bg-background-base resize-none border-warning/30 focus:border-warning/60 focus:ring-warning/10"
              />
            </div>

            {/* ── Row 7: Ghi chú ngoại hình ── */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Mô tả / Ghi chú ngoại hình
              </label>
              <textarea
                {...register('notes')}
                placeholder="Bé ngoan, hơi nhát người, có đốm trên tai trái..."
                rows={2}
                className="form-input py-3 w-full bg-background-base resize-none"
              />
            </div>


          </form>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-border bg-background-tertiary flex justify-between items-center shrink-0">
          <span className="text-xs text-foreground-muted">
            {isEditing ? `Mã: ${initialData?.petCode}` : '* Bắt buộc'}
          </span>
          <div className="flex gap-2.5">
            <button type="button" onClick={onClose} className="btn-outline px-5 rounded-xl">
              Hủy
            </button>
            <button
              type="submit"
              form="pet-form"
              disabled={mutation.isPending}
              className="btn-primary liquid-button flex items-center gap-2 px-5 rounded-xl"
            >
              {mutation.isPending ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save size={15} />
                  {isEditing ? 'Lưu thông tin' : 'Thêm thú cưng'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
