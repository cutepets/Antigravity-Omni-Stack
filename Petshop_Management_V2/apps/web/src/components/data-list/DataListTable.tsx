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
    <div className={`flex min-h-0 grow-0 flex-col overflow-hidden rounded-2xl border border-border bg-background-secondary shadow-sm ${className ?? ''}`}>
      {/* Scrollable table area */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-auto bg-background-secondary">
        <table className="w-full min-w-[1040px] border-separate border-spacing-0">
          <thead className="sticky top-0 z-20 bg-background-tertiary shadow-[0_1px_0_var(--color-border),0_8px_18px_rgba(15,23,42,0.06)]">
            {/* Overlay Bulk Bar over the header */}
            {bulkBar && (
              <tr className="absolute inset-0 z-30">
                <th colSpan={colSpan} className="p-0">
                  <div className="flex h-full w-full items-center bg-background-tertiary">
                    {bulkBar}
                  </div>
                </th>
              </tr>
            )}

            <tr className="relative z-10 border-b border-border">
              {/* Select-all checkbox */}
              <th className="w-10 border-b border-border px-4 py-3.5 text-left">
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
                  className={`border-b border-border px-3 py-3.5 text-xs font-bold uppercase tracking-[0.12em] text-foreground-secondary ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.width ?? ''} ${col.minWidth ?? ''} w-[64px]`}
                >{col.label}</th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border bg-background-secondary">
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
  );
}
