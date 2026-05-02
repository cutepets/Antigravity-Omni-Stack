'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUpDown,
  ChevronDown,
  Columns3,
  GripVertical,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useDataList } from './DataListShell'
import { TableCheckbox } from './TableCheckbox'

interface DataListToolbarProps {
  // Search
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  searchClassName?: string

  // Total count slot (shown below search bar)
  totalSlot?: ReactNode

  // Inline filter pills (pinnable selects)
  filterSlot?: ReactNode

  // Column panel content (rendered inside the dropdown)
  columnPanelContent?: ReactNode

  // Extra action buttons (e.g. "Thêm sản phẩm")
  extraActions?: ReactNode

  // Toggle visibility of toolbar buttons
  showFilterToggle?: boolean
  showColumnToggle?: boolean
}

export function DataListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  searchClassName,
  totalSlot,
  filterSlot,
  columnPanelContent,
  extraActions,
  showFilterToggle = true,
  showColumnToggle = true,
}: DataListToolbarProps) {
  const { activePanel, variant, togglePanel } = useDataList()
  const isPageVariant = variant === 'page'
  const columnButtonRef = useRef<HTMLButtonElement | null>(null)
  const [columnPanelPosition, setColumnPanelPosition] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    if (activePanel !== 'column') {
      setColumnPanelPosition(null)
      return
    }

    const updatePosition = () => {
      const rect = columnButtonRef.current?.getBoundingClientRect()
      if (!rect) return

      setColumnPanelPosition({
        top: rect.bottom + 10,
        right: Math.max(12, window.innerWidth - rect.right),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [activePanel])

  return (
    <div className="shrink-0">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {/* Search */}
        {onSearchChange && (
          <div className={`relative flex-1 ${searchClassName ?? ''}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
            <input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={`h-11 w-full border border-border bg-background-secondary pl-10 pr-4 text-sm text-foreground outline-none transition-colors focus:border-primary-500 ${
                isPageVariant ? 'rounded-xl' : 'rounded-xl'
              }`}
            />
          </div>
        )}

        {/* Actions row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Inline filter pills */}
          {filterSlot}

          {/* Filter toggle */}
          {showFilterToggle && (
            <button
              type="button"
              onClick={() => togglePanel('filter')}
              className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors ${
                activePanel === 'filter'
                  ? 'border-primary-500 bg-primary-500/10 text-primary-500'
                  : 'border-border bg-background-secondary text-foreground hover:border-primary-500/60'
              }`}
            >
              <SlidersHorizontal size={16} />
              Lọc
            </button>
          )}

          {/* Column toggle + panel */}
          {showColumnToggle && (
            <div className="relative">
              <button
                ref={columnButtonRef}
                type="button"
                onClick={() => togglePanel('column')}
                className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors ${
                  activePanel === 'column'
                    ? 'border-primary-500 bg-primary-500/10 text-primary-500'
                    : 'border-border bg-background-secondary text-foreground hover:border-primary-500/60'
                }`}
              >
                <Columns3 size={16} />
                Cột
              </button>

              {activePanel === 'column' && columnPanelContent && columnPanelPosition
                ? createPortal(
                    <div
                      className="fixed z-50"
                      style={{ top: columnPanelPosition.top, right: columnPanelPosition.right }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {columnPanelContent}
                    </div>,
                    document.body,
                  )
                : null}
            </div>
          )}

          {/* Extra actions (e.g. Add button) */}
          {extraActions}
        </div>
      </div>
      {totalSlot}
    </div>
  )
}

// ─── Toolbar Select Helper ────────────────────────────────────────────────────
// For pinnable inline filter selects in the toolbar filterSlot

export const toolbarSelectClass =
  'h-11 min-w-[128px] rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500'
