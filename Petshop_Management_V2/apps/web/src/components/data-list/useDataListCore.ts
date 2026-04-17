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

  const [columnOrder, setColumnOrder] = useState<TColumnId[]>(initialColumnOrder)
  const [visibleColumns, setVisibleColumns] = useState<Set<TColumnId>>(new Set(initialVisibleColumns))
  const [draggingColumnId, setDraggingColumnId] = useState<TColumnId | null>(null)

  // Sort
  const [columnSort, setColumnSort] = useState<ColumnSortState<TColumnId>>({ columnId: null, direction: null })

  // Filters
  const [topFilterVisibility, setTopFilterVisibility] = useState<Record<TFilterId, boolean>>(initialTopFilterVisibility)

  const [isInitialized, setIsInitialized] = useState(false)

  // Load state on mount
  useEffect(() => {
    const stored = getStoredState()
    if (stored) {
      if (stored.columnOrder) {
        const rawOrder = stored.columnOrder
        const existing = new Set(rawOrder)
        const missing = initialColumnOrder.filter((id) => !existing.has(id as TColumnId))
        setColumnOrder([...rawOrder, ...missing] as TColumnId[])
      }
      if (stored.visibleColumns) {
        // Ensure standard columns are respected if missing
        setVisibleColumns(new Set(stored.visibleColumns))
      }
      if (stored.columnSort) setColumnSort(stored.columnSort)
      if (stored.topFilterVisibility) setTopFilterVisibility(stored.topFilterVisibility)
    }
    setIsInitialized(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    if (!storageKey || !isInitialized) return
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        columnOrder,
        visibleColumns: Array.from(visibleColumns),
        columnSort,
        topFilterVisibility,
      })
    )
  }, [storageKey, isInitialized, columnOrder, visibleColumns, columnSort, topFilterVisibility])

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
