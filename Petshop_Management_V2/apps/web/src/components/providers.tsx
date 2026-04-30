'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'next-themes'
import { ThemeInjector } from './theme-injector'
import { MSWProvider } from './providers/MSWProvider'
import { AnimationProvider } from './providers/AnimationProvider'
import { AuthBootstrap } from './auth-bootstrap'
import { ConfirmationProvider } from './ui/confirmation-provider'

function isRecoverableAssetLoadError(reason: unknown) {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : String((reason as { message?: unknown })?.message ?? reason ?? '')

  return [
    'ChunkLoadError',
    'Loading chunk',
    'failed to fetch dynamically imported module',
    'Importing a module script failed',
    'CSS_CHUNK_LOAD_FAILED',
    'Failed to load script',
  ].some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()))
}

function RecoverFromStaleBuild() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined') return

    const reloadKey = 'petshop-stale-build-reloaded'
    const reloadOnce = (reason: unknown) => {
      if (!isRecoverableAssetLoadError(reason)) return
      if (window.sessionStorage.getItem(reloadKey) === '1') return

      window.sessionStorage.setItem(reloadKey, '1')
      window.location.reload()
    }

    const handleError = (event: ErrorEvent) => reloadOnce(event.error ?? event.message)
    const handleRejection = (event: PromiseRejectionEvent) => reloadOnce(event.reason)
    const clearReloadMarker = window.setTimeout(() => {
      window.sessionStorage.removeItem(reloadKey)
    }, 30_000)

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.clearTimeout(clearReloadMarker)
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0, // ERP: Luôn coi data là cũ để tự động fetch mới
            retry: 1,
            refetchOnWindowFocus: true, // Khi code xong quay lại tab Chrome sẽ tự load DB mới
          },
        },
      }),
  )

  return (
    <MSWProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeInjector />
      <AnimationProvider />
      <RecoverFromStaleBuild />
      <QueryClientProvider client={queryClient}>
        <ConfirmationProvider>
          <AuthBootstrap />
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              duration: 3000,
            }}
          />
        </ConfirmationProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
      </ThemeProvider>
    </MSWProvider>
  )
}
