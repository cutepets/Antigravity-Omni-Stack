import Image from 'next/image';
import { ImagePlus } from 'lucide-react'
import { PriceInput } from './product-form-modal'
import type React from 'react'
import type { ChangeEvent } from 'react'

export interface VariantTableProps {
  generatedVariants: any[]
  priceBooks: any[]
  formData: { unit: string }
  productImage: string | null | undefined
  handleImageChange: (e: ChangeEvent<HTMLInputElement>, cb: (image: string) => void) => void
  setVariantImages: React.Dispatch<React.SetStateAction<Record<string, string | null>>>
  clearVariantImage: (imageKey: string) => void
  handleVariantSkuChange: (key: string, value: string) => void
  handleVariantBarcodeChange: (key: string, value: string) => void
  handleVariantCostPriceChange: (key: string, value: number) => void
  handleVariantPriceBookChange: (key: string, pbId: string, value: number) => void
}

export function VariantTable({
  generatedVariants,
  priceBooks,
  formData,
  productImage,
  handleImageChange,
  setVariantImages,
  clearVariantImage,
  handleVariantSkuChange,
  handleVariantBarcodeChange,
  handleVariantCostPriceChange,
  handleVariantPriceBookChange,
}: VariantTableProps) {
  return (
    <div className="border border-border bg-background rounded-2xl overflow-x-auto overflow-y-hidden shadow-sm pt-4">
      <div className="px-5 mb-3 flex items-center gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">Bang phien ban</span>
        <span className="badge badge-primary px-2">{generatedVariants.length} phien ban</span>
      </div>

      <table className="min-w-[1440px] w-full text-left border-collapse">
        <thead className="bg-background-tertiary/50">
          <tr>
            <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider w-14 text-center">Anh</th>
            <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider min-w-[180px]">Phien ban</th>
            <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider min-w-[140px] border-l border-border/50">Don vi</th>
            <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider w-40 border-l border-border/50">SKU</th>
            <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider w-44 border-l border-border/50">Ma vach</th>
            <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider w-32 border-l border-border/50">Gia nhap</th>
            {priceBooks.map((pb: any) => (
              <th key={pb.id} className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider w-40 border-l border-border/50">
                {pb.name}
              </th>
            ))}
            <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider w-28 text-right border-l border-border/50">Luong (g)</th>
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-border/50">
          {generatedVariants.map((variant) => (
            <tr key={variant.key} className={`group hover:bg-background-secondary/30 ${variant.isConversion ? 'bg-background-tertiary/20' : ''}`}>
              <td className="py-3 px-4 text-center relative">
                {variant.isConversion ? <div className="absolute top-0 bottom-1/2 left-4 w-px border-l-2 border-border/50" /> : null}
                {variant.isConversion ? <div className="absolute top-1/2 left-4 w-2 h-px border-t-2 border-border/50" /> : null}
                <div className="relative z-10 mx-auto w-8">
                  <label className={`flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed border-border transition-colors ${
                    variant.image || productImage
                      ? 'bg-background'
                      : variant.isConversion
                        ? 'bg-background-tertiary hover:border-primary-500'
                        : 'bg-background hover:border-primary-500'
                  }`}>
                    {variant.image || productImage ? (
                      <Image
                        src={variant.image || productImage || ''}
                        alt={variant.displayName || variant.name}
                        className="h-full w-full object-cover"
                        width={400}
                        height={400}
                        unoptimized
                      />
                    ) : (
                      <ImagePlus size={14} className="text-foreground-muted" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) =>
                        handleImageChange(event, (image) =>
                          setVariantImages((current) => ({ ...current, [variant.imageKey]: image })),
                        )
                      }
                    />
                  </label>
                  {variant.image ? (
                    <button
                      type="button"
                      onClick={() => clearVariantImage(variant.imageKey)}
                      className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-background-base text-[10px] text-white shadow"
                    >
                      x
                    </button>
                  ) : null}
                </div>
              </td>

              <td className="py-3 px-4">
                <div className="font-semibold text-foreground bg-background-tertiary/50 px-3 py-1.5 rounded-lg border border-border inline-flex w-full">
                  {variant.variantLabel || '—'}
                </div>
              </td>

              <td className="py-3 px-4 border-l border-border/50">
                <div className="font-semibold text-foreground bg-background-tertiary/50 px-3 py-1.5 rounded-lg border border-border inline-flex w-full">
                  {variant.unitLabel || '—'}
                </div>
                {variant.isConversion ? (
                  <div className="text-[10px] text-foreground-muted mt-1.5 ml-1">
                    {variant.conversionRate} {formData.unit} = 1 {variant.unitLabel || variant.unit}
                  </div>
                ) : null}
              </td>

              <td className="py-3 px-4 border-l border-border/50">
                <input
                  value={variant.sku}
                  onChange={(event) => handleVariantSkuChange(variant.key, event.target.value)}
                  className="form-input w-full text-xs font-mono uppercase"
                  placeholder="SKU phien ban"
                />
              </td>

              <td className="py-3 px-4 border-l border-border/50">
                <input
                  value={variant.barcode}
                  onChange={(event) => handleVariantBarcodeChange(variant.key, event.target.value)}
                  className="form-input w-full text-xs"
                  placeholder="Ma vach phien ban"
                />
              </td>

              <td className="py-3 px-4 border-l border-border/50">
                <PriceInput
                  value={variant.costPrice || 0}
                  onChange={(value: number) => handleVariantCostPriceChange(variant.key, value)}
                  className="h-9 text-xs"
                />
              </td>

              {priceBooks.map((pb: any) => (
                <td key={`${variant.key}-${pb.id}`} className="py-3 px-4 border-l border-border/50">
                  <PriceInput
                    value={variant.priceBookPrices?.[pb.id] || 0}
                    onChange={(value: number) => handleVariantPriceBookChange(variant.key, pb.id, value)}
                    className="h-9 text-xs"
                  />
                </td>
              ))}

              <td className="py-3 px-4 border-l border-border/50">
                <input
                  className="form-input w-full text-right text-xs h-9 py-0 bg-transparent shadow-none focus:bg-background focus:ring-1"
                  value={variant.weight}
                  readOnly
                />
              </td>
            </tr>
          ))}

          {generatedVariants.length === 0 ? (
            <tr>
              <td colSpan={priceBooks.length + 7} className="py-8 text-center text-foreground-muted text-sm">
                Chua co phien ban nao duoc tao
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
