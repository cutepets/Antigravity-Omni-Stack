'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, X } from 'lucide-react'

export type ExportScope = 'all' | 'filtered' | 'page' | 'selected'

export type ExportColumnOption = {
  id: string
  label: string
  group: string
  required?: boolean
  defaultSelected?: boolean
}

export type ExportScopeOption = {
  id: ExportScope
  label: string
  description: string
  count: number
  disabled?: boolean
}

type ExportDataModalProps = {
  isOpen: boolean
  title: string
  storageKey: string
  scopeOptions: ExportScopeOption[]
  columns: ExportColumnOption[]
  isExporting?: boolean
  onClose: () => void
  onExport: (payload: { scope: ExportScope; columns: string[] }) => void
}

const COPY = {
  back: 'Quay l\u1ea1i',
  close: '\u0110\u00f3ng',
  scopeTitle: 'Gi\u1edbi h\u1ea1n k\u1ebft qu\u1ea3 xu\u1ea5t',
  exit: 'Tho\u00e1t',
  columns: 'T\u00f9y ch\u1ecdn c\u1ed9t',
  exporting: '\u0110ang xu\u1ea5t...',
  exportFile: 'Xu\u1ea5t file',
}

export function ExportDataModal({
  isOpen,
  title,
  storageKey,
  scopeOptions,
  columns,
  isExporting,
  onClose,
  onExport,
}: ExportDataModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [scope, setScope] = useState<ExportScope>('filtered')
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(() => new Set())

  const requiredColumnIds = useMemo(
    () => new Set(columns.filter((column) => column.required).map((column) => column.id)),
    [columns],
  )

  const groupedColumns = useMemo(() => {
    const groups = new Map<string, ExportColumnOption[]>()
    for (const column of columns) {
      const list = groups.get(column.group) ?? []
      list.push(column)
      groups.set(column.group, list)
    }
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
  }, [columns])

  useEffect(() => {
    if (!isOpen) return
    setStep(1)
    const firstEnabledScope = scopeOptions.find((option) => !option.disabled)?.id ?? 'filtered'
    setScope((current) => scopeOptions.some((option) => option.id === current && !option.disabled) ? current : firstEnabledScope)

    const defaults = columns
      .filter((column) => column.required || column.defaultSelected !== false)
      .map((column) => column.id)
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null
    let restored = defaults
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          restored = parsed.filter((id: string) => columns.some((column) => column.id === id))
        }
      } catch {
        restored = defaults
      }
    }
    setSelectedColumns(new Set([...restored, ...requiredColumnIds]))
  }, [columns, isOpen, requiredColumnIds, scopeOptions, storageKey])

  if (!isOpen) return null

  const toggleColumn = (column: ExportColumnOption) => {
    if (column.required) return
    setSelectedColumns((current) => {
      const next = new Set(current)
      if (next.has(column.id)) next.delete(column.id)
      else next.add(column.id)
      for (const id of requiredColumnIds) next.add(id)
      return next
    })
  }

  const toggleGroup = (items: ExportColumnOption[]) => {
    setSelectedColumns((current) => {
      const optionalItems = items.filter((item) => !item.required)
      const allSelected = optionalItems.every((item) => current.has(item.id))
      const next = new Set(current)
      for (const item of optionalItems) {
        if (allSelected) next.delete(item.id)
        else next.add(item.id)
      }
      for (const id of requiredColumnIds) next.add(id)
      return next
    })
  }

  const handleExport = () => {
    const columnsToExport = Array.from(selectedColumns)
    window.localStorage.setItem(storageKey, JSON.stringify(columnsToExport))
    onExport({ scope, columns: columnsToExport })
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center app-modal-overlay px-4 py-6">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            {step === 2 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
                aria-label={COPY.back}
              >
                <ArrowLeft size={22} />
              </button>
            ) : null}
            <h2 className="truncate text-2xl font-black text-foreground">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
            aria-label={COPY.close}
          >
            <X size={24} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
          {step === 1 ? (
            <div className="max-w-3xl space-y-5">
              <h3 className="text-lg font-bold text-foreground">{COPY.scopeTitle}</h3>
              <div className="space-y-3">
                {scopeOptions.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      option.disabled
                        ? 'cursor-not-allowed border-border bg-background-secondary/40 opacity-60'
                        : scope === option.id
                          ? 'border-primary-500 bg-primary-500/5'
                          : 'cursor-pointer border-transparent hover:bg-background-secondary/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${storageKey}-scope`}
                      checked={scope === option.id}
                      disabled={option.disabled}
                      onChange={() => setScope(option.id)}
                      className="mt-1 h-5 w-5 accent-primary-500"
                    />
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-foreground">{option.label}</span>
                      <span className="mt-1 block text-sm text-foreground-muted">
                        {option.description} ({option.count.toLocaleString('vi-VN')})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-7">
              {groupedColumns.map((group) => {
                const checkedCount = group.items.filter((item) => selectedColumns.has(item.id)).length
                const allChecked = checkedCount === group.items.length
                return (
                  <section key={group.label} className="border-b border-border pb-6 last:border-b-0">
                    <label className="mb-4 inline-flex items-center gap-3 text-lg font-black text-foreground">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={() => toggleGroup(group.items)}
                        className="h-5 w-5 accent-primary-500"
                      />
                      {group.label}
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {group.items.map((column) => (
                        <label key={column.id} className="inline-flex min-w-0 items-center gap-3 text-sm font-medium text-foreground">
                          <input
                            type="checkbox"
                            checked={selectedColumns.has(column.id)}
                            disabled={column.required}
                            onChange={() => toggleColumn(column)}
                            className="h-5 w-5 shrink-0 accent-primary-500 disabled:opacity-60"
                          />
                          <span className="truncate">{column.label}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 min-w-[120px] items-center justify-center rounded-xl border border-border px-5 text-sm font-bold text-foreground transition-colors hover:bg-background-secondary"
          >
            {COPY.exit}
          </button>
          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex h-11 min-w-[140px] items-center justify-center rounded-xl bg-primary-500 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              {COPY.columns}
            </button>
          ) : (
            <button
              type="button"
              disabled={selectedColumns.size === 0 || isExporting}
              onClick={handleExport}
              className="inline-flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              {isExporting ? COPY.exporting : COPY.exportFile}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
