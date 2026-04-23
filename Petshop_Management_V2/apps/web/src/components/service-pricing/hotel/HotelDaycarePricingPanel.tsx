'use client'

import { HOTEL_SPECIES_COLUMNS } from '../shared/pricing-constants'
import { PriceInput } from '../shared/PriceInput'
import type { BandDraft, HotelDaycareDraft } from '../shared/pricing-types'

export function HotelDaycarePricingPanel({
  bands,
  drafts,
  onDraftChange,
  canEditPricing,
}: {
  bands: BandDraft[]
  drafts: Record<string, HotelDaycareDraft>
  onDraftChange: (bandKey: string, species: string, patch: Partial<HotelDaycareDraft>) => void
  canEditPricing: boolean
}) {
  return (
    <section className="rounded-[28px] border border-border bg-background-secondary/70 p-4">
      <div className="mb-4">
        <h4 className="text-sm font-black uppercase tracking-[0.16em] text-foreground">Nha tre combo 10 ngay</h4>
        <p className="mt-1 text-xs text-foreground-muted">Gia co dinh theo hang can, tach rieng voi bang gia luu tru ngay thuong/le.</p>
      </div>

      <div className="custom-scrollbar overflow-auto rounded-2xl border border-border bg-background-base">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-10 bg-background-secondary">
            <tr>
              <th className="w-[220px] border-b border-r border-border px-4 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">
                Hang can
              </th>
              {HOTEL_SPECIES_COLUMNS.map((speciesOption) => (
                <th
                  key={`${speciesOption.value}:group`}
                  colSpan={2}
                  className="border-b border-border px-3 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-foreground-muted"
                >
                  {speciesOption.label}
                </th>
              ))}
            </tr>
            <tr>
              {HOTEL_SPECIES_COLUMNS.flatMap((speciesOption) => ([
                <th
                  key={`${speciesOption.value}:sku`}
                  className="border-b border-border px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.14em] text-foreground-muted"
                >
                  SKU
                </th>,
                <th
                  key={`${speciesOption.value}:price`}
                  className="border-b border-border px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.14em] text-foreground-muted"
                >
                  Combo 10 ngay
                </th>,
              ]))}
            </tr>
          </thead>
          <tbody>
            {bands.length === 0 ? (
              <tr>
                <td colSpan={1 + HOTEL_SPECIES_COLUMNS.length * 2} className="px-4 py-10 text-center text-sm text-foreground-muted">
                  Chua co hang can de cai dat bang gia nha tre.
                </td>
              </tr>
            ) : bands.map((band) => (
              <tr key={`${band.key}:daycare`}>
                <td className="border-b border-r border-border bg-background-secondary/60 px-4 py-3 font-bold text-foreground">
                  {band.label || 'Hang can moi'}
                </td>
                {HOTEL_SPECIES_COLUMNS.flatMap((speciesOption) => {
                  const draft = drafts[`${band.key}:DAYCARE:${speciesOption.value}`] ?? { sku: '', price: '' }
                  return [
                    <td key={`${band.key}:${speciesOption.value}:sku`} className="border-b border-border px-3 py-3">
                      <input
                        value={draft.sku}
                        onChange={(event) => onDraftChange(band.key, speciesOption.value, { sku: event.target.value })}
                        disabled={!canEditPricing}
                        className="w-full rounded border border-border bg-background-base py-1 text-center text-[11px] font-black uppercase tracking-[0.14em] text-primary-500 outline-none transition-colors focus:border-primary-500 disabled:opacity-60"
                      />
                    </td>,
                    <td key={`${band.key}:${speciesOption.value}:price`} className="border-b border-border px-3 py-3">
                      <PriceInput
                        value={draft.price}
                        onChange={(value) => onDraftChange(band.key, speciesOption.value, { price: value })}
                        disabled={!canEditPricing}
                      />
                    </td>,
                  ]
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
