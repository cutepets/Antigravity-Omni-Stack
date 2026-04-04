'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthorization } from '@/hooks/useAuthorization'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { useThemeStore } from '@/stores/theme.store'
import {
  LayoutDashboard, ShoppingCart, PawPrint,
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
      { label: 'Thú cưng', icon: PawPrint, href: '/pets' },
      { label: 'Nhân viên', icon: Briefcase, href: '/staff', adminOnly: true },
      { label: 'Ca làm việc', icon: CalendarIcon, href: '/shifts' },
    ]
  }
]

function CalendarIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24" height="24"
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

// Single easing constant
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

// Fade variants for labels — only opacity, no layout change
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18, ease: EASE } },
  exit:    { opacity: 0, transition: { duration: 0.08, ease: EASE } },
}

export function Sidebar() {
  const pathname = usePathname()
  const { hasRole } = useAuthorization()
  const { user, logout } = useAuthStore()
  const { isSidebarOpen } = useThemeStore()

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
    staleTime: 5 * 60 * 1000
  })

  return (
    <motion.aside
      initial={false}
      animate={{ width: isSidebarOpen ? 250 : 80 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="bg-background-secondary border-r border-border flex flex-col relative overflow-hidden"
      style={{ height: '100vh', flexShrink: 0 }}
    >
      {/* Brand area */}
      <div className="h-16 flex items-center border-b border-border/50 shrink-0 relative w-full">
        <div className={clsx(
          'h-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0 transition-all duration-300 w-8 ml-[24px]',
          config?.shopLogo ? 'bg-transparent' : 'text-white shadow-lg bg-primary-500 shadow-primary-500/20'
        )}>
          {config?.shopLogo
            ? <img src={config.shopLogo} alt="Logo" className="w-full h-full object-contain" />
            : '🐾'
          }
        </div>

        <AnimatePresence mode="wait">
          {isSidebarOpen && (
            <motion.div key="brand" {...fadeIn} className="whitespace-nowrap absolute left-[64px]">
              <p className="text-sm font-bold leading-tight text-foreground-base tracking-tight">
                {config?.shopName || 'PetShop'}
              </p>
              <p className="text-[10px] text-foreground-muted uppercase tracking-wider font-semibold">
                Management
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-6 py-4 w-full">
        {NAV_GROUPS.map((navGroup, groupIndex) => {
          const visibleItems = navGroup.items.filter(item =>
            item.adminOnly ? hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']) : true
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={groupIndex} className="flex flex-col gap-1 w-full">
              {/* Group header */}
              <AnimatePresence mode="wait">
                {navGroup.group && isSidebarOpen && (
                  <motion.p
                    key={`group-${groupIndex}`}
                    {...fadeIn}
                    className="px-5 text-[11px] font-bold text-foreground-muted uppercase tracking-wider mb-1 whitespace-nowrap"
                  >
                    {navGroup.group}
                  </motion.p>
                )}
              </AnimatePresence>

              {visibleItems.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={!isSidebarOpen ? item.label : undefined}
                    className={clsx(
                      'flex items-center rounded-lg text-sm font-medium transition-colors group relative overflow-hidden',
                      'w-[calc(100%-24px)] mx-3 h-11',
                      isActive ? 'text-primary-500 bg-primary-500/10' : 'text-foreground-secondary hover:text-foreground-base hover:bg-white/5'
                    )}
                  >
                    <div className="h-full w-[56px] flex items-center justify-center shrink-0 transition-all duration-300">
                      <Icon
                        size={22}
                        className={clsx(
                          'transition-all duration-300',
                          isSidebarOpen && 'group-hover:scale-110',
                          isActive ? 'opacity-100' : 'opacity-70'
                        )}
                      />
                    </div>
                    <AnimatePresence mode="wait">
                      {isSidebarOpen && (
                        <motion.span key={`label-${item.href}`} {...fadeIn} className="whitespace-nowrap absolute left-[56px]">
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Bottom: Settings & User */}
      <div className="py-4 border-t border-border/50 bg-background-base flex flex-col items-center shrink-0 w-full relative">
        <Link
          href="/settings"
          title={!isSidebarOpen ? 'Cài đặt' : undefined}
          className={clsx(
            'flex items-center rounded-lg text-sm font-medium transition-colors group relative overflow-hidden',
            'w-[calc(100%-24px)] mx-3 h-11 mb-2',
            pathname.startsWith('/settings')
              ? 'text-primary-500 bg-primary-500/10'
              : 'text-foreground-secondary hover:text-foreground-base hover:bg-white/5'
          )}
        >
          <div className="h-full w-[56px] flex items-center justify-center shrink-0 transition-all duration-300">
            <Settings
              size={22}
              className={clsx('transition-all duration-300', pathname.startsWith('/settings') ? 'opacity-100' : 'opacity-70')}
            />
          </div>
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.span key="settings-label" {...fadeIn} className="whitespace-nowrap absolute left-[56px]">
                Cài đặt
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {user && (
          <div className={clsx(
            'flex items-center group relative overflow-hidden rounded-lg transition-colors',
            'w-[calc(100%-24px)] mx-3 h-14 hover:bg-white/5',
          )}>
            <div className="h-full w-[56px] flex items-center justify-center shrink-0 transition-all duration-300 cursor-pointer"
              title={!isSidebarOpen ? 'Đăng xuất' : undefined}
              onClick={!isSidebarOpen ? () => logout() : undefined}
            >
              <div
                className={clsx(
                  'w-8 h-8 rounded-full bg-primary-500/20 text-primary-500 flex flex-col justify-center items-center font-bold text-xs overflow-hidden shrink-0 transition-colors',
                  !isSidebarOpen && 'group-hover:bg-error group-hover:text-white'
                )}
              >
                {!isSidebarOpen ? (
                  <span className="group-hover:hidden block">
                    {user.avatar ? <img src={user.avatar} alt={user.fullName} className="w-full h-full object-cover" /> : user.username?.charAt(0).toUpperCase() || 'A'}
                  </span>
                ) : (
                  user.avatar ? <img src={user.avatar} alt={user.fullName} className="w-full h-full object-cover" /> : user.username?.charAt(0).toUpperCase() || 'A'
                )}
                {!isSidebarOpen && <LogOut size={14} className="hidden group-hover:block" />}
              </div>
            </div>

            {/* User info */}
            <AnimatePresence mode="wait">
              {isSidebarOpen && (
                <motion.div key="user-info" {...fadeIn} className="whitespace-nowrap flex flex-col absolute left-[56px] right-10">
                  <span className="text-xs font-bold text-foreground-base truncate">Quản trị viên</span>
                  <span className="text-[11px] text-foreground-muted truncate">@{user.username}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Logout button */}
            <AnimatePresence mode="wait">
              {isSidebarOpen && (
                <motion.button
                  key="logout-btn"
                  {...fadeIn}
                  onClick={() => logout()}
                  className="text-foreground-muted hover:text-error transition-colors p-1.5 rounded-md hover:bg-error/10 opacity-0 group-hover:opacity-100 absolute right-2 z-10 bg-background-base"
                  title="Đăng xuất"
                >
                  <LogOut size={16} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.aside>
  )
}
