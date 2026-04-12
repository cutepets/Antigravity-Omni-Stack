'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Hotel, Plus, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { hotelApi } from '@/lib/api/hotel.api'
import {
  pricingApi,
  type PricingDayType,
  type PricingServiceType,
  type ServiceWeightBand,
} from '@/lib/api/pricing.api'
import { useAuthorization } from '@/hooks/useAuthorization'
import { cn, formatCurrency } from '@/lib/utils'

type PricingMode = 'HOTEL' | 'GROOMING'

type BandDraft = {
  label: string
  minWeight: string
  maxWeight: string
  sortOrder: string
}

type SpaDraft = {
  id?: string
  price: string
  durationMinutes: string
}

type HotelDraft = {
  id?: string
  fullDayPrice: string
}

const SPECIES_OPTIONS = [
  { value: 'Chó', label: 'Chó' },
  { value: 'Mèo', label: 'Mèo' },
]

const SPA_PACKAGES = [
  { code: 'BATH', label: 'Tắm' },
  { code: 'BATH_CLEAN', label: 'Tắm + Vệ sinh' },
  { code: 'SHAVE', label: 'Cạo' },
  { code: 'BATH_SHAVE_CLEAN', label: 'Tắm + Cạo + VS' },
  { code: 'SPA', label: 'SPA' },
]

const DAY_TYPE_OPTIONS: Array<{ value: PricingDayType; label: string; hint: string }> = [
  { value: 'REGULAR', label: 'Ngày thường', hint: 'Dùng cho các ngày không nằm trong lịch lễ' },
  { value: 'HOLIDAY', label: 'Ngày lễ', hint: 'Dùng khi ngày gửi nằm trong lịch ngày lễ active' },
]

const HOTEL_SPECIES_COLUMNS = SPECIES_OPTIONS

const HOTEL_PROMOS = [
  'Gửi trên 7 ngày tắm miễn phí 1 lần (trừ lễ, tết).',
  'Gửi trên 30 ngày giảm 5% phí trông giữ.',
]

const HOTEL_EXTRA_SERVICES = [
  { price: '10k - 30k / lần', description: 'Cho uống thuốc, bôi thuốc (không hung dữ).' },
  { price: '10k / ngày', description: 'Đồ ăn thêm theo yêu cầu nấu hoặc bảo quản tủ.' },
  { price: '20k / ngày / bé', description: 'Điều hòa mùa hè (từ bé thứ 2 giảm còn 10k).' },
]

const HOTEL_INCLUDED = [
  'Mỗi bé 1 buồng riêng biệt, có khay vệ sinh, đệm và bát ăn riêng.',
  'Được dọn dẹp vệ sinh, xịt khử mùi, khử khuẩn và diệt ve bọ thường xuyên.',
  'Ngày ăn 2 bữa với hạt mix thịt sấy, pate, ức gà, thịt xay, cơm.',
  'Gửi clip bé vào tối hàng ngày qua Zalo.',
]

const GROOMING_EXTRA_SERVICES = [
  { name: 'Tắm nấm, bọ <5kg', price: '30k' },
  { name: 'Tắm nấm, bọ 5-15kg', price: '40k' },
  { name: 'Tắm nấm, bọ >15kg', price: '70k' },
  { name: 'Cắt móng, cạo bàn', price: '30k - 70k' },
  { name: 'Cạo bụng, hậu môn', price: '20k' },
  { name: 'Vệ sinh tai', price: '20k' },
  { name: 'Bấm gọn mắt miệng', price: '20k' },
  { name: 'Gỡ rối lông', price: '30k - 300k' },
]

const GROOMING_PROCESS_CARDS = [
  {
    title: '(1) Tắm',
    time: '20p - 40p',
    items: ['Chải lông', 'Tắm xà bông lần 1', 'Vắt tuyến hôi', 'Xả nước', 'Tắm xà bông lần 2', 'Sấy khô lông', 'Chải bông lông', 'Thoa tinh dầu'],
  },
  {
    title: '(2) Vệ sinh',
    time: '10p - 20p',
    items: ['Cắt móng', 'Cạo bàn', 'Nhổ lông tai', 'Vệ sinh tai', 'Cạo lông bụng', 'Cạo lông hậu môn'],
  },
  {
    title: '(3) Cạo lông',
    time: '30p - 60p',
    items: ['Tư vấn cạo lông phù hợp.'],
  },
  {
    title: 'SPA',
    time: '2h30 - 4h00',
    items: ['Đầy đủ gói (1) + (2).', 'Tư vấn kiểu cắt tỉa phù hợp.', 'Giá chưa bao gồm phí gỡ rối lông nếu bé bị rối nặng.'],
  },
]

function formatWeightInput(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',')
}

function formatCurrencyInput(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(value))
}

function formatIntegerInput(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(value) ? '' : String(Math.round(value))
}

function normalizeCurrencyInput(value: string) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(digits))
}

function deriveHalfDayPrice(fullDayPrice: number | null | undefined) {
  return fullDayPrice === null || fullDayPrice === undefined ? null : Math.round(fullDayPrice / 2)
}

function parseWeightInput(value: string) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.')
  if (!normalized) return null
  const numberValue = Number(normalized)
  return Number.isFinite(numberValue) ? numberValue : null
}

function parseCurrencyInput(value: string) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  const numberValue = Number(digits)
  return Number.isFinite(numberValue) ? numberValue : null
}

function parseIntegerInput(value: string) {
  const normalized = String(value ?? '').replace(/[^\d-]/g, '')
  if (!normalized) return null
  const numberValue = Number(normalized)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : null
}

function toDateInputValue(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 10)
}

