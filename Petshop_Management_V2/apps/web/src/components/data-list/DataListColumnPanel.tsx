'use client'

import { ArrowUpDown, ChevronDown, GripVertical } from 'lucide-react'
import { TableCheckbox } from './TableCheckbox'
import { useDataList } from './DataListShell'

interface ColumnDef {
  id: string
  label: string
}

interface ColumnSortInfo {
  columnId: string | null
  direction: 'asc' | 'desc' | null
}

interface DataListColumnPanelProps {
  columns: ColumnDef[]
  columnOrder: string[]
  visibleColumns: Set<string>
  sortInfo?: ColumnSortInfo
  sortableColumns?: Set<string>
  draggingColumnId?: string | null
  onToggle: (id: string) => void
  onReorder: (sourceId: string, targetId: string) => void
  onToggleSort?: (id: string) => void
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
}

export function DataListColumnPanel({
  columns,
  columnOrder,
  visibleColumns,
  sortInfo,
  sortableColumns,
  draggingColumnId,
  onToggle,
  onReorder,
  onToggleSort,
  onDragStart,
  onDragEnd,
}: DataListColumnPanelProps) {
  const { closePanel } = useDataList()

  const columnMap = Object.fromEntries(columns.map((col) => [col.id, col]))

  return (
    <div className="w-[320px] rounded-2xl border border-border bg-[#161d29] p-4 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-foreground">Tùy chỉnh hiển thị cột</div>
          <div className="text-xs text-foreground-muted mt-1">Kéo thả để đổi thứ tự, bỏ chọn để ẩn cột.</div>
        </div>
        <button
          type="button"
          onClick={closePanel}
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          Đóng
        </button>
      </div>

      <div className="mt-4 max-h-[320px] overflow-y-auto pr-1 space-y-2">
        {columnOrder.map((columnId) => {
          const col = columnMap[columnId]
          if (!col) return null

          const isSorted = sortInfo?.columnId === columnId && sortInfo?.direction
          const isSortable = sortableColumns?.has(columnId) ?? false

          return (
            <div
              key={columnId}
              draggable
              onDragStart={() => onDragStart?.(columnId)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!draggingColumnId || draggingColumnId === columnId) return
                onReorder(draggingColumnId, columnId)
                onDragEnd?.()
              }}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                draggingColumnId === columnId
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-transparent bg-background-secondary hover:border-border'
              }`}
            >
              <TableCheckbox
                checked={visibleColumns.has(columnId)}
                onCheckedChange={() => onToggle(columnId)}
              />
              <span className="flex-1 text-base font-semibold text-foreground">{col.label}</span>

              {onToggleSort && (
                <button
                  type="button"
                  onClick={() => onToggleSort(columnId)}
                  disabled={!isSortable}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                    isSorted
                      ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                      : 'border-border text-foreground-muted hover:border-primary-500/60 hover:text-foreground'
                  } disabled:cursor-not-allowed disabled:opacity-30`}
                >
                  {sortInfo?.columnId === columnId ? (
                    <>
                      <ChevronDown
                        size={14}
                        className={sortInfo.direction === 'asc' ? 'rotate-180' : ''}
                      />
                      <span>{sortInfo.direction === 'asc' ? 'Tăng' : 'Giảm'}</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpDown size={14} />
                      <span>Sort</span>
                    </>
                  )}
                </button>
              )}

              <GripVertical size={18} className="text-foreground-muted cursor-grab active:cursor-grabbing" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
