import type { SelectedItem } from './receipt.types'

export type LocalReceiptDraftItem = Pick<
  SelectedItem,
  | 'lineId'
  | 'receiptItemId'
  | 'productId'
  | 'productVariantId'
  | 'barcode'
  | 'sku'
  | 'name'
  | 'unit'
  | 'sellingPrice'
  | 'quantity'
  | 'unitCost'
  | 'discount'
  | 'note'
  | 'totalStock'
  | 'monthlySellThrough'
  | 'variantName'
  | 'variantLabel'
  | 'unitLabel'
  | 'baseSku'
  | 'baseBarcode'
  | 'baseUnit'
  | 'baseUnitCost'
  | 'baseTotalStock'
  | 'baseMonthlySellThrough'
  | 'receivedQuantity'
  | 'returnedQuantity'
  | 'closedQuantity'
>

export function compactLocalReceiptDraftItems(items: SelectedItem[]): LocalReceiptDraftItem[] {
  return items.map((item) => ({
    lineId: item.lineId,
    receiptItemId: item.receiptItemId ?? null,
    productId: item.productId,
    productVariantId: item.productVariantId ?? null,
    barcode: item.barcode ?? null,
    sku: item.sku ?? null,
    name: item.name,
    unit: item.unit ?? null,
    sellingPrice: Number(item.sellingPrice ?? 0),
    quantity: Number(item.quantity ?? 1),
    unitCost: Number(item.unitCost ?? 0),
    discount: Number(item.discount ?? 0),
    note: item.note ?? '',
    totalStock: item.totalStock ?? null,
    monthlySellThrough: item.monthlySellThrough ?? null,
    variantName: item.variantName ?? null,
    variantLabel: item.variantLabel ?? null,
    unitLabel: item.unitLabel ?? null,
    baseSku: item.baseSku ?? null,
    baseBarcode: item.baseBarcode ?? null,
    baseUnit: item.baseUnit ?? null,
    baseUnitCost: Number(item.baseUnitCost ?? item.unitCost ?? 0),
    baseTotalStock: item.baseTotalStock ?? null,
    baseMonthlySellThrough: item.baseMonthlySellThrough ?? null,
    receivedQuantity: Number(item.receivedQuantity ?? 0),
    returnedQuantity: Number(item.returnedQuantity ?? 0),
    closedQuantity: Number(item.closedQuantity ?? 0),
  }))
}
