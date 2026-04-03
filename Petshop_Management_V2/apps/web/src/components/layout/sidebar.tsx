'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthorization } from '@/hooks/useAuthorization'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import {
  LayoutDashboard, ShoppingCart, Activity,
  Settings, Users, Package,
  Scissors, Hotel, ReceiptText, Wallet,
  PieChart, Box, Briefcase, LogOut
} from 'lucide-react'

const NAV_GROUPS = [
  {
    group: '',
    items: [
      { label: 'Tổng quan', icon: LayoutDashboard, href: '/dashboard' },
      { label: 'Tạo đơn hàng', icon: ShoppingCart, href: '/pos' },
    ]
  },
  {
    group: 'HOẠT ĐỘNG',
    items: [
      { label: 'SPA & Grooming', icon: Scissors, href: '/grooming' },
      { label: 'Pet Hotel', icon: Hotel, href: '/hotel' },
      { label: 'Đơn hàng', icon: ReceiptText, href: '/orders' },
      { label: 'Sổ quỹ', icon: Wallet, href: '/finance' },
      { label: 'Báo cáo', icon: PieChart, href: '/reports', adminOnly: true },
    ]
  },
  {
    group: 'QUẢN LÝ',
    items: [
      { label: 'Sản Phẩm', icon: Package, href: '/products' },
      { label: 'Nhập hàng', icon: Box, href: '/inventory', adminOnly: true },
      { label: 'Khách hàng', icon: Users, href: '/customers' },
      { label: 'Thú cưng', icon: Activity, href: '/pets' },
      { label: 'Nhân viên', icon: Briefcase, href: '/staff', adminOnly: true },
      { label: 'Ca làm việc', icon: CalendarIcon, href: '/shifts' },
    ]
  }
]

// Simple SVG icon since lucide-react might not have CalendarIcon imported properly above
function CalendarIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { hasRole } = useAuthorization()
  const { user, logout } = useAuthStore()

  // Fetch shop config
  const { data: config } = useQuery({
    queryKey: ['settings', 'configs'],
    queryFn: async () => {
        try {
            const res = await api.get('/settings/configs')
            return res.data?.data || null
        } catch {
            return null
        }
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  return (
    <motion.aside
      className="bg-background-secondary border-r border-border flex flex-col transition-all duration-300 relative"
      style={{
        width: 250,
        height: '100vh',
        flexShrink: 0,
      }}
    >
      {/* Brand area */}
      <div className="h-16 flex items-center px-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className={clsx(
            "w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0",
            config?.shopLogo ? "bg-transparent" : "text-white shadow-lg bg-primary-500 shadow-primary-500/20"
          )}>
            {config?.shopLogo ? (
                 <img src={config.shopLogo} alt="Logo" className="w-full h-full object-contain" />
            ) : (
                 "🐾"
            )}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold leading-tight text-foreground-base tracking-tight truncate">
                {config?.shopName || 'PetShop'}
            </p>
            <p className="text-[10px] text-foreground-muted uppercase tracking-wider font-semibold truncate">
                Management
            </p>
          </div>
        </div>
      </div>

      {/* Nav Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 flex flex-col gap-6">
        {NAV_GROUPS.map((navGroup, groupIndex) => {
          const visibleItems = navGroup.items.filter(item => {
            if (item.adminOnly) return hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
            return true
          })

          if (visibleItems.length === 0) return null

          return (
            <div key={groupIndex} className="flex flex-col gap-1">
              {navGroup.group && (
                <p className="px-3 text-[11px] font-bold text-foreground-muted uppercase tracking-wider mb-1">
                  {navGroup.group}
                </p>
              )}
              {visibleItems.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative",
                      isActive
                        ? "text-primary-500 bg-primary-500/10"
                        : "text-foreground-secondary hover:text-foreground-base hover:bg-white/5"
                    )}
                  >
                    <Icon size={18} className={clsx("transition-transform group-hover:scale-110", isActive ? "opacity-100" : "opacity-70")} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Bottom Area (Settings & User) */}
      <div className="p-3 border-t border-border/50 bg-background-base">
        <Link
          href="/settings"
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg text-sm font-medium transition-all group",
            pathname.startsWith('/settings')
              ? "text-primary-500 bg-primary-500/10"
              : "text-foreground-secondary hover:text-foreground-base hover:bg-white/5"
          )}
        >
          <Settings size={18} className={pathname.startsWith('/settings') ? "opacity-100" : "opacity-70"} />
          <span>Cài đặt</span>
        </Link>

        {user && (
          <div className="flex items-center justify-between px-2 py-2 mt-2 group relative">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-500/20 text-primary-500 flex flex-col justify-center items-center font-bold text-xs overflow-hidden">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.fullName} className="w-full h-full object-cover" />
                ) : (
                  user.username?.charAt(0).toUpperCase() || 'A'
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground-base">Quản trị viên</span>
                <span className="text-[11px] text-foreground-muted">@{user.username}</span>
              </div>
            </div>
            
            <button 
              onClick={() => logout()}
              className="text-foreground-muted hover:text-error transition-colors p-1.5 rounded-md hover:bg-error/10 opacity-0 group-hover:opacity-100 absolute right-2"
              title="Đăng xuất"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  )
}
