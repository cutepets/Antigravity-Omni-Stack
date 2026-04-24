'use client'
/* eslint-disable react/no-unescaped-entities */

import { ArrowLeft, Camera, Copy, Download, Pencil, Plus, RefreshCw, Save, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { PriceInput } from '../shared/PriceInput'
import { SPECIES_OPTIONS } from '../shared/pricing-constants'
import { createDraftKey, getSpaRuleKey } from '../shared/pricing-helpers'
import type { BandDraft, FlatRateDraft, SpaDraft, SpaServiceColumn } from '../shared/pricing-types'

const OTHER_SERVICES_TAB = '__OTHER_SERVICES__'

// Map packageCode → icon (emoji) for service column headers
const SERVICE_ICON_MAP: Record<string, string> = {
  BATH: '🛁',
  BATH_CLEAN: '🧼',
  SHAVE: '✂️',
  BATH_SHAVE_CLEAN: '🪄',
  SPA: '💆',
}

function getServiceIcon(packageCode: string): string {
  const raw = packageCode?.trim() ?? ''
  const upper = raw.toUpperCase()
  // Direct code match first
  if (SERVICE_ICON_MAP[upper]) return SERVICE_ICON_MAP[upper]
  // Keyword match for Vietnamese display names
  if (/spa/i.test(raw)) return '💆'
  if (/cạo|shave/i.test(raw) && /tắm|bath/i.test(raw) && /vệ|clean/i.test(raw)) return '🪄' // Tắm+Cạo+VS
  if (/cạo|shave/i.test(raw)) return '✂️'
  if (/vệ|clean/i.test(raw)) return '🧼'
  if (/tắm|bath/i.test(raw)) return '🛁'
  return '🐾'
}

function createEmptyFlatRateDraft(): FlatRateDraft {
  return {
    key: createDraftKey('flat'),
    sku: '',
    name: '',
    minWeight: '',
    maxWeight: '',
    price: '',
    durationMinutes: '',
  }
}

export function GroomingPricingMatrix({
  bands,
  serviceColumns,
  drafts,
  onBandChange,
  onBandRemove,
  onAddBand,
  onServiceChange,
  onServiceRemove,
  onAddService,
  onDraftChange,
  onSave,
  onFillEmptySkus,
  onExportExcel,
  onImportExcel,
  onServiceImageUpload,
  isSaving,
  canManagePricing,
  species,
  setSpecies,
  flatRateDrafts,
  onFlatRateChange,
}: {
  bands: BandDraft[]
  serviceColumns: SpaServiceColumn[]
  drafts: Record<string, SpaDraft>
  onBandChange: (index: number, patch: Partial<BandDraft>) => void
  onBandRemove: (index: number) => void
  onAddBand: () => void
  onServiceChange: (serviceKey: string, packageCode: string) => void
  onServiceRemove: (serviceKey: string) => void
  onAddService: () => void
  onDraftChange: (bandKey: string, serviceKey: string, patch: Partial<SpaDraft>) => void
  onSave: () => Promise<boolean | undefined> | boolean | undefined
  onFillEmptySkus: () => void
  onExportExcel: () => void
  onImportExcel: (file: File) => void
  onServiceImageUpload?: (column: SpaServiceColumn, file: File) => void
  isSaving: boolean
  canManagePricing: boolean
  species: string
  setSpecies: (value: string) => void
  flatRateDrafts: FlatRateDraft[]
  onFlatRateChange: (drafts: FlatRateDraft[]) => void
}) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(species)
  const [columnAvatars, setColumnAvatars] = useState<Record<string, string>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const totalColumns = Math.max(1, serviceColumns.length * 2 + 1)
  const canEditPricing = canManagePricing && isEditMode
  const isOtherServicesTab = activeTab === OTHER_SERVICES_TAB

  const handleAvatarChange = (column: SpaServiceColumn, file: File) => {
    // Immediate local preview (dataURL)
    const reader = new FileReader()
    reader.onload = (e) => {
      setColumnAvatars((prev) => ({ ...prev, [column.key]: e.target?.result as string }))
    }
    reader.readAsDataURL(file)
    // Delegate upload + persist to parent (workspace has queryClient)
    onServiceImageUpload?.(column, file)
  }

  useEffect(() => {
    if (activeTab === OTHER_SERVICES_TAB) return
    setActiveTab(species)
  }, [activeTab, species])

  const handleExitEditMode = () => {
    setIsEditMode(false)
  }

  const addFlatRateRow = () => {
    onFlatRateChange([...flatRateDrafts, createEmptyFlatRateDraft()])
  }

  return (
    <div className="flex flex-col rounded-[28px] border border-border bg-background-secondary/70 p-4">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('openGroomingSettings'))}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-background-base text-foreground-muted transition-colors hover:bg-background-tertiary hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="inline-flex rounded-2xl border border-border bg-background-base p-1">
            {SPECIES_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setActiveTab(option.value)
                  setSpecies(option.value)
                }}
                className={cn(
                  'h-10 rounded-xl px-6 text-sm font-semibold transition-colors',
                  activeTab === option.value ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActiveTab(OTHER_SERVICES_TAB)}
              className={cn(
                'h-10 rounded-xl px-6 text-sm font-semibold transition-colors',
                isOtherServicesTab ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground',
              )}
            >
              Khác
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEditPricing && !isOtherServicesTab ? (
            <>
              <button
                type="button"
                onClick={onAddBand}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-primary-500/35 bg-primary-500/5 px-4 text-sm font-bold text-primary-500 transition-colors hover:bg-primary-500/10"
              >
                <Plus size={15} />
                Hạng cân
              </button>
              <button
                type="button"
                onClick={onAddService}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-primary-500/35 bg-primary-500/5 px-4 text-sm font-bold text-primary-500 transition-colors hover:bg-primary-500/10"
              >
                <Plus size={15} />
                Dịch vụ
              </button>
            </>
          ) : null}

          {canEditPricing && isOtherServicesTab ? (
            <button
              type="button"
              onClick={addFlatRateRow}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-primary-500/35 bg-primary-500/5 px-4 text-sm font-bold text-primary-500 transition-colors hover:bg-primary-500/10"
            >
              <Plus size={15} />
              Dịch vụ khác
            </button>
          ) : null}

          {canEditPricing ? (
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
            <>
              <button
                type="button"
                onClick={onExportExcel}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-background-base px-3 text-xs font-semibold text-foreground-muted transition-colors hover:bg-background-tertiary hover:text-foreground"
              >
                <Download size={14} />
                Xuất Excel
              </button>
              <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10">
                <Upload size={14} />
                Nhập Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    e.target.value = ''
                    onImportExcel(file)
                  }}
                />
              </label>
              {isEditMode ? (
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
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {!isOtherServicesTab ? (
          <div className="min-w-0 shrink-0 overflow-x-auto overflow-y-hidden rounded-2xl border border-border bg-background-base">
            <table className="w-full min-w-[1200px] border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-background-secondary">
                <tr>
                  <th className="w-auto min-w-[280px] border-b border-r border-border bg-background-secondary px-4 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">
                    Hạng cân
                  </th>
                  {serviceColumns.length === 0 ? (
                    <th className="border-b border-border px-4 py-3 text-left text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">
                      Dịch vụ
                    </th>
                  ) : serviceColumns.map((column) => (
                    <th key={column.key} className="min-w-[240px] border-b border-r border-border px-3 py-2.5">
                      {/* 2-column header: avatar left | name + subtitle right */}
                      <div className="flex items-center gap-2.5">

                        {/* Avatar square */}
                        <div className="relative shrink-0">
                          {/* Hidden file input */}
                          <input
                            ref={(el) => { fileInputRefs.current[column.key] = el }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleAvatarChange(column, file)
                            }}
                          />
                          <button
                            type="button"
                            disabled={!canEditPricing}
                            onClick={() => canEditPricing && fileInputRefs.current[column.key]?.click()}
                            title={canEditPricing ? 'Đổi ảnh dịch vụ' : undefined}
                            className={cn(
                              'group relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border transition-colors',
                              (columnAvatars[column.key] ?? column.imageUrl)
                                ? 'border-border/60 bg-transparent'
                                : 'border-dashed border-border bg-background-secondary',
                              canEditPricing && 'cursor-pointer hover:border-primary-500/70 hover:bg-primary-500/10 active:scale-[0.97]',
                            )}
                          >
                            {/* Avatar display: local preview > DB imageUrl > no-image hint > emoji */}
                            {(columnAvatars[column.key] ?? column.imageUrl) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={columnAvatars[column.key] ?? column.imageUrl!}
                                alt={column.packageCode}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-0.5 text-foreground-muted/50">
                                <Camera size={13} />
                                <span className="text-[9px] font-medium leading-none">Ảnh</span>
                              </div>
                            )}
                            {/* Camera overlay on hover in edit mode */}
                            {canEditPricing && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background-base/70 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                <Camera size={14} className="text-primary-500" />
                              </div>
                            )}
                          </button>
                        </div>

                        {/* Right: name row + subtitle row */}
                        <div className="min-w-0 flex-1">
                          {/* Row 1: service name + delete */}
                          <div className="flex items-center gap-1.5">
                            {canEditPricing ? (
                              <input
                                value={column.packageCode}
                                onChange={(event) => onServiceChange(column.key, event.target.value)}
                                placeholder="Tên dịch vụ"
                                className="h-7 w-full min-w-[80px] rounded-lg border border-border bg-background-base px-2 text-xs font-bold text-foreground outline-none focus:border-primary-500"
                              />
                            ) : (
                              <span className="truncate text-xs font-black text-foreground leading-snug">
                                {column.packageCode || 'Dịch vụ mới'}
                              </span>
                            )}
                            {canEditPricing && (
                              <button
                                type="button"
                                onClick={() => onServiceRemove(column.key)}
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-rose-400 transition-colors hover:bg-rose-500/10"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>
                          {/* Row 2: subtitle */}
                          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-foreground-muted/60 leading-none">
                            SKU · Giá · Thời gian
                          </p>
                        </div>

                      </div>
                    </th>
                  ))}
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
                      <div className="flex items-center gap-2">
                        {canEditPricing ? (
                          <input
                            value={band.label}
                            onChange={(event) => onBandChange(index, { label: event.target.value })}
                            placeholder="Tên hạng cân"
                            className="h-10 w-[140px] rounded-xl border border-border bg-background-base px-3 text-sm font-bold text-foreground outline-none focus:border-primary-500"
                          />
                        ) : (
                          <p className="min-w-[140px] truncate text-sm font-black text-foreground" title={band.label || 'Hạng cân mới'}>
                            {band.label || 'Hạng cân mới'}
                          </p>
                        )}

                        <div className="ml-2 flex shrink-0 items-center gap-1.5">
                          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">từ</span>
                          <input
                            value={band.minWeight}
                            onChange={(event) => onBandChange(index, { minWeight: event.target.value })}
                            disabled={!canEditPricing}
                            inputMode="decimal"
                            className="h-9 w-12 rounded-xl border border-border bg-background-base px-1 text-center text-sm font-semibold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                          />
                          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">đến</span>
                          <input
                            value={band.maxWeight}
                            onChange={(event) => onBandChange(index, { maxWeight: event.target.value })}
                            disabled={!canEditPricing}
                            inputMode="decimal"
                            placeholder="∞"
                            className="h-9 w-12 rounded-xl border border-border bg-background-base px-1 text-center text-sm font-semibold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                          />
                          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">kg</span>
                        </div>

                        {canEditPricing ? (
                          <div className="ml-1 flex shrink-0 items-center justify-center">
                            <button
                              type="button"
                              onClick={() => onBandRemove(index)}
                              title="Xóa hạng cân"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {serviceColumns.length === 0 ? (
                      <td className="border-b border-border px-4 py-3 text-sm text-foreground-muted">Chưa có dịch vụ nào cho ma trận này.</td>
                    ) : serviceColumns.flatMap((column) => {
                      const draft = drafts[getSpaRuleKey(band.key, column.key)] ?? { sku: '', price: '', durationMinutes: '' }
                      return (
                        <td key={`${band.key}:${column.key}`} className="border-b border-r border-border px-2 py-2 align-middle">
                          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                            {canEditPricing ? (
                              <input
                                value={draft.sku}
                                onChange={(event) => onDraftChange(band.key, column.key, { sku: event.target.value })}
                                placeholder=""
                                className="w-[70px] shrink-0 rounded border border-border bg-background-base py-1 text-center text-[10px] font-black uppercase tracking-[0.12em] text-primary-500 placeholder:text-foreground-muted/30 outline-none hover:border-primary-500 focus:border-primary-500"
                              />
                            ) : (
                              <span className="w-[70px] shrink-0 text-center text-[10px] font-black uppercase tracking-[0.12em] text-primary-500">
                                {draft.sku || '-'}
                              </span>
                            )}

                            <div className="w-[90px] shrink-0">
                              <PriceInput
                                value={draft.price}
                                onChange={(value) => onDraftChange(band.key, column.key, { price: value })}
                                placeholder=""
                                disabled={!canEditPricing}
                              />
                            </div>

                            <div className="relative w-[56px] shrink-0">
                              <input
                                value={draft.durationMinutes}
                                onChange={(event) => onDraftChange(band.key, column.key, { durationMinutes: event.target.value })}
                                placeholder=""
                                inputMode="numeric"
                                disabled={!canEditPricing}
                                className="block h-9 w-full rounded-lg border border-border bg-background-secondary pl-1 pr-6 text-center text-xs font-semibold text-foreground outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                              />
                              <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-foreground-muted">ph</span>
                            </div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="hidden">
            <div className="rounded-2xl border border-border bg-background-secondary/60 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Dịch vụ khác dùng chung cho Chó và Mèo</p>
              <p className="mt-1 text-xs text-foreground-muted">
                Nhóm này dành cho các dịch vụ SPA / Grooming không nằm trong ma trận hạng cân.
              </p>
            </div>
          </div>
        )}

        {isOtherServicesTab ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-background-base">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">Dịch vụ khác</p>
              </div>
            </div>

            <div
              className="grid border-b border-border bg-background-secondary"
              style={{ gridTemplateColumns: 'minmax(70px, 120px) minmax(120px, 1fr) minmax(50px, 100px) minmax(50px, 100px) minmax(50px, 150px) minmax(50px, 100px) 72px' }}
            >
              {['SKU', 'Tên dịch vụ', 'Từ kg', 'Đến kg', 'Giá', 'Phút', ''].map((label) => (
                <div key={label} className="px-1.5 py-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-foreground-muted">{label}</div>
              ))}
            </div>

            {flatRateDrafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-foreground-muted">
                <span>Chưa có dịch vụ nào</span>
                {canEditPricing ? <span className="text-xs opacity-60">Bấm "Thêm" để tạo dịch vụ đầu tiên</span> : null}
              </div>
            ) : (
              flatRateDrafts.map((flatRate, index) => (
                <div
                  key={flatRate.key}
                  className="grid items-center border-b border-border/60 last:border-b-0"
                  style={{ gridTemplateColumns: 'minmax(70px, 120px) minmax(120px, 1fr) minmax(50px, 100px) minmax(50px, 100px) minmax(50px, 150px) minmax(50px, 100px) 72px' }}
                >
                  <div className="px-1 py-1.5">
                    <input
                      value={flatRate.sku}
                      onChange={(event) => onFlatRateChange(flatRateDrafts.map((item, itemIndex) => itemIndex === index ? { ...item, sku: event.target.value } : item))}
                      placeholder="SKU"
                      disabled={!canEditPricing}
                      className="h-8 w-full rounded border border-border bg-background-secondary px-1 text-center text-[10px] font-black uppercase tracking-widest text-primary-500 placeholder:text-foreground-muted/30 outline-none focus:border-primary-500 disabled:opacity-60"
                    />
                  </div>

                  <div className="px-1 py-1.5">
                    <input
                      value={flatRate.name}
                      onChange={(event) => onFlatRateChange(flatRateDrafts.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
                      placeholder="Tên dịch vụ"
                      disabled={!canEditPricing}
                      className="h-8 w-full rounded-lg border border-border bg-background-secondary px-2 text-xs font-semibold text-foreground placeholder:text-foreground-muted/40 outline-none focus:border-primary-500 disabled:opacity-60"
                    />
                  </div>

                  <div className="px-1 py-1.5">
                    <input
                      value={flatRate.minWeight}
                      onChange={(event) => onFlatRateChange(flatRateDrafts.map((item, itemIndex) => itemIndex === index ? { ...item, minWeight: event.target.value } : item))}
                      placeholder="0"
                      inputMode="decimal"
                      disabled={!canEditPricing}
                      className="h-8 w-full rounded border border-border bg-background-secondary px-1 text-center text-xs font-semibold text-foreground placeholder:text-foreground-muted/30 outline-none focus:border-primary-500 disabled:opacity-60"
                    />
                  </div>

                  <div className="px-1 py-1.5">
                    <input
                      value={flatRate.maxWeight}
                      onChange={(event) => onFlatRateChange(flatRateDrafts.map((item, itemIndex) => itemIndex === index ? { ...item, maxWeight: event.target.value } : item))}
                      placeholder="∞"
                      inputMode="decimal"
                      disabled={!canEditPricing}
                      className="h-8 w-full rounded border border-border bg-background-secondary px-1 text-center text-xs font-semibold text-foreground placeholder:text-foreground-muted/30 outline-none focus:border-primary-500 disabled:opacity-60"
                    />
                  </div>

                  <div className="px-1 py-1.5">
                    <PriceInput
                      value={flatRate.price}
                      onChange={(value) => onFlatRateChange(flatRateDrafts.map((item, itemIndex) => itemIndex === index ? { ...item, price: value } : item))}
                      placeholder=""
                      disabled={!canEditPricing}
                    />
                  </div>

                  <div className="relative px-1 py-1.5">
                    <input
                      value={flatRate.durationMinutes}
                      onChange={(event) => onFlatRateChange(flatRateDrafts.map((item, itemIndex) => itemIndex === index ? { ...item, durationMinutes: event.target.value } : item))}
                      placeholder=""
                      inputMode="numeric"
                      disabled={!canEditPricing}
                      className="h-8 w-full rounded border border-border bg-background-secondary pl-1 pr-4 text-center text-xs font-semibold text-foreground placeholder:text-foreground-muted/30 outline-none focus:border-primary-500 disabled:opacity-60"
                    />
                    <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-foreground-muted">ph</span>
                  </div>

                  <div className="flex items-center justify-center gap-1 px-1 py-1.5">
                    {canEditPricing ? (
                      <button
                        type="button"
                        onClick={() => onFlatRateChange(flatRateDrafts.filter((_, itemIndex) => itemIndex !== index))}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-500/10"
                      >
                        <X size={13} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
