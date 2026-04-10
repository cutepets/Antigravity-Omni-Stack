import { useState, useCallback, useMemo, useEffect } from 'react'

export type SortDirection = 'asc' | 'desc'
export type ColumnSortState<TColumnId extends string> = {
  columnId: TColumnId | null
  direction: SortDirection | null
}

export interface UseDataListCoreOptions<TColumnId extends string, TFilterId extends string> {
  initialColumnOrder: TColumnId[]
  initialVisibleColumns?: TColumnId[]
  initialTopFilterVisibility?: Record<TFilterId, boolean>
  storageKey?: string
}

export function useDataListCore<TColumnId extends string, TFilterId extends string = string>({
  initialColumnOrder,
  initialVisibleColumns = initialColumnOrder,
  initialTopFilterVisibility = {} as Record<TFilterId, boolean>,
  storageKey,
}: UseDataListCoreOptions<TColumnId, TFilterId>) {
  const getStoredState = () => {
    if (typeof window === 'undefined' || !storageKey) return null
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  const stored = getStoredState()

  // Columns
  const [columnOrder, setColumnOrder] = useState<TColumnId[]>(() => {
    const rawOrder = stored?.columnOrder ?? initialColumnOrder
    // If we added new columns to the code but local storage has an old list, append the new ones safely
    const existing = new Set(rawOrder)
    const missing = initialColumnOrder.filter((id) => !existing.has(id))
    return [...rawOrder, ...missing]
  })
  
  const [visibleColumns, setVisibleColumns] = useState<Set<TColumnId>>(
    () => {
      // If we don't have stored visible columns, use initial. But we always ensure standard columns are respected.
      return new Set(stored?.visibleColumns ?? initialVisibleColumns)
    }
  )
  const [draggingColumnId, setDraggingColumnId] = useState<TColumnId | null>(null)

  // Sort
  const [columnSort, setColumnSort] = useState<ColumnSortState<TColumnId>>(
    stored?.columnSort ?? { columnId: null, direction: null }
  )

  // Filters
  const [topFilterVisibility, setTopFilterVisibility] = useState<Record<TFilterId, boolean>>(
    stored?.topFilterVisibility ?? initialTopFilterVisibility
  )

  useEffect(() => {
    if (!storageKey) return
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        columnOrder,
        visibleColumns: Array.from(visibleColumns),
        columnSort,
        topFilterVisibility,
      })
    )
  }, [storageKey, columnOrder, visibleColumns, columnSort, topFilterVisibility])

  const toggleColumn = useCallback((id: TColumnId) => {
    setVisibleColumns((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        if (current.size > 1) next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const reorderColumn = useCallback((sourceId: TColumnId, targetId: TColumnId) => {
    setColumnOrder((current) => {
      const sourceIndex = current.indexOf(sourceId)
      const targetIndex = current.indexOf(targetId)
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return current
      const next = [...current]
      next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, sourceId)
      return next
    })
  }, [])

  const toggleColumnSort = useCallback((id: TColumnId) => {
    setColumnSort((current) => {
      if (current.columnId === id) {
        if (current.direction === 'asc') return { columnId: id, direction: 'desc' }
        if (current.direction === 'desc') return { columnId: null, direction: null }
      }
      return { columnId: id, direction: 'asc' }
    })
  }, [])

  const toggleTopFilterVisibility = useCallback((id: TFilterId) => {
    setTopFilterVisibility((current) => ({
      ...current,
      [id]: !current[id],
    }))
  }, [])

  const orderedVisibleColumns = useMemo(
    () => columnOrder.filter((id) => visibleColumns.has(id)),
    [columnOrder, visibleColumns]
  )

  return {
    // State
    columnOrder,
    visibleColumns,
    draggingColumnId,
    columnSort,
    topFilterVisibility,
    orderedVisibleColumns,

    // Actions
    setDraggingColumnId,
    toggleColumn,
    reorderColumn,
    toggleColumnSort,
    toggleTopFilterVisibility,
    setColumnOrder,
    setVisibleColumns,
    setColumnSort,
  }
}
