import { financeHandlers } from './finance.handlers'
import { inventoryHandlers, stockHandlers, reportsHandlers, settingsHandlers } from './phase1.handlers'

// Central registry — add existing handlers here when merging
export const handlers = [
  ...financeHandlers,
  ...inventoryHandlers,
  ...stockHandlers,
  ...reportsHandlers,
  ...settingsHandlers,
]
