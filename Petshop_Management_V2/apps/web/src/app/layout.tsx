import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { clsx } from 'clsx'
import { Providers } from '@/components/providers'
import { FaviconUpdater } from '@/components/layout/favicon-updater'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'vietnamese'] })
const FALLBACK_SHOP_NAME = 'PetShop'

type PublicBrandingResponse = {
  success?: boolean
  data?: {
    shopName?: string | null
  } | null
}

async function getPublicShopName() {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/+$/, '')
  if (!apiUrl) return FALLBACK_SHOP_NAME

  try {
    const response = await fetch(`${apiUrl}/api/public/branding`, {
      next: { revalidate: 300 },
    })
    if (!response.ok) return FALLBACK_SHOP_NAME

    const payload = (await response.json()) as PublicBrandingResponse
    return payload.data?.shopName?.trim() || FALLBACK_SHOP_NAME
  } catch {
    return FALLBACK_SHOP_NAME
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const shopName = await getPublicShopName()
  const description = `Hệ thống quản lý cửa hàng — ${shopName} Management`

  return {
    title: {
      template: `%s | ${shopName}`,
      default: shopName,
    },
    description,
    openGraph: {
      title: shopName,
      description,
      siteName: shopName,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: shopName,
      description,
    },
    robots: 'noindex',
  }
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
