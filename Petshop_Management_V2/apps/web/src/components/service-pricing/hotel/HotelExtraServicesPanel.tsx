'use client'

import { Camera, Plus, X } from 'lucide-react'
import { useRef } from 'react'
import { PriceInput } from '../shared/PriceInput'
import { createHotelExtraServiceDraft } from '../shared/pricing-helpers'
import type { HotelExtraServiceDraft } from '../shared/pricing-types'

export function HotelExtraServicesPanel({
  drafts,
  onChange,
  onImageUpload,
  canEditPricing,
}: {
  drafts: HotelExtraServiceDraft[]
  onChange: (drafts: HotelExtraServiceDraft[]) => void
  onImageUpload?: (index: number, file: File) => void
  canEditPricing: boolean
}) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  return (
    <div className="rounded-[28px] border border-border bg-background-secondary/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-foreground">Dịch vụ khác</h3>
        </div>

        {canEditPricing ? (
          <button
            type="button"
            onClick={() => onChange([...drafts, createHotelExtraServiceDraft()])}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-primary-500/35 bg-primary-500/5 px-4 text-sm font-bold text-primary-500 transition-colors hover:bg-primary-500/10"
          >
            <Plus size={14} />
            Thêm
          </button>
        ) : null}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-background-base">
        <div className="custom-scrollbar overflow-x-auto">
          <div className="grid min-w-[780px] grid-cols-[100px_48px_minmax(0,1fr)_64px_64px_120px_40px] gap-2 border-b border-border bg-background-secondary/60 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-foreground-muted">
            <span>SKU</span>
            <span className="text-center">Ảnh</span>
            <span>Tên dịch vụ</span>
            <span className="text-center">Từ KG</span>
            <span className="text-center">Đến KG</span>
            <span className="text-right">Giá</span>
            <span />
          </div>

          {drafts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-foreground-muted">Chưa có dịch vụ khác cho Hotel.</p>
          ) : (
            drafts.map((draft, index) => (
              <div key={draft.key} className="grid min-w-[780px] grid-cols-[100px_48px_minmax(0,1fr)_64px_64px_120px_40px] items-center gap-2 border-b border-border/70 px-3 py-2.5 last:border-b-0">
                <input
                  value={draft.sku}
                  onChange={(event) => onChange(drafts.map((item, itemIndex) => itemIndex === index ? { ...item, sku: event.target.value } : item))}
                  disabled={!canEditPricing}
                  placeholder="-"
                  className="h-10 rounded-xl border border-border bg-background-secondary/70 px-3 text-[11px] font-black uppercase tracking-[0.14em] text-primary-500 outline-none focus:border-primary-500 disabled:opacity-60"
                />
                <div className="flex justify-center">
                  <input
                    ref={(el) => { fileInputRefs.current[draft.key] = el }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      event.target.value = ''
                      onImageUpload?.(index, file)
                    }}
                  />
                  <button
                    type="button"
                    disabled={!canEditPricing}
                    onClick={() => canEditPricing && fileInputRefs.current[draft.key]?.click()}
                    className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-border bg-background-secondary/70 text-foreground-muted disabled:opacity-60"
                  >
                    {draft.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.imageUrl} alt={draft.name || draft.sku || 'Dịch vụ'} className="h-full w-full object-cover" />
                    ) : (
                      <Camera size={14} />
                    )}
                  </button>
                </div>
                <input
                  value={draft.name}
                  onChange={(event) => onChange(drafts.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
                  disabled={!canEditPricing}
                  placeholder="Tên dịch vụ"
                  className="h-10 rounded-xl border border-border bg-background-secondary/70 px-3 text-sm font-semibold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                />
                <input
                  value={draft.minWeight}
                  onChange={(event) => onChange(drafts.map((item, itemIndex) => itemIndex === index ? { ...item, minWeight: event.target.value } : item))}
                  disabled={!canEditPricing}
                  inputMode="decimal"
                  placeholder="0"
                  className="h-10 min-w-[50px] rounded-xl border border-border bg-background-secondary/70 px-2 text-center text-sm font-semibold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                />
                <input
                  value={draft.maxWeight}
                  onChange={(event) => onChange(drafts.map((item, itemIndex) => itemIndex === index ? { ...item, maxWeight: event.target.value } : item))}
                  disabled={!canEditPricing}
                  inputMode="decimal"
                  placeholder="∞"
                  className="h-10 min-w-[50px] rounded-xl border border-border bg-background-secondary/70 px-2 text-center text-sm font-semibold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                />
                <PriceInput
                  value={draft.price}
                  onChange={(value) => onChange(drafts.map((item, itemIndex) => itemIndex === index ? { ...item, price: value } : item))}
                  disabled={!canEditPricing}
                />
                <div className="flex items-center justify-center">
                  {canEditPricing ? (
                    <button
                      type="button"
                      onClick={() => onChange(drafts.filter((_, itemIndex) => itemIndex !== index))}
                      title="Xóa dịch vụ"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-500/10"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
