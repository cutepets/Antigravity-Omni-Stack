'use client'
/* eslint-disable react/no-unescaped-entities */

import { ArrowLeft, Copy, Pencil, Plus, RefreshCw, Save, X } from 'lucide-react'
import { useState } from 'react'
import type { HolidayCalendarDate, PricingDayType } from '@/lib/api/pricing.api'
import { cn } from '@/lib/utils'
import { PriceInput } from '../shared/PriceInput'
import { DAY_TYPE_OPTIONS, HOTEL_SPECIES_COLUMNS } from '../shared/pricing-constants'
import { buildServicePricingSku, getHotelRuleKey, parseWeightInput } from '../shared/pricing-helpers'
import type { BandDraft, HolidayDraft, HotelDraft, HotelExtraServiceDraft } from '../shared/pricing-types'
import { HolidayCalendarPanel } from './HolidayCalendarPanel'
import { HotelExtraServicesPanel } from './HotelExtraServicesPanel'

export function UnifiedHotelPricingPanel({
  bands,
  drafts,
  onBandChange,
  onBandRemove,
  onAddBand,
  onDraftChange,
  onSave,
  onFillEmptySkus,
  isSaving,
  holidays,
  hotelExtraServiceDrafts,
  onHotelExtraServiceDraftsChange,
  newHoliday,
  editingHolidayId,
  onHolidayDraftChange,
  onSubmitHoliday,
  onCancelHolidayEdit,
  onEditHoliday,
  onDeleteHoliday,
  isSavingHoliday,
  canManagePricing,
  permissionHint,
}: {
  bands: BandDraft[]
  drafts: Record<string, HotelDraft>
  onBandChange: (index: number, patch: Partial<BandDraft>) => void
  onBandRemove: (index: number) => void
  onAddBand: () => void
  onDraftChange: (bandId: string, dayType: PricingDayType, species: string, patch: Partial<HotelDraft>) => void
  onSave: () => Promise<boolean | undefined> | boolean | undefined
  onFillEmptySkus: () => void
  isSaving: boolean
  holidays: HolidayCalendarDate[]
  hotelExtraServiceDrafts: HotelExtraServiceDraft[]
  onHotelExtraServiceDraftsChange: (drafts: HotelExtraServiceDraft[]) => void
  newHoliday: HolidayDraft
  editingHolidayId: string | null
  onHolidayDraftChange: (patch: Partial<HolidayDraft>) => void
  onSubmitHoliday: () => void
  onCancelHolidayEdit: () => void
  onEditHoliday: (holiday: HolidayCalendarDate) => void
  onDeleteHoliday: (id: string) => void
  isSavingHoliday: boolean
  canManagePricing: boolean
  permissionHint: string
}) {
  const [isEditMode, setIsEditMode] = useState(false)
  const totalColumns = 1 + HOTEL_SPECIES_COLUMNS.length * (DAY_TYPE_OPTIONS.length + 1)
  const canEditHotelPricing = canManagePricing && isEditMode

  const handleExitEditMode = () => {
    onCancelHolidayEdit()
    setIsEditMode(false)
  }

  return (
    <div className="grid min-h-0 gap-4 2xl:grid-cols-[65fr_35fr]">
      <div className="min-h-0 rounded-[28px] border border-border bg-background-secondary/70 p-4">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('closeHotelSettings'))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background-base text-foreground transition-colors hover:bg-background-secondary"
            >
              <ArrowLeft size={16} />
            </button>
            <h3 className="text-lg font-black text-foreground">Bảng giá Hotel</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditHotelPricing ? (
              <button
                type="button"
                onClick={onAddBand}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-primary-500/35 bg-primary-500/5 px-4 text-sm font-bold text-primary-500 transition-colors hover:bg-primary-500/10"
              >
                <Plus size={15} />
                + Hạng cân
              </button>
            ) : null}

            {canEditHotelPricing ? (
              <button
                type="button"
                onClick={onFillEmptySkus}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-sky-500/35 bg-sky-500/5 px-4 text-sm font-bold text-sky-400 transition-colors hover:bg-sky-500/10"
              >
                <Copy size={15} />
                Set SKU auto
              </button>
            ) : null}

            {canManagePricing ? (
              isEditMode ? (
                <button
                  type="button"
                  onClick={async () => {
                    const success = await onSave()
                    if (success) handleExitEditMode()
                  }}
                  disabled={isSaving}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  Lưu bảng giá
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-bold text-white"
                >
                  <Pencil size={16} />
                  Sửa bảng giá
                </button>
              )
            ) : null}
          </div>
        </div>

        {!canManagePricing ? (
          <p className="mb-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
            {permissionHint}
          </p>
        ) : null}

        <div className="custom-scrollbar overflow-auto rounded-2xl border border-border bg-background-base">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-background-secondary">
              <tr>
                <th rowSpan={2} className="w-[300px] border-b border-r border-border bg-background-secondary px-4 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">
                  Hạng cân
                </th>
                {HOTEL_SPECIES_COLUMNS.map((speciesOption, idx) => (
                  <th key={speciesOption.value} colSpan={DAY_TYPE_OPTIONS.length + 1} className={cn('border-b border-border px-3 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-foreground-muted', idx > 0 ? 'border-l' : '')}>
                    {speciesOption.label}
                  </th>
                ))}
              </tr>
              <tr>
                {HOTEL_SPECIES_COLUMNS.flatMap((speciesOption, speciesIdx) => [
                  <th key={`${speciesOption.value}:sku`} className={cn('w-[70px] border-b border-border px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.14em] text-foreground-muted', speciesIdx > 0 ? 'border-l' : '')}>
                    SKU
                  </th>,
                  ...DAY_TYPE_OPTIONS.map((option) => (
                    <th key={`${speciesOption.value}:${option.value}`} className="w-[110px] border-b border-border px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.14em] text-foreground-muted">
                      {option.label}
                    </th>
                  )),
                ])}
              </tr>
            </thead>
            <tbody>
              {bands.length === 0 ? (
                <tr>
                  <td colSpan={totalColumns} className="px-4 py-12 text-center text-sm text-foreground-muted">
                    Chưa có hạng cân. Bấm "+ Hạng cân" để bắt đầu.
                  </td>
                </tr>
              ) : bands.map((band, index) => (
                <tr key={band.key} className="border-b border-border/50 last:border-b-0">
                  <td className="border-b border-r border-border bg-background-secondary/60 px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        {canEditHotelPricing ? (
                          <input
                            value={band.label}
                            onChange={(event) => onBandChange(index, { label: event.target.value })}
                            placeholder="Tên hạng cân"
                            className="h-10 w-full rounded-xl border border-border bg-background-base px-3 text-sm font-bold text-foreground outline-none focus:border-primary-500"
                          />
                        ) : (
                          <p className="truncate text-sm font-black text-foreground">{band.label || 'Hạng cân mới'}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Từ</span>
                          <input
                            value={band.minWeight}
                            onChange={(event) => onBandChange(index, { minWeight: event.target.value })}
                            disabled={!canEditHotelPricing}
                            inputMode="decimal"
                            className="h-9 w-14 rounded-xl border border-border bg-background-base px-2 text-center text-sm font-semibold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Đến</span>
                          <input
                            value={band.maxWeight}
                            onChange={(event) => onBandChange(index, { maxWeight: event.target.value })}
                            disabled={!canEditHotelPricing}
                            inputMode="decimal"
                            placeholder="∞"
                            className="h-9 w-14 rounded-xl border border-border bg-background-base px-2 text-center text-sm font-semibold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                          />
                        </div>
                      </div>

                      {canEditHotelPricing ? (
                        <div className="ml-2 flex flex-col items-center justify-center">
                          <button
                            type="button"
                            onClick={() => onBandRemove(index)}
                            title="Xóa hạng cân"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-500/10"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>

                  {HOTEL_SPECIES_COLUMNS.flatMap((speciesOption, speciesIdx) => {
                    const regularKey = getHotelRuleKey(band.key, 'REGULAR', speciesOption.value)
                    const holidayKey = getHotelRuleKey(band.key, 'HOLIDAY', speciesOption.value)
                    const skuDraft = drafts[regularKey] ?? drafts[holidayKey]
                    const skuValue = skuDraft?.sku ?? ''
                    return [
                      <td key={`${band.key}:${speciesOption.value}:sku`} className={cn('border-b border-border px-3 py-3 align-middle text-center', speciesIdx > 0 ? 'border-l' : '')}>
                        {canEditHotelPricing ? (
                          <input
                            value={skuValue}
                            onChange={(event) => onDraftChange(band.key, 'REGULAR', speciesOption.value, { sku: event.target.value })}
                            placeholder=""
                            className="w-full max-w-[80px] rounded border border-border bg-background-base py-1 text-center text-[11px] font-black uppercase tracking-[0.14em] text-primary-500 placeholder:text-foreground-muted/30 outline-none transition-colors hover:border-primary-500 focus:border-primary-500"
                          />
                        ) : (
                          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-primary-500 whitespace-nowrap">
                            {skuValue || '-'}
                          </span>
                        )}
                      </td>,
                      ...DAY_TYPE_OPTIONS.map((option) => {
                        const draft = drafts[getHotelRuleKey(band.key, option.value, speciesOption.value)] ?? { sku: '', fullDayPrice: '' }
                        return (
                          <td key={`${band.key}:${speciesOption.value}:${option.value}`} className="border-b border-border px-3 py-3 align-top">
                            <PriceInput
                              value={draft.fullDayPrice}
                              onChange={(value) => onDraftChange(band.key, option.value, speciesOption.value, { fullDayPrice: value })}
                              placeholder=""
                              disabled={!canEditHotelPricing}
                            />
                          </td>
                        )
                      }),
                    ]
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-4">
        <HolidayCalendarPanel
          holidays={holidays}
          newHoliday={newHoliday}
          editingHolidayId={editingHolidayId}
          onHolidayDraftChange={onHolidayDraftChange}
          onSubmitHoliday={onSubmitHoliday}
          onCancelEdit={onCancelHolidayEdit}
          onEditHoliday={onEditHoliday}
          onDeleteHoliday={onDeleteHoliday}
          isSavingHoliday={isSavingHoliday}
          canManagePricing={canManagePricing}
          canEditPricing={canEditHotelPricing}
        />

        <HotelExtraServicesPanel
          drafts={hotelExtraServiceDrafts}
          onChange={onHotelExtraServiceDraftsChange}
          canEditPricing={canEditHotelPricing}
        />
      </div>
    </div>
  )
}
