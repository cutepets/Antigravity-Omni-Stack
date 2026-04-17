// ─── Receipt Types ─────────────────────────────────────────────────────────────
// Extracted from create-receipt-form.tsx to keep the main file lean.

export interface BranchStock {
  branchId: string
  branch?: { id: string; name: string }
  stock?: number | null
  reservedStock?: number | null
  availableStock?: number | null
}

export interface SelectedItem {
  lineId: string
  receiptItemId?: string | null
  productId: string
  productVariantId?: string | null
  barcode?: string | null
  sku?: string | null
  name: string
  image?: string | null
  unit?: string | null
  sellingPrice: number
  quantity: number
  unitCost: number
  discount: number
  note: string
  totalStock?: number | null
  monthlySellThrough?: number | null
  branchStocks?: BranchStock[]
  variants?: ProductVariantOption[]
  variantName?: string | null
  variantLabel?: string | null
  unitLabel?: string | null
  baseSku?: string | null
  baseBarcode?: string | null
  baseUnit?: string | null
  baseUnitCost?: number
  baseTotalStock?: number | null
  baseMonthlySellThrough?: number | null
  baseBranchStocks?: BranchStock[]
  receivedQuantity?: number
  returnedQuantity?: number
  closedQuantity?: number
}

export interface ProductVariantOption {
  id: string
  name: string
  variantLabel?: string | null
  unitLabel?: string | null
  sku?: string | null
  barcode?: string | null
  price?: number | null
  sellingPrice?: number | null
  costPrice?: number | null
  image?: string | null
  conversions?: string | null
  branchStocks?: BranchStock[]
  stock?: number | null
  availableStock?: number | null
  monthlySellThrough?: number | null
  trading?: number | null
}

export interface ExtraCostRow {
  id: string
  label: string
  amount: number
}

export interface SupplierQuickDraftItem {
  productId: string
  productVariantId?: string | null
  name: string
  sku?: string | null
  unit?: string | null
  quantity: number
  unitCost: number
}

export interface SupplierQuickDraftPayload {
  supplierId?: string
  notes?: string
  items?: SupplierQuickDraftItem[]
}

export interface SupplierQuickForm {
  code: string
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

export interface ReceiptEditSession {
  id: string
  editedAt: string
  editedBy: string
  itemCount: number
  totalQuantity: number
}

export interface ReceiptMetaPayload {
  discount: number
  tax: number
  extraCosts: Array<{ label: string; amount: number }>
  editSessions?: ReceiptEditSession[]
}

export interface ReceiptPaymentFormState {
  amount: number
  paymentMethod: string
  notes: string
}

export interface ReceiptReturnLineDraft {
  receiptItemId: string
  productId: string
  productVariantId?: string | null
  name: string
  sku?: string | null
  unitPrice: number
  availableQty: number
  quantity: number
}

export type ReceiptReturnSettlementMode = 'OFFSET_DEBT' | 'CREATE_REFUND'

export interface ReceiptReturnFormState {
  notes: string
  items: ReceiptReturnLineDraft[]
  settlementMode: ReceiptReturnSettlementMode
  refundPaymentMethod: string
}

export type SubmitMode = 'draft' | 'receive'
export type ReceiptScreenMode = 'create' | 'edit'

export interface CreateReceiptFormProps {
  mode?: ReceiptScreenMode
  receiptId?: string
}

export interface ReceiptPaymentModalProps {
  isOpen: boolean
  form: ReceiptPaymentFormState
  debtAmount: number
  supplierDebtAmount: number
  orderAmount: number
  isPending: boolean
  onClose: () => void
  onChange: (
    field: keyof ReceiptPaymentFormState,
    value: ReceiptPaymentFormState[keyof ReceiptPaymentFormState],
  ) => void
  onConfirm: () => void
}

export interface ReceiptReturnModalProps {
  isOpen: boolean
  form: ReceiptReturnFormState
  estimatedRefundAmount: number
  isPending: boolean
  onClose: () => void
  onChangeNotes: (value: string) => void
  onChangeQuantity: (receiptItemId: string, quantity: number) => void
  onChangeSettlementMode: (value: ReceiptReturnSettlementMode) => void
  onChangeRefundPaymentMethod: (value: string) => void
  onConfirm: () => void
}
