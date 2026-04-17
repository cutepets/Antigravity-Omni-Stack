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
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">Bảng phiên bản</span>
        <span className="badge badge-primary px-2">{generatedVariants.length} phiên bản</span>
      </div>
      
      <table className="min-w-[1280px] w-full text-left border-collapse">
        <thead className="bg-background-tertiary/50">
            <tr>
              <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider w-14 text-center">Ảnh</th>
              <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider min-w-[200px]">Tên phiên bản / đơn vị</th>
              <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider w-40 border-l border-border/50">SKU</th>
              <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider w-44 border-l border-border/50">Mã vạch</th>
              <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider w-32 border-l border-border/50">Giá nhập</th>
              {priceBooks.map((pb: any) => (
                <th key={pb.id} className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider w-40 border-l border-border/50">
                  {pb.name}
                </th>
              ))}
              <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-wider w-28 text-right border-l border-border/50">Lượng (g)</th>
            </tr>
        </thead>
        <tbody className="text-sm divide-y divide-border/50">
            {generatedVariants.map((v) => (
              <tr key={v.key} className={`group hover:bg-background-secondary/30 ${v.isConversion ? 'bg-background-tertiary/20' : ''}`}>
                  <td className="py-3 px-4 text-center relative">
                    {v.isConversion && <div className="absolute top-0 bottom-1/2 left-4 w-px border-l-2 border-border/50"></div>}
                    {v.isConversion && <div className="absolute top-1/2 left-4 w-2 h-px border-t-2 border-border/50"></div>}
                    <div className="relative z-10 mx-auto w-8">
                        <label className={`flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed border-border transition-colors ${
                          v.image || productImage
                            ? 'bg-background'
                            : v.isConversion
                              ? 'bg-background-tertiary hover:border-primary-500'
                              : 'bg-background hover:border-primary-500'
                        }`}>
                          {v.image || productImage ? (
                            <Image src={v.image || productImage || ''} alt={v.name} className="h-full w-full object-cover" width={400} height={400} unoptimized />
                          ) : (
                            <ImagePlus size={14} className="text-foreground-muted" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleImageChange(e, (image) =>
                                setVariantImages(current => ({ ...current, [v.imageKey]: image }))
                              )
                            }
                          />
                        </label>
                        {v.image && (
                          <button
                            type="button"
                            onClick={() => clearVariantImage(v.imageKey)}
                            className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-background-base text-[10px] text-white shadow"
                          >
                            ×
                          </button>
                        )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-foreground bg-background-tertiary/50 px-3 py-1.5 rounded-lg border border-border inline-flex w-full">
                        {v.name}
                    </div>
                    {v.isConversion && (
                        <div className="text-[10px] text-foreground-muted mt-1.5 ml-1">
                          {v.conversionRate} {formData.unit} = 1 {v.unit}
                        </div>
                    )}
                  </td>
                  <td className="py-3 px-4 border-l border-border/50">
                    <input
                      value={v.sku}
                      onChange={(e) => handleVariantSkuChange(v.key, e.target.value)}
                      className="form-input w-full text-xs font-mono uppercase"
                      placeholder="SKU phiên bản"
                    />
                  </td>
                  <td className="py-3 px-4 border-l border-border/50">
                    <input
                      value={v.barcode}
                      onChange={(e) => handleVariantBarcodeChange(v.key, e.target.value)}
                      className="form-input w-full text-xs"
                      placeholder="Mã vạch phiên bản"
                    />
                  </td>
                  <td className="py-3 px-4 border-l border-border/50">
                    <PriceInput
                      value={v.costPrice || 0}
                      onChange={(val: number) => handleVariantCostPriceChange(v.key, val)}
                      className="h-9 text-xs"
                    />
                  </td>
                  {priceBooks.map((pb: any) => (
                    <td key={`${v.key}-${pb.id}`} className="py-3 px-4 border-l border-border/50">
                        <PriceInput
                          value={v.priceBookPrices?.[pb.id] || 0}
                          onChange={(val: number) => handleVariantPriceBookChange(v.key, pb.id, val)}
                          className="h-9 text-xs"
                        />
                    </td>
                  ))}
                  <td className="py-3 px-4 border-l border-border/50">
                    <input className="form-input w-full text-right text-xs h-9 py-0 bg-transparent shadow-none focus:bg-background focus:ring-1" value={v.weight} readOnly />
                  </td>
              </tr>
            ))}
            {generatedVariants.length === 0 && (
              <tr>
                  <td colSpan={priceBooks.length + 6} className="py-8 text-center text-foreground-muted text-sm">Chưa có phiên bản nào được tạo</td>
              </tr>
            )}
        </tbody>
      </table>
    </div>
  )
}