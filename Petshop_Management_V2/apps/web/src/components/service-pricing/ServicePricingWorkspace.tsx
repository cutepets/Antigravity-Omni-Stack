'use client'
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import {
  pricingApi,
  type HolidayCalendarDate,
  type HotelDaycareRulePayload,
  type HotelRulePayload,
  type PricingServiceType,
} from '@/lib/api/pricing.api'
import { useAuthorization } from '@/hooks/useAuthorization'
import { GroomingPricingMatrix } from './grooming/GroomingPricingMatrix'
import { createGroomingPricingState, fillEmptyGroomingSkus } from './grooming/grooming-pricing.utils'
import { UnifiedHotelPricingPanel } from './hotel/UnifiedHotelPricingPanel'
import {
  buildHotelBandIdMap,
  fillEmptyHotelSkus,
  getCanonicalHotelBands,
  getHotelDaycareRuleKey,
  hydrateHotelDaycareDrafts,
  hydrateHotelDrafts,
  hydrateHotelExtraServiceDrafts,
} from './hotel/hotel-pricing.utils'
import { DAY_TYPE_OPTIONS, SPECIES_OPTIONS } from './shared/pricing-constants'
import {
  buildBandDraft,
  buildServicePricingSku,
  createDraftKey,
  createHolidayDraft,
  getHolidayDraftFromCalendarDate,
  getHotelRuleKey,
  getSpaFlatRuleMatchKey,
  getSpaRuleKey,
  hasHotelExtraServiceContent,
  parseCurrencyInput,
  parseIntegerInput,
  parseWeightInput,
  toDateInputValue,
} from './shared/pricing-helpers'
import type {
  BandDraft,
  HolidayDraft,
  HotelDaycareDraft,
  HotelDraft,
  HotelExtraServiceDraft,
  PricingMode,
  SpaDraft,
  SpaServiceColumn,
  FlatRateDraft,
} from './shared/pricing-types'

