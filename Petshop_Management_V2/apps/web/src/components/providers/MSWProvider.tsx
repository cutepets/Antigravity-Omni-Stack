'use client'

import { useEffect } from 'react'

/**
 * MSWProvider — khởi động Mock Service Worker trong môi trường development.
 *
 * Chỉ được mount khi NEXT_PUBLIC_MOCK_API=true và process.env.NODE_ENV === 'development'.
 * Worker script phải đã có tại /public/mockServiceWorker.js (do `msw init` tạo ra).
 */
export function MSWProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'development' ||
      process.env.NEXT_PUBLIC_MOCK_API !== 'true'
    ) {
      return
    }

    // Lazy-load để không đóng gói vào production bundle
    import('@/mocks/browser').then(({ worker }) => {
      worker.start({
        onUnhandledRequest: 'bypass', // forward unmatched requests to real server
        quiet: false,
      }).then(() => {
        console.info('[MSW] Mock Service Worker started ✓')
      })

      return () => worker.stop()
    })
  }, [])

  return <>{children}</>
}
