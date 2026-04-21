'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'next-themes'
import { ThemeInjector } from './theme-injector'
import { MSWProvider } from './providers/MSWProvider'
import { AnimationProvider } from './providers/AnimationProvider'
import { AuthBootstrap } from './auth-bootstrap'

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
      <QueryClientProvider client={queryClient}>
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
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
      </ThemeProvider>
    </MSWProvider>
  )
}
