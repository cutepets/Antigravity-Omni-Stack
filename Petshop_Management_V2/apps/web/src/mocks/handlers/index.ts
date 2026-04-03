import { inventoryHandlers, stockHandlers, reportsHandlers, settingsHandlers } from './phase1.handlers'

// Central registry — add existing handlers here when merging
export const handlers = [
  ...inventoryHandlers,
  ...stockHandlers,
  ...reportsHandlers,
  ...settingsHandlers,
]
