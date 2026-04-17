// ─── Receipt Constants ─────────────────────────────────────────────────────────

export const RECEIPT_META_MARKER = '[RECEIPT_META]'

export const SUPPLIER_RECEIPT_DRAFT_KEY = 'inventory.receiptDraftFromSupplier'
export const LOCAL_RECEIPT_DRAFT_KEY = 'inventory.receiptDraft.local'

export const RECEIPT_PAYMENT_METHOD_OPTIONS = [
  { value: 'BANK', label: 'Chuyển khoản' },
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'MOMO', label: 'MoMo' },
  { value: 'CARD', label: 'Thẻ' },
]
