import type { ReactNode } from 'react'
import { TableCheckbox } from './TableCheckbox'

interface ColDef {
  id: string
  label: string
  width?: string       // e.g. 'w-20'
  minWidth?: string    // e.g. 'min-w-[300px]'
  align?: 'left' | 'center' | 'right'
}

interface DataListTableProps {
  columns: ColDef[]
  isLoading?: boolean
  isEmpty?: boolean
  emptyText?: string
  loadingText?: string

  // Bulk bar (rendered above thead inside the table card)
  bulkBar?: ReactNode

  // Select-all checkbox in header
  allSelected?: boolean
  someSelected?: boolean
  onSelectAll?: () => void

  children: ReactNode
  className?: string
}

export function DataListTable({
  columns,
  isLoading = false,
  isEmpty = false,
  emptyText = 'Không có dữ liệu phù hợp.',
  loadingText = 'Đang tải dữ liệu...',
  bulkBar,
  allSelected = false,
  onSelectAll,
  children,
  className,
}: DataListTableProps) {
  const colSpan = columns.length + 1 // +1 for checkbox col

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm ${className ?? ''}`}>
      {/* Scrollable table area */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1040px]">
          <thead className="sticky top-0 z-20 bg-background-secondary/95 backdrop-blur">
            {/* Overlay Bulk Bar over the header */}
            {bulkBar && (
              <div className="absolute inset-0 z-30 flex items-center bg-background-secondary/95 backdrop-blur">
                <div className="w-full h-full flex items-center">
                  {bulkBar}
                </div>
              </div>
            )}
            
            <tr className="border-b border-border relative z-10">
              {/* Select-all checkbox */}
              <th className="w-12 px-4 py-3 text-left">
                {onSelectAll && (
                  <TableCheckbox
                    checked={allSelected}
                    onCheckedChange={onSelectAll}
                  />
                )}
              </th>

              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.width ?? ''} ${col.minWidth ?? ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-16 text-center text-foreground-muted">
                  {loadingText}
                </td>
              </tr>
            ) : isEmpty ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-16 text-center text-foreground-muted">
                  {emptyText}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}