'use client'

import type { ReactNode } from 'react'
import { useId } from 'react'
import { useDataList } from './DataListShell'
import { TableCheckbox } from './TableCheckbox'

interface ColDef {
  id: string
  label: string
  width?: string
  minWidth?: string
  align?: 'left' | 'center' | 'right'
}

interface DataListTableProps {
  columns: ColDef[]
  isLoading?: boolean
  isEmpty?: boolean
  emptyText?: string
  loadingText?: string
  bulkBar?: ReactNode
  allSelected?: boolean
  someSelected?: boolean
  onSelectAll?: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}

function normalizeColumnToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function inferColumnAlign(col: ColDef): ColDef['align'] {
  if (col.align) return col.align

  const token = normalizeColumnToken(`${col.id} ${col.label}`)
  const looksLikeMoney = /(amount|price|cost|debt|salary|spent|paid|total|revenue|commission|discount|fee)/.test(token)
    || /(gia|tien|luong|no|cong no|chi tieu|doanh thu|hoa hong|tong tien|thanh tien)/.test(token)

  return looksLikeMoney ? 'right' : undefined
}

export function DataListTable({
  columns,
  isLoading = false,
  isEmpty = false,
  emptyText = 'Khong co du lieu phu hop.',
  loadingText = 'Dang tai du lieu...',
  bulkBar,
  allSelected = false,
  onSelectAll,
  children,
  footer,
  className,
}: DataListTableProps) {
  const { variant } = useDataList()
  const colSpan = columns.length + 1
  const isPageVariant = variant === 'page'
  const tableScopeClass = `data-list-table-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const bodyColumnOffset = onSelectAll ? 1 : 0
  const rightAlignedBodySelectors = columns
    .map((col, index) => inferColumnAlign(col) === 'right' ? `.${tableScopeClass} tbody tr > td:nth-child(${index + 1 + bodyColumnOffset})` : null)
    .filter(Boolean)
    .join(', ')

  return (
    <div
      className={`${tableScopeClass} flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border shadow-sm ${
        isPageVariant ? 'flex-1 bg-background-secondary' : 'flex-1 bg-card'
      } ${className ?? ''}`}
    >
      {rightAlignedBodySelectors ? (
        <style>{`${rightAlignedBodySelectors}{text-align:right}`}</style>
      ) : null}
      <div className={`custom-scrollbar min-h-0 flex-1 overflow-auto ${isPageVariant ? 'bg-background-secondary' : ''}`}>
        <table className={`w-full min-w-[1040px] ${isPageVariant ? 'border-separate border-spacing-0' : ''}`}>
          <thead
            className={
              isPageVariant
                ? 'sticky top-0 z-20 bg-background-tertiary shadow-[0_1px_0_var(--color-border),0_8px_18px_rgba(15,23,42,0.06)]'
                : 'sticky top-0 z-20 bg-background-secondary'
            }
          >
            {bulkBar ? (
              <tr className={`border-b border-border ${isPageVariant ? 'h-[50px]' : ''}`}>
                <th colSpan={colSpan} className="border-b border-border p-0 text-left">
                  {bulkBar}
                </th>
              </tr>
            ) : (
              <tr className={`border-b border-border ${isPageVariant ? 'h-[50px]' : ''}`}>
                <th className={`${isPageVariant ? 'w-10 border-b border-border py-0' : 'w-12 py-3'} px-4 text-left`}>
                  {onSelectAll && (
                    <TableCheckbox
                      checked={allSelected}
                      onCheckedChange={onSelectAll}
                    />
                  )}
                </th>

                {columns.map((col) => {
                  const align = inferColumnAlign(col)
                  return (
                    <th
                      key={col.id}
                      className={`px-3 ${
                        isPageVariant
                          ? 'border-b border-border py-0 text-xs font-bold uppercase tracking-[0.12em] text-foreground-secondary'
                          : 'py-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted'
                      } ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${col.width ?? ''} ${col.minWidth ?? ''}`}
                    >
                      {col.label}
                    </th>
                  )
                })}
              </tr>
            )}
          </thead>

          <tbody className={isPageVariant ? 'divide-y divide-border bg-background-secondary' : undefined}>
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
      {footer}
    </div>
  )
}
