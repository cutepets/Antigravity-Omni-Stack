import {
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from 'lucide-react'

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
}: DataListPaginationProps) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-border px-4 py-4 text-sm md:flex-row md:items-center md:justify-center md:gap-8">
      {/* Page size */}
      <div className="flex items-center justify-center gap-2 text-foreground-muted">
        <span>Hiển thị</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-10 min-w-[82px] rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
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
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-foreground"
        >
          <ChevronsRight size={14} className="rotate-180" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-foreground"
        >
          <ChevronLeft size={14} />
        </button>

        <span className="inline-flex h-10 min-w-[40px] items-center justify-center rounded-2xl bg-primary-500 px-3 font-semibold text-white">
          {page}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-foreground"
        >
          <ChevronRight size={14} />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-foreground"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  )
}
