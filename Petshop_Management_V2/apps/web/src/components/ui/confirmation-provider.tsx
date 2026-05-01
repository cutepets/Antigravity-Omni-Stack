'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ConfirmationVariant = 'danger' | 'warning' | 'info' | 'success'

type ConfirmOptions = {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmationVariant
}

type PromptOptions = ConfirmOptions & {
  defaultValue?: string
  placeholder?: string
  required?: boolean
}

type DialogInput = ConfirmOptions | string
type PromptInput = PromptOptions | string

type ConfirmationState = ConfirmOptions & {
  mode: 'confirm'
  resolve: (value: boolean) => void
}

type PromptState = PromptOptions & {
  mode: 'prompt'
  resolve: (value: string | null) => void
}

type ConfirmationContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  prompt: (options: PromptOptions) => Promise<string | null>
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null)
let requestDialog: ((state: ConfirmOptions | PromptOptions, mode: 'confirm' | 'prompt') => Promise<boolean | string | null>) | null = null

function normalizeDialogInput(options: DialogInput): ConfirmOptions {
  return typeof options === 'string' ? { title: options } : options
}

function normalizePromptInput(options: PromptInput): PromptOptions {
  return typeof options === 'string' ? { title: options } : options
}

const variantStyles: Record<
  ConfirmationVariant,
  {
    icon: React.ComponentType<{ size?: number; className?: string }>
    iconClassName: string
    confirmClassName: string
  }
> = {
  danger: {
    icon: AlertTriangle,
    iconClassName: 'bg-error/10 text-error ring-error/20',
    confirmClassName: 'bg-error text-white hover:bg-error/90 focus:ring-error/35',
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: 'bg-warning/10 text-warning ring-warning/20',
    confirmClassName: 'bg-warning text-black hover:bg-warning/90 focus:ring-warning/35',
  },
  info: {
    icon: Info,
    iconClassName: 'bg-info/10 text-info ring-info/20',
    confirmClassName: 'bg-info text-white hover:bg-info/90 focus:ring-info/35',
  },
  success: {
    icon: CheckCircle2,
    iconClassName: 'bg-success/10 text-success ring-success/20',
    confirmClassName: 'bg-success text-white hover:bg-success/90 focus:ring-success/35',
  },
}

export function ConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmationState | PromptState | null>(null)
  const [promptValue, setPromptValue] = useState('')

  const openDialog = useCallback((options: ConfirmOptions | PromptOptions, mode: 'confirm' | 'prompt') => {
    return new Promise<boolean | string | null>((resolve) => {
      if (mode === 'prompt') {
        setPromptValue((options as PromptOptions).defaultValue ?? '')
        setState({ ...options, mode, resolve: resolve as (value: string | null) => void })
        return
      }

      setState({ ...options, mode, resolve: resolve as (value: boolean) => void })
    })
  }, [])

  useEffect(() => {
    requestDialog = openDialog
    return () => {
      if (requestDialog === openDialog) requestDialog = null
    }
  }, [openDialog])

  const confirm = useCallback((options: ConfirmOptions) => {
    return openDialog(options, 'confirm') as Promise<boolean>
  }, [openDialog])

  const prompt = useCallback((options: PromptOptions) => {
    return openDialog(options, 'prompt') as Promise<string | null>
  }, [openDialog])

  const close = useCallback(
    (value: boolean) => {
      if (!state) return
      if (state.mode === 'prompt') {
        state.resolve(value ? promptValue : null)
      } else {
        state.resolve(value)
      }
      setState(null)
    },
    [promptValue, state],
  )

  const contextValue = useMemo(() => ({ confirm, prompt }), [confirm, prompt])
  const variant = state?.variant ?? 'warning'
  const styles = variantStyles[variant]
  const Icon = styles.icon
  const isPrompt = state?.mode === 'prompt'
  const isPromptBlocked = isPrompt && state.required && promptValue.trim().length === 0

  return (
    <ConfirmationContext.Provider value={contextValue}>
      {children}
      {state ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center app-modal-overlay p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            aria-describedby={state.description ? 'confirmation-description' : undefined}
            className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-background-secondary shadow-2xl"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!isPromptBlocked) close(true)
              }}
            >
            <div className="flex items-start gap-4 p-5">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1', styles.iconClassName)}>
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 id="confirmation-title" className="text-base font-semibold text-foreground-base">
                    {state.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="rounded-lg p-1 text-foreground-muted transition-colors hover:bg-background-tertiary hover:text-foreground-base"
                    aria-label="Đóng"
                  >
                    <X size={18} />
                  </button>
                </div>
                {state.description ? (
                  <p id="confirmation-description" className="mt-2 text-sm leading-6 text-foreground-secondary">
                    {state.description}
                  </p>
                ) : null}
                {isPrompt ? (
                  <textarea
                    value={promptValue}
                    onChange={(event) => setPromptValue(event.target.value)}
                    placeholder={state.placeholder}
                    rows={4}
                    className="mt-4 w-full resize-none rounded-lg border border-border bg-background-tertiary px-3 py-2 text-sm text-foreground-base outline-none transition-colors placeholder:text-foreground-muted focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    autoFocus
                  />
                ) : null}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-border bg-background-tertiary/50 px-5 py-4">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-lg border border-border bg-background-secondary px-4 py-2 text-sm font-semibold text-foreground-secondary transition-colors hover:bg-background-tertiary hover:text-foreground-base"
              >
                {state.cancelText ?? 'Hủy'}
              </button>
              <button
                type="submit"
                disabled={isPromptBlocked}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
                  styles.confirmClassName,
                )}
              >
                {variant === 'danger' ? <XCircle size={16} /> : null}
                {state.confirmText ?? 'Xác nhận'}
              </button>
            </div>
            </form>
          </div>
        </div>
      ) : null}
    </ConfirmationContext.Provider>
  )
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext)
  if (!context) {
    throw new Error('useConfirmation must be used inside ConfirmationProvider')
  }
  return context
}

export function confirmDialog(options: DialogInput) {
  if (!requestDialog) return Promise.resolve(false)
  return requestDialog(normalizeDialogInput(options), 'confirm') as Promise<boolean>
}

export function promptDialog(options: PromptInput) {
  if (!requestDialog) return Promise.resolve(null)
  return requestDialog(normalizePromptInput(options), 'prompt') as Promise<string | null>
}
