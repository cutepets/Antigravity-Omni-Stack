import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { TableCheckbox } from './TableCheckbox'

interface DataListBulkBarProps {
  selectedCount: number
  onClear: () => void
  children: ReactNode
}

export function DataListBulkBar({ selectedCount, onClear, children }: DataListBulkBarProps) {
  return (
    <div className="flex h-full w-full shrink-0 items-center gap-3 overflow-x-auto border-b border-border bg-[#10141d]/80 px-4 whitespace-nowrap backdrop-blur-md dark:bg-cyan-950/20">
      <div className="inline-flex items-center gap-4 text-primary-500">
        <TableCheckbox checked onCheckedChange={onClear} />
        <span className="text-sm font-semibold">Đã chọn {selectedCount}</span>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500 transition-colors hover:bg-primary-500/20"
      >
        <X size={16} />
      </button>

      <div className="h-5 w-px bg-border/70" />

      {children}
    </div>
  )
}