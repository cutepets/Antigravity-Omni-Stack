import { useState } from 'react'

export function useDataListSelection(visibleRowIds: string[]) {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [lastSelectedRowId, setLastSelectedRowId] = useState<string | null>(null)

  const selectedVisibleCount = visibleRowIds.filter((id) => selectedRowIds.has(id)).length
  const allVisibleSelected = visibleRowIds.length > 0 && selectedVisibleCount === visibleRowIds.length

  const toggleRowSelection = (rowId: string, shiftKey = false) => {
    setSelectedRowIds((current) => {
      if (shiftKey && lastSelectedRowId) {
        const startIndex = visibleRowIds.indexOf(lastSelectedRowId)
        const endIndex = visibleRowIds.indexOf(rowId)

        if (startIndex !== -1 && endIndex !== -1) {
          const next = new Set(current)
          const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
          visibleRowIds.slice(from, to + 1).forEach((id) => next.add(id))
          return next
        }
      }

      const next = new Set(current)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
    setLastSelectedRowId(rowId)
  }

  const toggleSelectAllVisible = () => {
    setSelectedRowIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        visibleRowIds.forEach((id) => next.delete(id))
      } else {
        visibleRowIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const clearSelection = () => {
    setSelectedRowIds(new Set())
    setLastSelectedRowId(null)
  }

  return {
    selectedRowIds,
    toggleRowSelection,
    toggleSelectAllVisible,
    clearSelection,
    allVisibleSelected,
    selectedVisibleCount,
  }
}
