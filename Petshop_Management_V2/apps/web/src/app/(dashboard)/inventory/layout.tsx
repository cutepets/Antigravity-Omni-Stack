'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { PageContainer } from '@/components/layout/PageLayout'

const TABS = [
  { name: 'Phiếu nhập', href: '/inventory/receipts' },
  { name: 'Tồn kho', href: '/inventory/stock' },
  { name: 'Nhà cung cấp', href: '/inventory/suppliers' },
  { name: 'Kiểm kho', href: '/inventory/counting' },
]

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''

  return (
    <PageContainer maxWidth="full">
      <div className="mb-3">
        <div className="flex -mb-px space-x-5 border-b border-border text-sm font-medium">
          {TABS.map((tab) => {
            const isActive = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`pb-2.5 border-b-2 transition-colors ${isActive
                    ? 'border-primary-500 text-primary-500 font-bold'
                    : 'border-transparent text-foreground-muted hover:text-foreground hover:border-border'
                  }`}
              >
                {tab.name}
              </Link>
            )
          })}
        </div>
      </div>
      {children}
    </PageContainer>
  )
}
