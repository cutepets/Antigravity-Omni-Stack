'use client'

import { ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from 'lucide-react'
import { useDataList } from './DataListShell'

interface DataListPaginationProps {
  page: number
  totalPages: number
  pageSize: number
  total: number
  rangeStart: number
  rangeEnd: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
  totalItemText?: ReactNode
  attachedToTable?: boolean
}

export function DataListPagination({
  page,
  totalPages,
  pageSize,
  total,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  totalItemText,
  attachedToTable = false,
}: DataListPaginationProps) {
  const { variant } = useDataList()
  const isPageVariant = variant === 'page'

  return (
    <div
      className={
        isPageVariant
          ? `${attachedToTable ? '' : '-mt-3 border-x border-b shadow-sm'} flex h-[50px] shrink-0 items-center justify-between gap-5 rounded-b-2xl border-t border-border bg-background-secondary px-4 py-0 text-sm`
          : 'flex shrink-0 flex-col gap-2 border-t border-border px-4 py-2.5 text-sm md:flex-row md:items-center md:justify-between md:gap-5'
      }
    >
      {/* Left side: Total Info */}
      <div className="flex items-center text-foreground-muted">
        {totalItemText}
      </div>

      <div className={isPageVariant ? 'flex items-center justify-center gap-5' : 'flex flex-col gap-2 md:flex-row md:items-center md:justify-center md:gap-5'}>
        {/* Page size */}
        <div className="flex items-center justify-center gap-2 text-foreground-muted">
          <span>Hiển thị</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-9 min-w-[78px] rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>/ trang</span>
        </div>

        {/* Range info */}
        <div className="text-center text-foreground-muted">
          {rangeStart}-{rangeEnd} / {total}
        </div>

        {/* Page controls */}
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-foreground"
          >
            <ChevronsRight size={14} className="rotate-180" />
          </button>

          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-foreground"
          >
            <ChevronLeft size={14} />
          </button>

          <span className="inline-flex h-9 min-w-[38px] items-center justify-center rounded-2xl bg-primary-500 px-3 font-semibold text-white">
            {page}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-foreground"
          >
            <ChevronRight size={14} />
          </button>

          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-foreground"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
