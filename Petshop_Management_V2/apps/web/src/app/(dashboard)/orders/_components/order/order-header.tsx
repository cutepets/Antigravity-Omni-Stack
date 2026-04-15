'use client'

import { useState } from 'react'
import { ArrowLeft, ChevronDown, PencilLine, Printer, ReceiptText, Save } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageLayout'
import type { OrderWorkspaceMode } from './order.types'

interface OrderHeaderProps {
  mode: OrderWorkspaceMode
  title: string
  description: string
  isEditing: boolean
  pendingAction: boolean
  canEdit: boolean
  showPrintActions: boolean
  onBack: () => void
  onEdit: () => void
  onSave: () => void
  onPrintA4?: () => void
  onPrintK80?: () => void
  onPrintPdf?: () => void
}

export function OrderHeader({
  mode,
  title,
  description,
  isEditing,
  pendingAction,
  canEdit,
  showPrintActions,
  onBack,
  onEdit,
  onSave,
  onPrintA4,
  onPrintK80,
  onPrintPdf,
}: OrderHeaderProps) {
  const [showPrintMenu, setShowPrintMenu] = useState(false)

  return (
    <PageHeader
      title={title}
      description={description}
      icon={ReceiptText}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
          >
            <ArrowLeft size={16} />
            Danh sach don
          </button>

          {showPrintActions ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPrintMenu((current) => !current)}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
              >
                <Printer size={16} />
                In hoa don
                <ChevronDown size={14} />
              </button>

              {showPrintMenu ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-44 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrintMenu(false)
                      onPrintA4?.()
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-background-secondary"
                  >
                    <Printer size={15} className="text-primary-500" />
                    In kho A4
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrintMenu(false)
                      onPrintK80?.()
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-background-secondary"
                  >
                    <Printer size={15} className="text-primary-500" />
                    In K80
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrintMenu(false)
                      onPrintPdf?.()
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-background-secondary"
                  >
                    <Printer size={15} className="text-primary-500" />
                    Xuat PDF
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === 'detail' && canEdit && !isEditing ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
            >
              <PencilLine size={16} />
              Chinh sua
            </button>
          ) : null}

          {isEditing ? (
            <button
              type="button"
              onClick={onSave}
              disabled={pendingAction}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Save size={16} />
              {mode === 'create' ? 'Luu don' : 'Luu cap nhat'}
            </button>
          ) : null}
        </div>
      }
    />
  )
}