export function ServicePricingWorkspace({ mode }: { mode: PricingMode }) {
  const { hasAnyPermission } = useAuthorization()
  const queryClient = useQueryClient()
  const serviceType: PricingServiceType = mode === 'HOTEL' ? 'HOTEL' : 'GROOMING'
  const [species, setSpecies] = useState(SPECIES_OPTIONS[0].value)
  const year = new Date().getFullYear()
  const [bandDrafts, setBandDrafts] = useState<BandDraft[]>([])
  const [spaServiceColumns, setSpaServiceColumns] = useState<SpaServiceColumn[]>([])
  const [spaDrafts, setSpaDrafts] = useState<Record<string, SpaDraft>>({})
  const [flatRateDrafts, setFlatRateDrafts] = useState<FlatRateDraft[]>([])
  const [hotelExtraServiceDrafts, setHotelExtraServiceDrafts] = useState<HotelExtraServiceDraft[]>([])
  const [hotelDrafts, setHotelDrafts] = useState<Record<string, HotelDraft>>({})
  const [hotelDaycareDrafts, setHotelDaycareDrafts] = useState<Record<string, HotelDaycareDraft>>({})
  const [removedBandIds, setRemovedBandIds] = useState<string[]>([])
  const [newHoliday, setNewHoliday] = useState<HolidayDraft>(() => createHolidayDraft())
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null)
  const [isSavingGrooming, setIsSavingGrooming] = useState(false)
  const [isSavingHotel, setIsSavingHotel] = useState(false)

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
    queryKey: ['pricing', 'spa-rules', '__ALL__'],
    queryFn: () => pricingApi.getSpaRules({ isActive: true }),
    enabled: mode === 'GROOMING',
  })

  const hotelRulesQuery = useQuery({
    queryKey: ['pricing', 'hotel-rules', year],
    queryFn: () => pricingApi.getHotelRules({ year, isActive: true }),
    enabled: mode === 'HOTEL',
  })

  const hotelDaycareRulesQuery = useQuery({
    queryKey: ['pricing', 'hotel-daycare-rules', 10],
    queryFn: () => pricingApi.getHotelDaycareRules({ packageDays: 10, isActive: true }),
    enabled: mode === 'HOTEL',
  })

  const holidaysQuery = useQuery({
    queryKey: ['pricing', 'holidays', year],
    queryFn: () => pricingApi.getHolidays({ year, isActive: true }),
    enabled: mode === 'HOTEL',
  })

  const hotelExtraServicesQuery = useQuery({
    queryKey: ['pricing', 'hotel-extra-services'],
    queryFn: () => pricingApi.getHotelExtraServices(),
    enabled: mode === 'HOTEL',
  })

  const spaServiceImagesQuery = useQuery({
    queryKey: ['pricing', 'spa-service-images'],
    queryFn: () => pricingApi.getSpaServiceImages(),
    enabled: mode === 'GROOMING',
  })

  const spaServiceImagesMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of spaServiceImagesQuery.data ?? []) {
      map.set(item.packageCode, item.imageUrl)
    }
    return map
  }, [spaServiceImagesQuery.data])

  const rawBands = useMemo(() => bandsQuery.data ?? [], [bandsQuery.data])
  const spaRules = useMemo(() => spaRulesQuery.data ?? [], [spaRulesQuery.data])
  const hotelRules = useMemo(() => hotelRulesQuery.data ?? [], [hotelRulesQuery.data])
  const hotelDaycareRules = useMemo(() => hotelDaycareRulesQuery.data ?? [], [hotelDaycareRulesQuery.data])
  const holidays = useMemo(() => holidaysQuery.data ?? [], [holidaysQuery.data])
  const hotelExtraServices = useMemo(() => hotelExtraServicesQuery.data ?? [], [hotelExtraServicesQuery.data])

  const bands = useMemo(
    () => (mode === 'HOTEL' ? getCanonicalHotelBands(rawBands) : rawBands),
    [mode, rawBands],
  )

  const hotelBandIdMap = useMemo(
    () => (mode === 'HOTEL' ? buildHotelBandIdMap(rawBands, bands) : new Map<string, string>()),
    [bands, mode, rawBands],
  )

  useEffect(() => {
    setBandDrafts(bands.map((band) => buildBandDraft(band)))
  }, [bands])

  useEffect(() => {
    if (mode !== 'GROOMING') return
    const nextState = createGroomingPricingState(spaRules, species)
    const columnsWithImages = nextState.serviceColumns.map((col) => ({
      ...col,
      imageUrl: spaServiceImagesMap.get(col.packageCode) ?? null,
    }))
    setSpaServiceColumns(columnsWithImages)
    setSpaDrafts(nextState.spaDrafts)
    setFlatRateDrafts(nextState.flatRateDrafts)
  }, [mode, spaRules, species, spaServiceImagesMap])

  useEffect(() => {
    if (mode !== 'HOTEL') return
    setHotelDrafts(hydrateHotelDrafts(bands, hotelRules, hotelBandIdMap))
  }, [bands, hotelBandIdMap, hotelRules, mode])

  useEffect(() => {
    if (mode !== 'HOTEL') return
    setHotelDaycareDrafts(hydrateHotelDaycareDrafts(bands, hotelDaycareRules, hotelBandIdMap))
  }, [bands, hotelBandIdMap, hotelDaycareRules, mode])

  useEffect(() => {
    if (mode !== 'HOTEL') return
    setHotelExtraServiceDrafts(hydrateHotelExtraServiceDrafts(hotelExtraServices))
  }, [hotelExtraServices, mode])

  useEffect(() => {
    setRemovedBandIds([])
  }, [mode, species])

  const invalidatePricing = () => {
    queryClient.invalidateQueries({ queryKey: ['pricing'] })
    queryClient.invalidateQueries({ queryKey: ['pos', 'pricing-suggestions'] })
  }

  const resetHolidayDraft = () => {
    setNewHoliday(createHolidayDraft())
    setEditingHolidayId(null)
  }

  const updateHolidayDraft = (patch: Partial<HolidayDraft>) => {
    setNewHoliday((current) => {
      const next = { ...current, ...patch }
      if (next.endDate < next.startDate) next.endDate = next.startDate
      return next
    })
  }

  const handleEditHoliday = (holiday: HolidayCalendarDate) => {
    setEditingHolidayId(holiday.id)
    setNewHoliday(getHolidayDraftFromCalendarDate(holiday))
  }

  const fillEmptySkus = () => {
    if (!ensureCanManagePricing()) return

    if (mode === 'GROOMING') {
      const nextState = fillEmptyGroomingSkus(bandDrafts, spaServiceColumns, spaDrafts, flatRateDrafts)
      setSpaDrafts(nextState.spaDrafts)
      setFlatRateDrafts(nextState.flatRateDrafts)
      toast.success(nextState.filledCount > 0 ? `Da set SKU tu dong cho ${nextState.filledCount} o trong.` : 'Khong co o SKU trong nao can set.')
      return
    }

    const nextState = fillEmptyHotelSkus(bandDrafts, hotelDrafts, hotelDaycareDrafts, hotelExtraServiceDrafts)
    setHotelDrafts(nextState.hotelDrafts)
    setHotelDaycareDrafts(nextState.hotelDaycareDrafts)
    setHotelExtraServiceDrafts(nextState.hotelExtraServiceDrafts)
    toast.success(nextState.filledCount > 0 ? `Da set SKU tu dong cho ${nextState.filledCount} o trong.` : 'Khong co o SKU trong nao can set.')
  }

  const createHolidayMutation = useMutation({
    mutationFn: pricingApi.createHoliday,
    onSuccess: () => {
      const today = toDateInputValue(new Date())
      setNewHoliday({ startDate: today, endDate: today, name: '', isRecurring: true })
      invalidatePricing()
      toast.success('Đã thêm ngày lễ')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thêm được ngày lễ'),
  })

  const updateHolidayMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: HolidayDraft }) => pricingApi.updateHoliday(id, data),
    onSuccess: () => {
      resetHolidayDraft()
      invalidatePricing()
      toast.success('Đã cập nhật kỳ lễ')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không lưu được kỳ lễ'),
  })

  const deleteHolidayMutation = useMutation({
    mutationFn: pricingApi.deactivateHoliday,
    onSuccess: (_, holidayId) => {
      if (editingHolidayId === holidayId) resetHolidayDraft()
      invalidatePricing()
      toast.success('Đã xóa kỳ lễ')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không xóa được kỳ lễ'),
  })

  const addBandRow = () => {
    const nextKey = createDraftKey('band')
    setBandDrafts((current) => [
      ...current,
      { key: nextKey, id: null, label: '', minWeight: '', maxWeight: '', sortOrder: String(current.length) },
    ])
  }

  const removeBandRow = (index: number) => {
    const band = bandDrafts[index]
    if (!band) return
    setBandDrafts((current) => current.filter((_, currentIndex) => currentIndex !== index))
    if (mode === 'GROOMING') {
      setSpaDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${band.key}:`))))
    } else {
      setHotelDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${band.key}:`))))
    }
    if (band.id) {
      const removedBandId = band.id
      setRemovedBandIds((current) => (current.includes(removedBandId) ? current : [...current, removedBandId]))
    }
  }

  const updateBandRow = (index: number, patch: Partial<BandDraft>) => {
    setBandDrafts((current) => current.map((band, currentIndex) => (currentIndex === index ? { ...band, ...patch } : band)))
  }

  const addSpaServiceColumn = () => {
    const nextKey = createDraftKey('service')
    setSpaServiceColumns((current) => [...current, { key: nextKey, packageCode: '' }])
  }

  const updateSpaServiceColumn = (serviceKey: string, packageCode: string) => {
    setSpaServiceColumns((current) => current.map((column) => (column.key === serviceKey ? { ...column, packageCode } : column)))
  }

  const handleSpaServiceImageUpload = async (column: SpaServiceColumn, file: File) => {
    if (!column.packageCode.trim()) return
    try {
      const result = await pricingApi.uploadSpaServiceImage(column.packageCode.trim(), file, column.packageCode.trim())
      // Update local state immediately
      setSpaServiceColumns((current) =>
        current.map((col) => (col.key === column.key ? { ...col, imageUrl: result.imageUrl } : col)),
      )
      // Invalidate query so F5 / next load shows persisted image
      queryClient.invalidateQueries({ queryKey: ['pricing', 'spa-service-images'] })
      toast.success('Đã lưu ảnh dịch vụ')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Lưu ảnh thất bại: ${msg}`)
    }
  }

  const removeSpaServiceColumn = (serviceKey: string) => {
    setSpaServiceColumns((current) => current.filter((column) => column.key !== serviceKey))
    setSpaDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => {
          const [, currentServiceKey] = key.split(':')
          return currentServiceKey !== serviceKey
        }),
      ),
    )
  }

  const saveGroomingMatrix = async () => {
    if (!ensureCanManagePricing()) return
    if (bandDrafts.length === 0) {
      toast.error('Bang gia Grooming dang khong co hang can nao. Hay tao hang can truoc khi luu.')
      return
    }

    const invalidBand = bandDrafts.some((draft) => !draft.label.trim() || parseWeightInput(draft.minWeight) === null)
    if (invalidBand) {
      toast.error('Cần nhập tên hạng cân và min kg cho tất cả các dòng')
      return
    }

    const invalidFlatRate = flatRateDrafts.some((draft) => {
      if (!draft.name.trim()) return false
      const minWeight = parseWeightInput(draft.minWeight)
      const maxWeight = parseWeightInput(draft.maxWeight)
      if (minWeight === null && maxWeight !== null) return true
      if (minWeight !== null && maxWeight !== null && maxWeight <= minWeight) return true
      return false
    })
    if (invalidFlatRate) {
      toast.error('Dịch vụ khác có khoảng cân không hợp lệ')
      return
    }

    const duplicateFlatRateSignatures = new Set<string>()
    for (const draft of flatRateDrafts) {
      if (!draft.name.trim()) continue
      const signature = getSpaFlatRuleMatchKey(
        draft.name,
        parseWeightInput(draft.minWeight),
        parseWeightInput(draft.maxWeight),
      )
      if (duplicateFlatRateSignatures.has(signature)) {
        toast.error('Dịch vụ khác đang bị trùng tên và khoảng cân')
        return
      }
      duplicateFlatRateSignatures.add(signature)
    }

    const normalizedServices = spaServiceColumns.map((column) => ({
      ...column,
      packageCode: column.packageCode.trim(),
    }))

    if (normalizedServices.some((column) => !column.packageCode)) {
      toast.error('Tên dịch vụ không được để trống')
      return
    }

    const duplicateServiceNames = new Set<string>()
    for (const column of normalizedServices) {
      const normalizedName = column.packageCode.toLocaleLowerCase()
      if (duplicateServiceNames.has(normalizedName)) {
        toast.error('Tên dịch vụ đang bị trùng')
        return
      }
      duplicateServiceNames.add(normalizedName)

      const hasPrice = bandDrafts.some((band) => {
        const draft = spaDrafts[getSpaRuleKey(band.key, column.key)]
        const price = parseCurrencyInput(draft?.price ?? '')
        return price !== null && price > 0
      })
      if (!hasPrice) {
        toast.error(`Dịch vụ "${column.packageCode}" chưa có giá nào. Vui lòng nhập giá cho ít nhất một hạng cân hoặc xóa dịch vụ.`)
        return
      }
    }

    setIsSavingGrooming(true)
    try {
      const bandIdByKey = new Map<string, string>()
      for (let index = 0; index < bandDrafts.length; index += 1) {
        const draft = bandDrafts[index]
        const savedBand = await pricingApi.upsertWeightBand({
          id: draft.id || undefined,
          serviceType: 'GROOMING',
          species,
          label: draft.label.trim(),
          minWeight: parseWeightInput(draft.minWeight) ?? 0,
          maxWeight: parseWeightInput(draft.maxWeight),
          sortOrder: index,
          isActive: true,
        })
        bandIdByKey.set(draft.key, savedBand.id)
      }

      const rules = bandDrafts.flatMap((band) =>
        normalizedServices.flatMap((column) => {
          const weightBandId = bandIdByKey.get(band.key)
          if (!weightBandId) return []
          const draft = spaDrafts[getSpaRuleKey(band.key, column.key)]
          const price = parseCurrencyInput(draft?.price ?? '')
          if (price === null || price === 0) return []
          return [{
            id: draft?.id,
            species,
            packageCode: column.packageCode,
            label: column.packageCode,
            weightBandId,
            sku: draft?.sku?.trim() || null,
            price,
            durationMinutes: parseIntegerInput(draft?.durationMinutes ?? ''),
            isActive: true,
          }]
        }),
      )

      const flatRateRules = flatRateDrafts
        .filter((draft) => draft.name.trim())
        .map((draft) => ({
          id: draft.id,
          species: null,
          packageCode: draft.name.trim(),
          label: draft.name.trim(),
          weightBandId: undefined,
          minWeight: parseWeightInput(draft.minWeight),
          maxWeight: parseWeightInput(draft.maxWeight),
          sku: draft.sku.trim() || null,
          price: parseCurrencyInput(draft.price) ?? 0,
          durationMinutes: parseIntegerInput(draft.durationMinutes ?? '') ?? null,
          isActive: true,
        }))
        .filter((draft) => draft.price > 0)

      if (rules.length === 0 && flatRateRules.length === 0) {
        toast.error('Bang gia Grooming khong co dong gia nao hop le de luu.')
        return false
      }

      await pricingApi.bulkUpsertSpaRules({ rules: [...rules, ...flatRateRules] })

      for (const bandId of removedBandIds) {
        await pricingApi.deactivateWeightBand(bandId)
      }

      setRemovedBandIds([])
      invalidatePricing()
      toast.success('Đã lưu bảng giá Grooming')
      return true
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không lưu được bảng giá Grooming')
      return false
    } finally {
      setIsSavingGrooming(false)
    }
  }

  const saveHotelMatrix = () => {
    if (!ensureCanManagePricing()) return

    const invalidBand = bandDrafts.some((draft) => !draft.label.trim() || parseWeightInput(draft.minWeight) === null)
    if (invalidBand) {
      toast.error('Cần nhập tên hạng cân và min kg cho tất cả các dòng')
      return
    }

    const invalidHotelExtraService = hotelExtraServiceDrafts.some((draft) => {
      if (!hasHotelExtraServiceContent(draft)) return false
      const minWeight = parseWeightInput(draft.minWeight)
      const maxWeight = parseWeightInput(draft.maxWeight)
      const hasMinWeightInput = draft.minWeight.trim().length > 0
      const hasMaxWeightInput = draft.maxWeight.trim().length > 0
      const price = parseCurrencyInput(draft.price)

      if (!draft.name.trim()) return true
      if (price === null || price <= 0) return true
      if (hasMinWeightInput && minWeight === null) return true
      if (hasMaxWeightInput && maxWeight === null) return true
      if (minWeight === null && maxWeight !== null) return true
      if (minWeight !== null && maxWeight !== null && maxWeight <= minWeight) return true
      return false
    })
    if (invalidHotelExtraService) {
      toast.error('Dịch vụ khác Hotel đang có dòng thiếu tên, giá hoặc khoảng cân không hợp lệ')
      return
    }

    const duplicateHotelExtraSignatures = new Set<string>()
    for (const draft of hotelExtraServiceDrafts) {
      if (!hasHotelExtraServiceContent(draft)) continue
      const signature = getSpaFlatRuleMatchKey(
        draft.name,
        parseWeightInput(draft.minWeight),
        parseWeightInput(draft.maxWeight),
      )
      if (duplicateHotelExtraSignatures.has(signature)) {
        toast.error('Dịch vụ khác Hotel đang bị trùng tên và khoảng cân')
        return
      }
      duplicateHotelExtraSignatures.add(signature)
    }

    setIsSavingHotel(true)
    return (async () => {
      try {
        const bandIdByKey = new Map<string, string>()
        for (let index = 0; index < bandDrafts.length; index += 1) {
          const draft = bandDrafts[index]
          const savedBand = await pricingApi.upsertWeightBand({
            id: draft.id || undefined,
            serviceType: 'HOTEL',
            species: null,
            label: draft.label.trim(),
            minWeight: parseWeightInput(draft.minWeight) ?? 0,
            maxWeight: parseWeightInput(draft.maxWeight),
            sortOrder: index,
            isActive: true,
          })
          bandIdByKey.set(draft.key, savedBand.id)
        }

        const rules: HotelRulePayload[] = []
        const daycareRules: HotelDaycareRulePayload[] = []
        for (const band of bandDrafts) {
          for (const option of DAY_TYPE_OPTIONS) {
            for (const speciesOption of SPECIES_OPTIONS) {
              const weightBandId = bandIdByKey.get(band.key)
              if (!weightBandId) continue

              const draft = hotelDrafts[getHotelRuleKey(band.key, option.value, speciesOption.value)]
              const fullDayPrice = parseCurrencyInput(draft?.fullDayPrice ?? '')
              const sharedSku = (
                hotelDrafts[getHotelRuleKey(band.key, 'REGULAR', speciesOption.value)]?.sku?.trim()
                || hotelDrafts[getHotelRuleKey(band.key, 'HOLIDAY', speciesOption.value)]?.sku?.trim()
                || draft?.sku?.trim()
                || ''
              )

              if (fullDayPrice === null || fullDayPrice === 0) {
                if (!draft?.id) continue
                rules.push({
                  id: draft.id,
                  year,
                  species: speciesOption.value,
                  weightBandId,
                  dayType: option.value,
                  sku: sharedSku || null,
                  fullDayPrice: 0,
                  isActive: false,
                })
                continue
              }

              rules.push({
                id: draft?.id,
                year,
                species: speciesOption.value,
                weightBandId,
                dayType: option.value,
                sku: sharedSku || null,
                fullDayPrice,
                isActive: true,
              })
            }
          }

          for (const speciesOption of SPECIES_OPTIONS) {
            const weightBandId = bandIdByKey.get(band.key)
            if (!weightBandId) continue

            const draft = hotelDaycareDrafts[getHotelDaycareRuleKey(band.key, speciesOption.value)]
            const price = parseCurrencyInput(draft?.price ?? '')
            if (price === null || price === 0) {
              if (!draft?.id) continue
              daycareRules.push({
                id: draft.id,
                species: speciesOption.value,
                weightBandId,
                packageDays: 10,
                sku: draft.sku?.trim() || null,
                price: 0,
                isActive: false,
              })
              continue
            }

            daycareRules.push({
              id: draft?.id,
              species: speciesOption.value,
              weightBandId,
              packageDays: 10,
              sku: draft?.sku?.trim() || null,
              price,
              isActive: true,
            })
          }
        }

        if (!rules.some((rule) => rule.isActive)) {
          toast.error('Chưa có giá Hotel nào để lưu')
          return false
        }

        const hotelExtraServicesPayload = hotelExtraServiceDrafts
          .filter((draft) => hasHotelExtraServiceContent(draft))
          .map((draft) => ({
            sku: draft.sku.trim() || null,
            name: draft.name.trim(),
            minWeight: parseWeightInput(draft.minWeight),
            maxWeight: parseWeightInput(draft.maxWeight),
            price: parseCurrencyInput(draft.price) ?? 0,
          }))

        await Promise.all([
          pricingApi.bulkUpsertHotelRules(rules),
          pricingApi.bulkUpsertHotelDaycareRules(daycareRules),
          pricingApi.bulkUpsertHotelExtraServices(hotelExtraServicesPayload),
        ])

        for (const bandId of removedBandIds) {
          await pricingApi.deactivateWeightBand(bandId)
        }

        setRemovedBandIds([])
        invalidatePricing()
        toast.success('Đã lưu bảng giá Hotel')
        return true
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Không lưu được bảng giá Hotel')
        return false
      } finally {
        setIsSavingHotel(false)
      }
    })()
  }

  const updateSpaDraft = (bandKey: string, serviceKey: string, patch: Partial<SpaDraft>) => {
    const key = getSpaRuleKey(bandKey, serviceKey)
    setSpaDrafts((current) => {
      const existing = current[key] || { sku: '', price: '', durationMinutes: '' }
      return { ...current, [key]: { ...existing, ...patch } }
    })
  }

  const updateHotelDraft = (bandId: string, nextDayType: 'REGULAR' | 'HOLIDAY', nextSpecies: string, patch: Partial<HotelDraft>) => {
    setHotelDrafts((current) => {
      const updates = { ...current }
      if ('sku' in patch) {
        const regularKey = getHotelRuleKey(bandId, 'REGULAR', nextSpecies)
        const holidayKey = getHotelRuleKey(bandId, 'HOLIDAY', nextSpecies)
        const existingRegular = updates[regularKey] || { sku: '', fullDayPrice: '' }
        const existingHoliday = updates[holidayKey] || { sku: '', fullDayPrice: '' }
        updates[regularKey] = { ...existingRegular, sku: patch.sku ?? '' }
        updates[holidayKey] = { ...existingHoliday, sku: patch.sku ?? '' }
      }
      const key = getHotelRuleKey(bandId, nextDayType, nextSpecies)
      const existing = updates[key] || { sku: '', fullDayPrice: '' }
      updates[key] = { ...existing, ...patch }
      return updates
    })
  }

  const updateHotelDaycareDraft = (bandId: string, nextSpecies: string, patch: Partial<HotelDaycareDraft>) => {
    setHotelDaycareDrafts((current) => {
      const key = getHotelDaycareRuleKey(bandId, nextSpecies)
      const existing = current[key] || { sku: '', price: '' }
      return { ...current, [key]: { ...existing, ...patch } }
    })
  }

  const handleExportExcel = async () => {
    try {
      const exportType = mode === 'GROOMING' ? 'grooming' : mode === 'HOTEL' ? 'hotel' : 'all'
      await pricingApi.exportExcel(exportType as any)
      toast.success('Đã tải xuống file Excel bảng giá')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không tải được file Excel')
    }
  }

  const handleImportExcel = async (file: File) => {
    try {
      const result = await pricingApi.importExcel(file)
      if (result.errors.length > 0) {
        toast.error(`Có lỗi: ${result.errors.join(', ')}`)
      } else {
        toast.success(`Đã nhập ${result.imported} dòng giá từ Excel`)
      }
      invalidatePricing()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không nhập được file Excel')
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="grid gap-4">
        {mode === 'GROOMING' ? (
          <div className="flex flex-col gap-4">
            <GroomingPricingMatrix
              bands={bandDrafts}
              serviceColumns={spaServiceColumns}
              drafts={spaDrafts}
              onBandChange={updateBandRow}
              onBandRemove={removeBandRow}
              onAddBand={addBandRow}
              onServiceChange={updateSpaServiceColumn}
              onServiceRemove={removeSpaServiceColumn}
              onAddService={addSpaServiceColumn}
              onServiceImageUpload={handleSpaServiceImageUpload}
              onDraftChange={updateSpaDraft}
              onSave={saveGroomingMatrix}
              onFillEmptySkus={fillEmptySkus}
              onExportExcel={handleExportExcel}
              onImportExcel={handleImportExcel}
              isSaving={isSavingGrooming}
              canManagePricing={canManagePricing}
              species={species}
              setSpecies={setSpecies}
              flatRateDrafts={flatRateDrafts}
              onFlatRateChange={setFlatRateDrafts}
            />
          </div>
        ) : (
          <UnifiedHotelPricingPanel
            bands={bandDrafts}
            drafts={hotelDrafts}
            hotelDaycareDrafts={hotelDaycareDrafts}
            onBandChange={updateBandRow}
            onBandRemove={removeBandRow}
            onAddBand={addBandRow}
            onDraftChange={updateHotelDraft}
            onHotelDaycareDraftChange={updateHotelDaycareDraft}
            onSave={saveHotelMatrix}
            onFillEmptySkus={fillEmptySkus}
            onExportExcel={handleExportExcel}
            onImportExcel={handleImportExcel}
            isSaving={isSavingHotel}
            holidays={holidays}
            hotelExtraServiceDrafts={hotelExtraServiceDrafts}
            onHotelExtraServiceDraftsChange={setHotelExtraServiceDrafts}
            newHoliday={newHoliday}
            editingHolidayId={editingHolidayId}
            onHolidayDraftChange={updateHolidayDraft}
            onSubmitHoliday={() => {
              if (!ensureCanManagePricing()) return
              if (!newHoliday.startDate || !newHoliday.endDate || !newHoliday.name.trim()) {
                toast.error('Cần nhập khoảng ngày và tên ngày lễ')
                return
              }
              if (newHoliday.endDate < newHoliday.startDate) {
                toast.error('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu')
                return
              }
              const holidayPayload = { ...newHoliday, name: newHoliday.name.trim() }
              if (editingHolidayId) {
                updateHolidayMutation.mutate({ id: editingHolidayId, data: holidayPayload })
                return
              }
              createHolidayMutation.mutate(holidayPayload)
            }}
            onCancelHolidayEdit={resetHolidayDraft}
            onEditHoliday={handleEditHoliday}
            onDeleteHoliday={(id) => {
              if (!ensureCanManagePricing()) return
              deleteHolidayMutation.mutate(id)
            }}
            isSavingHoliday={createHolidayMutation.isPending || updateHolidayMutation.isPending || deleteHolidayMutation.isPending}
            canManagePricing={canManagePricing}
            permissionHint={permissionError}
          />
        )}
      </section>
    </div>
  )
}
