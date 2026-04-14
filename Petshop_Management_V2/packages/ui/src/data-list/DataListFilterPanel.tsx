import type { ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useDataList } from './DataListShell'

interface DataListFilterPanelProps {
  children: ReactNode
  title?: string
  onClearAll?: () => void
}

export function DataListFilterPanel({
  children,
  title = 'Bộ lọc nâng cao',
  onClearAll,
}: DataListFilterPanelProps) {
  const { activePanel } = useDataList()

  if (activePanel !== 'filter') return null

  return (
    <div className="shrink-0">
      <div className="rounded-2xl border border-border bg-background-secondary/80 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
            <SlidersHorizontal size={16} className="text-primary-500" />
            {title}
          </div>
          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-sm text-foreground-muted hover:text-foreground"
            >
              Xóa tất cả
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// Reusable filter field wrapper with pin support
interface FilterFieldProps {
  label: ReactNode
  children: ReactNode
}

export function FilterField({ label, children }: FilterFieldProps) {
  return (
    <label className="space-y-2">
      <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

// Standard select style for filter fields
export const filterSelectClass =
  'h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500'

// Standard input style for filter fields
export const filterInputClass =
  'h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500'