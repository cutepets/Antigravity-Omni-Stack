import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { clsx } from 'clsx'
import { Providers } from '@/components/providers'
import { FaviconUpdater } from '@/components/layout/favicon-updater'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'vietnamese'] })

export const metadata: Metadata = {
  title: {
    template: '%s | Cutepets',
    default: 'Cutepets',
  },
  description: 'Hệ thống quản lý cửa hàng thú cưng — Cutepets Management v2',
  robots: 'noindex',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={clsx(inter.className, "bg-background-base text-foreground-base transition-colors duration-300")}>
        <Providers>
          <FaviconUpdater />
          {children}
        </Providers>
      </body>
    </html>
  )
}