function getSpaRuleKey(weightBandId: string, packageCode: string) {
  return `${weightBandId}:${packageCode}`
}

function getHotelRuleKey(weightBandId: string, dayType: PricingDayType, species = '') {
  return `${weightBandId}:${dayType}:${species}`
}

function getHotelBandGroupKey(band: Pick<ServiceWeightBand, 'label' | 'minWeight' | 'maxWeight'>) {
  return `${band.label}:${band.minWeight}:${band.maxWeight ?? 'INF'}`
}

function buildBandDraft(band: ServiceWeightBand): BandDraft {
  return {
    label: band.label,
    minWeight: formatWeightInput(band.minWeight),
    maxWeight: formatWeightInput(band.maxWeight),
    sortOrder: String(band.sortOrder ?? 0),
  }
}

export function ServicePricingWorkspace({ mode }: { mode: PricingMode }) {
  const { hasAnyPermission } = useAuthorization()
  const queryClient = useQueryClient()
  const serviceType: PricingServiceType = mode === 'HOTEL' ? 'HOTEL' : 'GROOMING'
  const currentYear = new Date().getFullYear()
  const [species, setSpecies] = useState(SPECIES_OPTIONS[0].value)
  const [year, setYear] = useState(currentYear)
  const [dayType, setDayType] = useState<PricingDayType>('REGULAR')
  const [bandDrafts, setBandDrafts] = useState<Record<string, BandDraft>>({})
  const [newBand, setNewBand] = useState<BandDraft>({ label: '', minWeight: '', maxWeight: '', sortOrder: '99' })
  const [spaDrafts, setSpaDrafts] = useState<Record<string, SpaDraft>>({})
  const [hotelDrafts, setHotelDrafts] = useState<Record<string, HotelDraft>>({})
  const [newHoliday, setNewHoliday] = useState({ date: toDateInputValue(new Date()), name: '', notes: '' })
  const [previewForm, setPreviewForm] = useState({
    species: SPECIES_OPTIONS[0].value,
    weight: '5',
    checkIn: `${toDateInputValue(new Date())}T09:00`,
    checkOut: `${toDateInputValue(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))}T18:00`,
  })
  const canManagePricing = mode === 'HOTEL'
    ? hasAnyPermission(['hotel.update', 'settings.pricing_policy.manage'])
    : hasAnyPermission(['grooming.update', 'settings.pricing_policy.manage'])
  const permissionError = mode === 'HOTEL'
    ? 'Bạn không có quyền cập nhật bảng giá Hotel.'
    : 'Bạn không có quyền cập nhật bảng giá Grooming / SPA.'
  const ensureCanManagePricing = () => {
    if (canManagePricing) return true
    toast.error(permissionError)
    return false
  }

  const bandsQuery = useQuery({
    queryKey: ['pricing', 'weight-bands', serviceType, mode === 'HOTEL' ? '__ALL__' : species],
    queryFn: () => pricingApi.getWeightBands({ serviceType, ...(mode === 'GROOMING' ? { species } : {}), isActive: true }),
  })

  const spaRulesQuery = useQuery({
    queryKey: ['pricing', 'spa-rules', species],
    queryFn: () => pricingApi.getSpaRules({ species, isActive: true }),
    enabled: mode === 'GROOMING',
  })

  const hotelRulesQuery = useQuery({
    queryKey: ['pricing', 'hotel-rules', year],
    queryFn: () => pricingApi.getHotelRules({ year, isActive: true }),
    enabled: mode === 'HOTEL',
  })

  const holidaysQuery = useQuery({
    queryKey: ['pricing', 'holidays', year],
    queryFn: () => pricingApi.getHolidays({ year, isActive: true }),
    enabled: mode === 'HOTEL',
  })

  const rawBands = bandsQuery.data ?? []
  const spaRules = spaRulesQuery.data ?? []
  const hotelRules = hotelRulesQuery.data ?? []
  const holidays = holidaysQuery.data ?? []

  const bands = useMemo(() => {
    if (mode !== 'HOTEL') return rawBands

    const grouped = new Map<string, ServiceWeightBand[]>()
    for (const band of rawBands) {
      const key = getHotelBandGroupKey(band)
      grouped.set(key, [...(grouped.get(key) ?? []), band])
    }

    return Array.from(grouped.values())
      .map((group) =>
        [...group].sort((left, right) => {
          const leftPriority = left.species === null ? 0 : left.species === SPECIES_OPTIONS[0].value ? 1 : 2
          const rightPriority = right.species === null ? 0 : right.species === SPECIES_OPTIONS[0].value ? 1 : 2
          if (leftPriority !== rightPriority) return leftPriority - rightPriority
          if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
          return left.minWeight - right.minWeight
        })[0]!,
      )
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
        return left.minWeight - right.minWeight
      })
  }, [mode, rawBands])

  const hotelBandIdMap = useMemo(() => {
    const next = new Map<string, string>()
    if (mode !== 'HOTEL') return next

    const representativeByGroup = new Map<string, string>()
    for (const band of bands) representativeByGroup.set(getHotelBandGroupKey(band), band.id)
    for (const band of rawBands) {
      const groupKey = getHotelBandGroupKey(band)
      const representativeId = representativeByGroup.get(groupKey)
      if (representativeId) next.set(band.id, representativeId)
    }
    return next
  }, [bands, mode, rawBands])

  useEffect(() => {
    const nextDrafts: Record<string, BandDraft> = {}
    for (const band of bands) nextDrafts[band.id] = buildBandDraft(band)
    setBandDrafts(nextDrafts)
  }, [bands])

  useEffect(() => {
    if (mode !== 'GROOMING') return
    const nextDrafts: Record<string, SpaDraft> = {}
    for (const rule of spaRules) {
      nextDrafts[getSpaRuleKey(rule.weightBandId, rule.packageCode)] = {
        id: rule.id,
        price: formatCurrencyInput(rule.price),
        durationMinutes: formatIntegerInput(rule.durationMinutes),
      }
    }
    setSpaDrafts(nextDrafts)
  }, [mode, spaRules])

  useEffect(() => {
    if (mode !== 'HOTEL') return
    const nextDrafts: Record<string, HotelDraft> = {}
    for (const rule of hotelRules) {
      const representativeBandId = hotelBandIdMap.get(rule.weightBandId) ?? rule.weightBandId
      const ruleSpecies = rule.species?.trim()
      if (!ruleSpecies) continue
      nextDrafts[getHotelRuleKey(representativeBandId, rule.dayType, ruleSpecies)] = {
        id: rule.id,
        fullDayPrice: formatCurrencyInput(rule.fullDayPrice),
      }
    }
    setHotelDrafts(nextDrafts)
  }, [hotelBandIdMap, hotelRules, mode])

  const invalidSpaCells = useMemo(() => {
    if (mode !== 'GROOMING') return 0
    let count = 0
    for (const band of bands) {
      for (const pkg of SPA_PACKAGES) {
        const draft = spaDrafts[getSpaRuleKey(band.id, pkg.code)]
        if (!draft?.price) count += 1
      }
    }
    return count
  }, [bands, mode, spaDrafts])

  const invalidHotelCells = useMemo(() => {
    if (mode !== 'HOTEL') return 0
    let count = 0
    for (const band of bands) {
      for (const option of DAY_TYPE_OPTIONS) {
        for (const speciesOption of HOTEL_SPECIES_COLUMNS) {
          const draft = hotelDrafts[getHotelRuleKey(band.id, option.value, speciesOption.value)]
          if (!draft?.fullDayPrice) count += 1
        }
      }
    }
    return count
  }, [bands, hotelDrafts, mode])

  const invalidatePricing = () => {
    queryClient.invalidateQueries({ queryKey: ['pricing'] })
  }

  const presetBandsMutation = useMutation({
    mutationFn: () => pricingApi.createPresetWeightBands(mode === 'HOTEL' ? { serviceType } : { serviceType, species }),
    onSuccess: () => {
      invalidatePricing()
      toast.success('Đã tạo hạng cân mẫu')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không tạo được hạng cân mẫu'),
  })

  const saveBandMutation = useMutation({
    mutationFn: (payload: Parameters<typeof pricingApi.upsertWeightBand>[0]) => pricingApi.upsertWeightBand(payload),
    onSuccess: () => {
      setNewBand({ label: '', minWeight: '', maxWeight: '', sortOrder: '99' })
      invalidatePricing()
      toast.success('Đã lưu hạng cân')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không lưu được hạng cân'),
  })

  const removeBandMutation = useMutation({
    mutationFn: pricingApi.deactivateWeightBand,
    onSuccess: () => {
      invalidatePricing()
      toast.success('Đã tắt hạng cân')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không tắt được hạng cân'),
  })

  const saveSpaMutation = useMutation({
    mutationFn: pricingApi.bulkUpsertSpaRules,
    onSuccess: () => {
      invalidatePricing()
      toast.success('Đã lưu bảng giá SPA')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không lưu được bảng giá SPA'),
  })

  const saveHotelMutation = useMutation({
    mutationFn: pricingApi.bulkUpsertHotelRules,
    onSuccess: () => {
      invalidatePricing()
      toast.success('Đã lưu bảng giá Hotel')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không lưu được bảng giá Hotel'),
  })

  const createHolidayMutation = useMutation({
    mutationFn: pricingApi.createHoliday,
    onSuccess: () => {
      setNewHoliday({ date: toDateInputValue(new Date()), name: '', notes: '' })
      invalidatePricing()
      toast.success('Đã thêm ngày lễ')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thêm được ngày lễ'),
  })

  const toggleHolidayMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => pricingApi.updateHoliday(id, { isActive }),
    onSuccess: invalidatePricing,
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không cập nhật được ngày lễ'),
  })

  const previewMutation = useMutation({
    mutationFn: () => {
      const weight = parseWeightInput(previewForm.weight)
      if (weight === null) throw new Error('Cân nặng không hợp lệ')
      return hotelApi.calculatePrice({
        species: previewForm.species,
        weight,
        checkIn: new Date(previewForm.checkIn).toISOString(),
        checkOut: new Date(previewForm.checkOut).toISOString(),
      })
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || error?.message || 'Không preview được giá Hotel'),
  })

  const saveBand = (band?: ServiceWeightBand) => {
    if (!ensureCanManagePricing()) return
    const draft = band ? bandDrafts[band.id] : newBand
    const minWeight = parseWeightInput(draft.minWeight)
    const maxWeight = parseWeightInput(draft.maxWeight)
    const sortOrder = parseIntegerInput(draft.sortOrder) ?? 0
    if (!draft.label.trim() || minWeight === null) {
      toast.error('Cần nhập tên hạng cân và min kg')
      return
    }
    saveBandMutation.mutate({
      id: band?.id,
      serviceType,
      ...(mode === 'GROOMING' ? { species } : { species: null }),
      label: draft.label.trim(),
      minWeight,
      maxWeight,
      sortOrder,
      isActive: true,
    })
  }

  const saveSpaRules = () => {
    if (!ensureCanManagePricing()) return
    const rules = bands.flatMap((band) =>
      SPA_PACKAGES.flatMap((pkg) => {
        const draft = spaDrafts[getSpaRuleKey(band.id, pkg.code)]
        const price = parseCurrencyInput(draft?.price ?? '')
        if (price === null) return []
        return [{
          id: draft?.id,
          species,
          packageCode: pkg.code,
          weightBandId: band.id,
          price,
          durationMinutes: parseIntegerInput(draft?.durationMinutes ?? ''),
          isActive: true,
        }]
      }),
    )

    if (rules.length === 0) {
      toast.error('Chưa có giá SPA nào để lưu')
      return
    }
    saveSpaMutation.mutate(rules)
  }

  const saveHotelRules = () => {
    if (!ensureCanManagePricing()) return
    const rules = bands.flatMap((band) =>
      DAY_TYPE_OPTIONS.flatMap((option) => {
        return HOTEL_SPECIES_COLUMNS.flatMap((speciesOption) => {
          const draft = hotelDrafts[getHotelRuleKey(band.id, option.value, speciesOption.value)]
          const fullDayPrice = parseCurrencyInput(draft?.fullDayPrice ?? '')
          if (fullDayPrice === null) return []
          return [{
            id: draft?.id,
            year,
            species: speciesOption.value,
            weightBandId: band.id,
            dayType: option.value,
            halfDayPrice: deriveHalfDayPrice(fullDayPrice) ?? undefined,
            fullDayPrice,
            isActive: true,
          }]
        })
      }),
    )

    if (rules.length === 0) {
      toast.error('Chưa có giá Hotel nào để lưu')
      return
    }
    saveHotelMutation.mutate(rules)
  }

  const updateSpaDraft = (bandId: string, packageCode: string, patch: Partial<SpaDraft>) => {
    const key = getSpaRuleKey(bandId, packageCode)
    setSpaDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
  }

  const updateHotelDraft = (bandId: string, nextDayType: PricingDayType, nextSpecies: string, patch: Partial<HotelDraft>) => {
    const key = getHotelRuleKey(bandId, nextDayType, nextSpecies)
    setHotelDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
  }

  const title = mode === 'HOTEL' ? 'Bảng giá Hotel' : 'Bảng giá Grooming / SPA'
  const subtitle =
    mode === 'HOTEL'
      ? 'Tách hạng cân Hotel, giá ngày thường/ngày lễ và lịch ngày lễ để POS/order sinh đúng charge lines.'
      : 'Tách hạng cân Grooming riêng, cấu hình giá theo gói Tắm, Vệ sinh, Cạo và SPA.'
  const missingCount = mode === 'HOTEL' ? invalidHotelCells : invalidSpaCells

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <section className="rounded-[28px] border border-border bg-background-secondary/70 px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500/12 text-primary-500">
                {mode === 'HOTEL' ? <Hotel size={20} /> : <Sparkles size={20} />}
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-foreground">{title}</h2>
                <p className="mt-1 max-w-3xl text-sm text-foreground-muted">{subtitle}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {mode === 'GROOMING' ? (
              <div className="inline-flex rounded-2xl border border-border bg-background-base p-1">
                {SPECIES_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSpecies(option.value)}
                    className={cn(
                      'h-10 rounded-xl px-4 text-sm font-semibold transition-colors',
                      species === option.value ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            {mode === 'HOTEL' ? (
              <input
                type="number"
                value={year}
                onChange={(event) => setYear(Number(event.target.value) || currentYear)}
                className="h-12 w-28 rounded-2xl border border-border bg-background-base px-4 text-sm font-bold text-foreground outline-none focus:border-primary-500"
              />
            ) : null}
            <button
              type="button"
              onClick={() => {
                bandsQuery.refetch()
                spaRulesQuery.refetch()
                hotelRulesQuery.refetch()
                holidaysQuery.refetch()
              }}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-border bg-background-base px-4 text-sm font-semibold text-foreground hover:border-primary-500/60"
            >
              <RefreshCw size={15} className={bandsQuery.isRefetching ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="Hạng cân active" value={String(bands.length)} />
          <Metric label={mode === 'HOTEL' ? 'Ô giá thiếu' : 'Ô gói thiếu'} value={String(missingCount)} tone={missingCount > 0 ? 'warning' : 'success'} />
          <Metric label={mode === 'HOTEL' ? 'Ngày lễ active' : 'Gói dịch vụ'} value={mode === 'HOTEL' ? String(holidays.length) : String(SPA_PACKAGES.length)} />
        </div>
      </section>

      <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="min-h-0 rounded-[28px] border border-border bg-background-secondary/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-foreground-muted">Hạng cân</h3>
              <p className="mt-1 text-xs text-foreground-muted">Tách riêng cho {mode === 'HOTEL' ? 'Hotel' : 'Grooming/SPA'}.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!ensureCanManagePricing()) return
                presetBandsMutation.mutate()
              }}
              disabled={!canManagePricing || presetBandsMutation.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary-500/25 bg-primary-500/10 px-3 text-xs font-bold text-primary-500 disabled:opacity-50"
            >
              <Plus size={14} />
              Mẫu
            </button>
          </div>

          <div className="custom-scrollbar max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {bands.map((band) => {
              const draft = bandDrafts[band.id] ?? buildBandDraft(band)
              return (
                <div key={band.id} className="rounded-2xl border border-border bg-background-base p-3">
                  <div className="grid grid-cols-[1fr_72px_72px] gap-2">
                    <input
                      value={draft.label}
                      onChange={(event) => setBandDrafts((current) => ({ ...current, [band.id]: { ...draft, label: event.target.value } }))}
                      className="h-10 rounded-xl border border-border bg-background-secondary px-3 text-sm font-semibold text-foreground outline-none focus:border-primary-500"
                    />
                    <input
                      value={draft.minWeight}
                      onChange={(event) => setBandDrafts((current) => ({ ...current, [band.id]: { ...draft, minWeight: event.target.value } }))}
                      className="h-10 rounded-xl border border-border bg-background-secondary px-3 text-right text-sm font-semibold text-foreground outline-none focus:border-primary-500"
                      inputMode="decimal"
                    />
                    <input
                      value={draft.maxWeight}
                      onChange={(event) => setBandDrafts((current) => ({ ...current, [band.id]: { ...draft, maxWeight: event.target.value } }))}
                      className="h-10 rounded-xl border border-border bg-background-secondary px-3 text-right text-sm font-semibold text-foreground outline-none focus:border-primary-500"
                      inputMode="decimal"
                      placeholder="∞"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <input
                      value={draft.sortOrder}
                      onChange={(event) => setBandDrafts((current) => ({ ...current, [band.id]: { ...draft, sortOrder: event.target.value } }))}
                      className="h-9 w-20 rounded-xl border border-border bg-background-secondary px-3 text-right text-xs font-semibold text-foreground outline-none focus:border-primary-500"
                      inputMode="numeric"
                    />
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => saveBand(band)} disabled={!canManagePricing} className="inline-flex h-9 items-center gap-1 rounded-xl bg-primary-500 px-3 text-xs font-bold text-white disabled:opacity-50">
                        <Save size={13} />
                        Lưu
                      </button>
                      <button type="button" onClick={() => removeBandMutation.mutate(band.id)} disabled={!canManagePricing} className="inline-flex h-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 text-rose-400 disabled:opacity-50">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            <div className="rounded-2xl border border-dashed border-primary-500/35 bg-primary-500/5 p-3">
              <div className="grid grid-cols-[1fr_72px_72px] gap-2">
                <input value={newBand.label} onChange={(event) => setNewBand((current) => ({ ...current, label: event.target.value }))} placeholder="Tên band" className="h-10 rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500" />
                <input value={newBand.minWeight} onChange={(event) => setNewBand((current) => ({ ...current, minWeight: event.target.value }))} placeholder="Min" className="h-10 rounded-xl border border-border bg-background-base px-3 text-right text-sm text-foreground outline-none focus:border-primary-500" />
                <input value={newBand.maxWeight} onChange={(event) => setNewBand((current) => ({ ...current, maxWeight: event.target.value }))} placeholder="Max" className="h-10 rounded-xl border border-border bg-background-base px-3 text-right text-sm text-foreground outline-none focus:border-primary-500" />
              </div>
              <button type="button" onClick={() => saveBand()} disabled={!canManagePricing} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 text-sm font-bold text-white disabled:opacity-50">
                <Plus size={15} />
                Thêm hạng cân
              </button>
            </div>
          </div>
        </div>

        {mode === 'GROOMING' ? (
          <SpaPricingMatrix species={species} bands={bands} drafts={spaDrafts} onDraftChange={updateSpaDraft} onSave={saveSpaRules} isSaving={saveSpaMutation.isPending} canManagePricing={canManagePricing} />
        ) : (
          <HotelSpeciesPricingPanel
            bands={bands}
            drafts={hotelDrafts}
            dayType={dayType}
            setDayType={setDayType}
            onDraftChange={updateHotelDraft}
            onSave={saveHotelRules}
            isSaving={saveHotelMutation.isPending}
            holidays={holidays}
            newHoliday={newHoliday}
            setNewHoliday={setNewHoliday}
            onCreateHoliday={() => {
              if (!ensureCanManagePricing()) return
              if (!newHoliday.date || !newHoliday.name.trim()) {
                toast.error('Cần nhập ngày và tên ngày lễ')
                return
              }
              createHolidayMutation.mutate(newHoliday)
            }}
            onToggleHoliday={(id, isActive) => {
              if (!ensureCanManagePricing()) return
              toggleHolidayMutation.mutate({ id, isActive })
            }}
            previewForm={previewForm}
            setPreviewForm={setPreviewForm}
            onPreview={() => previewMutation.mutate()}
            preview={previewMutation.data}
            isPreviewing={previewMutation.isPending}
            canManagePricing={canManagePricing}
            permissionHint={permissionError}
          />
        )}
      </section>
    </div>
  )
}

function HotelSpeciesPricingPanel({
  bands,
  drafts,
  dayType,
  setDayType,
  onDraftChange,
  onSave,
  isSaving,
  holidays,
  newHoliday,
  setNewHoliday,
  onCreateHoliday,
  onToggleHoliday,
  previewForm,
  setPreviewForm,
  onPreview,
  preview,
  isPreviewing,
  canManagePricing,
  permissionHint,
}: {
  bands: ServiceWeightBand[]
  drafts: Record<string, HotelDraft>
  dayType: PricingDayType
  setDayType: (value: PricingDayType) => void
  onDraftChange: (bandId: string, dayType: PricingDayType, species: string, patch: Partial<HotelDraft>) => void
  onSave: () => void
  isSaving: boolean
  holidays: Array<{ id: string; date: string; name: string; notes?: string | null; isActive: boolean }>
  newHoliday: { date: string; name: string; notes: string }
  setNewHoliday: (value: { date: string; name: string; notes: string }) => void
  onCreateHoliday: () => void
  onToggleHoliday: (id: string, isActive: boolean) => void
  previewForm: { species: string; weight: string; checkIn: string; checkOut: string }
  setPreviewForm: (value: { species: string; weight: string; checkIn: string; checkOut: string }) => void
  onPreview: () => void
  preview?: Awaited<ReturnType<typeof hotelApi.calculatePrice>>
  isPreviewing: boolean
  canManagePricing: boolean
  permissionHint: string
}) {
  return (
    <div className="grid min-h-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-h-0 rounded-[28px] border border-border bg-background-secondary/70 p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-foreground">Bảng giá Hotel</h3>
            <p className="mt-1 text-sm text-foreground-muted">Nhập giá theo ngày. Thanh toán sẽ lấy số ngày x đơn giá/ngày.</p>
          </div>
          <button type="button" onClick={onSave} disabled={!canManagePricing || isSaving || bands.length === 0} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-bold text-white disabled:opacity-50">
            <Save size={16} />
            Lưu bảng giá Hotel
          </button>
        </div>
        {!canManagePricing ? <p className="mb-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">{permissionHint}</p> : null}

        <div className="mb-3 inline-flex rounded-2xl border border-border bg-background-base p-1">
          {DAY_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDayType(option.value)}
              className={cn(
                'h-10 rounded-xl px-4 text-sm font-semibold transition-colors',
                dayType === option.value ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground',
              )}
              title={option.hint}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="custom-scrollbar overflow-auto rounded-2xl border border-border bg-background-base">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-background-secondary">
              <tr className="border-b border-border">
                <th className="w-40 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">Hạng cân</th>
                {HOTEL_SPECIES_COLUMNS.map((speciesOption) => (
                  <th key={speciesOption.value} className="px-3 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">
                    {speciesOption.label} / ngày
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bands.length === 0 ? (
                <tr>
                  <td colSpan={HOTEL_SPECIES_COLUMNS.length + 1} className="px-4 py-12 text-center text-sm text-foreground-muted">
                    Chưa có hạng cân. Bấm "Mẫu" để tạo bộ hạng cân Hotel.
                  </td>
                </tr>
              ) : bands.map((band) => (
                <tr key={band.id} className="border-b border-border/50 last:border-b-0">
                  <td className="bg-background-secondary/60 px-4 py-3 font-black text-foreground">{band.label}</td>
                  {HOTEL_SPECIES_COLUMNS.map((speciesOption) => {
                    const draft = drafts[getHotelRuleKey(band.id, dayType, speciesOption.value)] ?? { fullDayPrice: '' }
                    return (
                      <td key={speciesOption.value} className="px-3 py-3">
                        <PriceInput
                          value={draft.fullDayPrice}
                          onChange={(value) => onDraftChange(band.id, dayType, speciesOption.value, { fullDayPrice: value })}
                          placeholder="0 / ngày"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-4">
        <div className="rounded-[28px] border border-border bg-background-secondary/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays size={18} className="text-primary-500" />
            <h3 className="text-base font-black text-foreground">Lịch ngày lễ</h3>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <input type="date" value={newHoliday.date} onChange={(event) => setNewHoliday({ ...newHoliday, date: event.target.value })} disabled={!canManagePricing} className="h-11 rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500 disabled:opacity-60" />
            <input value={newHoliday.name} onChange={(event) => setNewHoliday({ ...newHoliday, name: event.target.value })} disabled={!canManagePricing} placeholder="Tên ngày lễ" className="h-11 rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500 disabled:opacity-60" />
          </div>
          <input value={newHoliday.notes} onChange={(event) => setNewHoliday({ ...newHoliday, notes: event.target.value })} disabled={!canManagePricing} placeholder="Ghi chú" className="mt-2 h-11 w-full rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500 disabled:opacity-60" />
          <button type="button" onClick={onCreateHoliday} disabled={!canManagePricing} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 text-sm font-bold text-white disabled:opacity-50">
            <Plus size={15} />
            Thêm ngày lễ
          </button>

          <div className="custom-scrollbar mt-3 max-h-52 space-y-2 overflow-y-auto">
            {holidays.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-foreground-muted">Chưa có ngày lễ active trong năm.</p>
            ) : holidays.map((holiday) => (
              <div key={holiday.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background-base px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{holiday.name}</p>
                  <p className="text-xs text-foreground-muted">{new Date(holiday.date).toLocaleDateString('vi-VN')}</p>
                </div>
                <button type="button" onClick={() => onToggleHoliday(holiday.id, !holiday.isActive)} disabled={!canManagePricing} className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-foreground-muted hover:text-foreground disabled:opacity-50">
                  {holiday.isActive ? 'Tắt' : 'Bật'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-border bg-background-secondary/70 p-4">
          <h3 className="text-base font-black text-foreground">Preview charge lines</h3>
          <p className="mt-1 text-sm text-foreground-muted">Kiểm tra nhanh ca có cả ngày thường và ngày lễ.</p>
          <div className="mt-3 grid gap-2">
            <div className="inline-flex rounded-2xl border border-border bg-background-base p-1">
              {HOTEL_SPECIES_COLUMNS.map((speciesOption) => (
                <button
                  key={speciesOption.value}
                  type="button"
                  onClick={() => setPreviewForm({ ...previewForm, species: speciesOption.value })}
                  className={cn(
                    'h-10 rounded-xl px-4 text-sm font-semibold transition-colors',
                    previewForm.species === speciesOption.value ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground',
                  )}
                >
                  {speciesOption.label}
                </button>
              ))}
            </div>
            <input value={previewForm.weight} onChange={(event) => setPreviewForm({ ...previewForm, weight: event.target.value })} placeholder="Cân nặng" className="h-11 rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500" />
            <input type="datetime-local" value={previewForm.checkIn} onChange={(event) => setPreviewForm({ ...previewForm, checkIn: event.target.value })} className="h-11 rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500" />
            <input type="datetime-local" value={previewForm.checkOut} onChange={(event) => setPreviewForm({ ...previewForm, checkOut: event.target.value })} className="h-11 rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500" />
            <button type="button" onClick={onPreview} disabled={isPreviewing} className="h-11 rounded-xl bg-primary-500 text-sm font-bold text-white disabled:opacity-50">
              Preview
            </button>
          </div>
          {preview ? (
            <div className="mt-3 space-y-2">
              {preview.chargeLines.map((line, index) => (
                <div key={`${line.label}-${index}`} className="rounded-2xl border border-border bg-background-base p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-foreground">{line.label}</p>
                    <p className="text-sm font-black text-primary-500">{formatCurrency(line.subtotal)}</p>
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">{line.quantityDays} ngày x {formatCurrency(line.unitPrice)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-2xl bg-primary-500/10 px-3 py-2 text-sm font-black text-primary-500">
                <span>Tổng</span>
                <span>{formatCurrency(preview.totalPrice)}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warning' }) {
  return (
    <div className="rounded-2xl border border-border bg-background-base px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">{label}</p>
      <p className={cn('mt-1 text-2xl font-black text-foreground', tone === 'success' ? 'text-emerald-400' : tone === 'warning' ? 'text-amber-400' : '')}>{value}</p>
    </div>
  )
}

function PriceInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(normalizeCurrencyInput(event.target.value))}
      placeholder={placeholder ?? '0'}
      inputMode="numeric"
      className={cn(
        'h-11 w-full min-w-[112px] rounded-xl border bg-background-base px-3 text-right text-sm font-bold tabular-nums text-foreground outline-none transition-colors focus:border-primary-500',
        value ? 'border-border' : 'border-amber-500/35 bg-amber-500/5',
      )}
    />
  )
}

function SpaPricingMatrix({
  species,
  bands,
  drafts,
  onDraftChange,
  onSave,
  isSaving,
  canManagePricing,
}: {
  species: string
  bands: ServiceWeightBand[]
  drafts: Record<string, SpaDraft>
  onDraftChange: (bandId: string, packageCode: string, patch: Partial<SpaDraft>) => void
  onSave: () => void
  isSaving: boolean
  canManagePricing: boolean
}) {
  return (
    <div className="min-h-0 rounded-[28px] border border-border bg-background-secondary/70 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-black text-foreground">Ma trận giá SPA</h3>
          <p className="mt-1 text-sm text-foreground-muted">Mỗi ô là một rule theo hạng cân và gói dịch vụ.</p>
        </div>
        <button type="button" onClick={onSave} disabled={!canManagePricing || isSaving || bands.length === 0} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-bold text-white disabled:opacity-50">
          <Save size={16} />
          Lưu bảng giá SPA
        </button>
      </div>

      <div className="custom-scrollbar overflow-auto rounded-2xl border border-border bg-background-base">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-background-secondary">
            <tr className="border-b border-border">
              <th className="w-36 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">Hạng cân</th>
              {SPA_PACKAGES.map((pkg) => (
                <th key={pkg.code} className="px-3 py-3 text-center text-xs font-black uppercase tracking-[0.08em] text-foreground-muted">{pkg.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bands.length === 0 ? (
              <tr><td colSpan={SPA_PACKAGES.length + 1} className="px-4 py-12 text-center text-sm text-foreground-muted">Chưa có hạng cân. Bấm “Mẫu” để tạo bộ hạng cân Grooming.</td></tr>
            ) : bands.map((band) => (
              <tr key={band.id} className="border-b border-border/50 last:border-b-0">
                <td className="bg-background-secondary/60 px-4 py-3 font-black text-foreground">{band.label}</td>
                {SPA_PACKAGES.map((pkg) => {
                  const draft = drafts[getSpaRuleKey(band.id, pkg.code)] ?? { price: '', durationMinutes: '' }
                  return (
                    <td key={pkg.code} className="px-3 py-3 align-top">
                      <PriceInput value={draft.price} onChange={(value) => onDraftChange(band.id, pkg.code, { price: value })} />
                      <input
                        value={draft.durationMinutes}
                        onChange={(event) => onDraftChange(band.id, pkg.code, { durationMinutes: event.target.value })}
                        placeholder="phút"
                        inputMode="numeric"
                        className="mt-2 h-9 w-full rounded-xl border border-border bg-background-secondary px-3 text-right text-xs font-semibold text-foreground outline-none focus:border-primary-500"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HotelPricingPanel({
  bands,
  drafts,
  dayType,
  setDayType,
  onDraftChange,
  onSave,
  isSaving,
  holidays,
  newHoliday,
  setNewHoliday,
  onCreateHoliday,
  onToggleHoliday,
  previewForm,
  setPreviewForm,
  onPreview,
  preview,
  isPreviewing,
}: {
  bands: ServiceWeightBand[]
  drafts: Record<string, HotelDraft>
  dayType: PricingDayType
  setDayType: (value: PricingDayType) => void
  onDraftChange: (...args: any[]) => void
  onSave: () => void
  isSaving: boolean
  holidays: Array<{ id: string; date: string; name: string; notes?: string | null; isActive: boolean }>
  newHoliday: { date: string; name: string; notes: string }
  setNewHoliday: (value: { date: string; name: string; notes: string }) => void
  onCreateHoliday: () => void
  onToggleHoliday: (id: string, isActive: boolean) => void
  previewForm: { species: string; weight: string; checkIn: string; checkOut: string }
  setPreviewForm: (value: { species: string; weight: string; checkIn: string; checkOut: string }) => void
  onPreview: () => void
  preview?: Awaited<ReturnType<typeof hotelApi.calculatePrice>>
  isPreviewing: boolean
}) {
  return (
    <div className="grid min-h-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-h-0 rounded-[28px] border border-border bg-background-secondary/70 p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-foreground">Ma trận giá Hotel</h3>
            <p className="mt-1 text-sm text-foreground-muted">Một band có hai bộ giá: ngày thường và ngày lễ.</p>
          </div>
          <button type="button" onClick={onSave} disabled={isSaving || bands.length === 0} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-bold text-white disabled:opacity-50">
            <Save size={16} />
            Lưu bảng giá Hotel
          </button>
        </div>

        <div className="mb-3 inline-flex rounded-2xl border border-border bg-background-base p-1">
          {DAY_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDayType(option.value)}
              className={cn(
                'h-10 rounded-xl px-4 text-sm font-semibold transition-colors',
                dayType === option.value ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground',
              )}
              title={option.hint}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="custom-scrollbar overflow-auto rounded-2xl border border-border bg-background-base">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-background-secondary">
              <tr className="border-b border-border">
                <th className="w-40 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">Hạng cân</th>
                <th className="px-3 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">Nửa ngày</th>
                <th className="px-3 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">Một ngày</th>
              </tr>
            </thead>
            <tbody>
              {bands.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-12 text-center text-sm text-foreground-muted">Chưa có hạng cân. Bấm “Mẫu” để tạo bộ hạng cân Hotel.</td></tr>
              ) : bands.map((band) => {
                const draft = drafts[getHotelRuleKey(band.id, dayType)] ?? { fullDayPrice: '' }
                const halfDayPrice = deriveHalfDayPrice(parseCurrencyInput(draft.fullDayPrice))
                return (
                  <tr key={band.id} className="border-b border-border/50 last:border-b-0">
                    <td className="bg-background-secondary/60 px-4 py-3 font-black text-foreground">{band.label}</td>
                    <td className="px-3 py-3">
                      <div className="flex h-11 items-center justify-end rounded-xl border border-border bg-background-secondary px-3 text-right text-sm font-bold tabular-nums text-foreground">
                        {halfDayPrice === null ? '-' : formatCurrency(halfDayPrice)}
                      </div>
                      <p className="mt-1 text-right text-[11px] text-foreground-muted">Tự suy ra từ giá 1 ngày</p>
                    </td>
                    <td className="px-3 py-3"><PriceInput value={draft.fullDayPrice} onChange={(value) => onDraftChange(band.id, dayType, { fullDayPrice: value })} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-4">
        <div className="rounded-[28px] border border-border bg-background-secondary/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays size={18} className="text-primary-500" />
            <h3 className="text-base font-black text-foreground">Lịch ngày lễ</h3>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <input type="date" value={newHoliday.date} onChange={(event) => setNewHoliday({ ...newHoliday, date: event.target.value })} className="h-11 rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500" />
            <input value={newHoliday.name} onChange={(event) => setNewHoliday({ ...newHoliday, name: event.target.value })} placeholder="Tên ngày lễ" className="h-11 rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500" />
          </div>
          <input value={newHoliday.notes} onChange={(event) => setNewHoliday({ ...newHoliday, notes: event.target.value })} placeholder="Ghi chú" className="mt-2 h-11 w-full rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500" />
          <button type="button" onClick={onCreateHoliday} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 text-sm font-bold text-white">
            <Plus size={15} />
            Thêm ngày lễ
          </button>

          <div className="custom-scrollbar mt-3 max-h-52 space-y-2 overflow-y-auto">
            {holidays.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-foreground-muted">Chưa có ngày lễ active trong năm.</p>
            ) : holidays.map((holiday) => (
              <div key={holiday.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background-base px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{holiday.name}</p>
                  <p className="text-xs text-foreground-muted">{new Date(holiday.date).toLocaleDateString('vi-VN')}</p>
                </div>
                <button type="button" onClick={() => onToggleHoliday(holiday.id, !holiday.isActive)} className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-foreground-muted hover:text-foreground">
                  {holiday.isActive ? 'Tắt' : 'Bật'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-border bg-background-secondary/70 p-4">
          <h3 className="text-base font-black text-foreground">Preview charge lines</h3>
          <p className="mt-1 text-sm text-foreground-muted">Kiểm tra nhanh ca có cả ngày thường và ngày lễ.</p>
          <div className="mt-3 grid gap-2">
            <input value={previewForm.weight} onChange={(event) => setPreviewForm({ ...previewForm, weight: event.target.value })} placeholder="Cân nặng" className="h-11 rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500" />
            <input type="datetime-local" value={previewForm.checkIn} onChange={(event) => setPreviewForm({ ...previewForm, checkIn: event.target.value })} className="h-11 rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500" />
            <input type="datetime-local" value={previewForm.checkOut} onChange={(event) => setPreviewForm({ ...previewForm, checkOut: event.target.value })} className="h-11 rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500" />
            <button type="button" onClick={onPreview} disabled={isPreviewing} className="h-11 rounded-xl bg-primary-500 text-sm font-bold text-white disabled:opacity-50">
              Preview
            </button>
          </div>
          {preview ? (
            <div className="mt-3 space-y-2">
              {preview.chargeLines.map((line, index) => (
                <div key={`${line.label}-${index}`} className="rounded-2xl border border-border bg-background-base p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-foreground">{line.label}</p>
                    <p className="text-sm font-black text-primary-500">{formatCurrency(line.subtotal)}</p>
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">{line.quantityDays} ngày x {formatCurrency(line.unitPrice)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-2xl bg-primary-500/10 px-3 py-2 text-sm font-black text-primary-500">
                <span>Tổng</span>
                <span>{formatCurrency(preview.totalPrice)}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
