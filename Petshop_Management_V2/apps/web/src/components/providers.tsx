'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'next-themes'
import { ThemeInjector } from './theme-injector'
import { MSWProvider } from './providers/MSWProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <MSWProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeInjector />
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-right"
          richColors
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
