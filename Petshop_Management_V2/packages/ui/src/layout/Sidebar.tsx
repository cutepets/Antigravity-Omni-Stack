'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { useQuery } from '@tanstack/react-query'
import {
  Briefcase,
  Box,
  Hotel,
  LayoutDashboard,
  LogOut,
  Package,
  PawPrint,
  PieChart,
  ReceiptText,
  Scissors,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthorization, type StaffRole } from '@/hooks/useAuthorization'
import { useAuthStore } from '@/stores/auth.store'
import { useThemeStore } from '@/stores/theme.store'

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  allowedRoles?: StaffRole[]
  anyPermissions?: string[]
}

type NavGroup = {
  group: string
  items: NavItem[]
}

const SETTINGS_PERMISSIONS = [
  'settings.app.read',
  'settings.app.update',
  'settings.audit_log.read',
  'settings.pricing_policy.manage',
  'settings.payment.manage',
  'settings.template.manage',
  'settings.order_flow.manage',
  'settings.return_reason.manage',
  'branch.read',
]

const NAV_GROUPS: NavGroup[] = [
  {
    group: '',
    items: [
      {
        label: 'Tổng quan',
        icon: LayoutDashboard,
        href: '/dashboard',
        anyPermissions: ['dashboard.read'],
      },
      {
        label: 'Tạo đơn hàng',
        icon: ShoppingCart,
        href: '/pos',
        anyPermissions: ['order.create', 'order.read.all', 'order.read.assigned', 'order.pay'],
      },
    ],
  },
  {
    group: 'Hoạt động',
    items: [
      {
        label: 'Spa & Grooming',
        icon: Scissors,
        href: '/grooming',
        anyPermissions: ['grooming.read', 'grooming.create', 'grooming.update'],
      },
      {
        label: 'Pet Hotel',
        icon: Hotel,
        href: '/hotel',
        anyPermissions: ['hotel.read', 'hotel.create', 'hotel.update', 'hotel.checkin', 'hotel.checkout'],
      },
      {
        label: 'Đơn hàng',
        icon: ReceiptText,
        href: '/orders',
        anyPermissions: ['order.read.all', 'order.read.assigned', 'order.create'],
      },
      {
        label: 'Sổ quỹ',
        icon: Wallet,
        href: '/finance',
        anyPermissions: ['report.cashbook'],
      },
      {
        label: 'Báo cáo',
        icon: PieChart,
        href: '/reports',
        anyPermissions: [
          'report.sales',
          'report.inventory',
          'report.purchase',
          'report.profit',
          'report.customer',
          'report.debt',
          'report.cashbook',
        ],
      },
    ],
  },
  {
    group: 'Quản lý',
    items: [
      {
        label: 'Sản phẩm',
        icon: Package,
        href: '/products',
        anyPermissions: ['product.read', 'product.create', 'product.update'],
      },
      {
        label: 'Nhập hàng',
        icon: Box,
        href: '/inventory/receipts',
        anyPermissions: [
          'stock_receipt.read',
          'stock_receipt.create',
          'stock_receipt.update',
          'stock_receipt.pay',
          'stock_receipt.receive',
        ],
      },
      {
        label: 'Khách hàng',
        icon: Users,
        href: '/customers',
        anyPermissions: ['customer.read.all', 'customer.read.assigned', 'customer.create'],
      },
      {
        label: 'Thú cưng',
        icon: PawPrint,
        href: '/pets',
        anyPermissions: ['pet.read', 'pet.create', 'pet.update'],
      },
      {
        label: 'Nhân viên',
        icon: Briefcase,
        href: '/staff',
        anyPermissions: ['staff.read', 'staff.create', 'staff.update', 'role.read'],
      },
      {
        label: 'Ca làm việc',
        icon: CalendarIcon,
        href: '/shifts',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
      },
    ],
  },
]

function CalendarIcon(props: { size?: number; className?: string }) {
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

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.08, ease: EASE } },
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  STAFF: 'Nhân viên',
  VIEWER: 'Chỉ xem',
}

export function Sidebar() {
  const pathname = usePathname()
  const { hasRole, hasAnyPermission, roleCode } = useAuthorization()
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
    staleTime: 5 * 60 * 1000,
  })

  const canAccessItem = (item: NavItem) => {
    const allowByRole = !item.allowedRoles || item.allowedRoles.length === 0 || hasRole(item.allowedRoles)
    const allowByPermission = !item.anyPermissions || item.anyPermissions.length === 0 || hasAnyPermission(item.anyPermissions)
    return allowByRole && allowByPermission
  }

  const canViewSettings = hasAnyPermission(SETTINGS_PERMISSIONS) || hasRole(['SUPER_ADMIN', 'ADMIN'])
  const roleLabel = roleCode ? (ROLE_LABELS[roleCode] ?? roleCode) : 'Người dùng'

  return (
    <motion.aside
      initial={false}
      animate={{ width: isSidebarOpen ? 250 : 80 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="relative flex h-screen flex-col overflow-hidden border-r border-border bg-background-secondary"
      style={{ flexShrink: 0 }}
    >
      <div className="relative flex h-16 w-full shrink-0 items-center border-b border-border/50">
        <div
          className={clsx(
            'ml-[24px] flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-all duration-300',
            config?.shopLogo
              ? 'bg-transparent'
              : 'bg-primary-500 text-white shadow-lg shadow-primary-500/20',
          )}
        >
          {config?.shopLogo ? (
            <img src={config.shopLogo} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            '🐾'
          )}
        </div>

        <AnimatePresence mode="wait">
          {isSidebarOpen ? (
            <motion.div key="brand" {...fadeIn} className="absolute left-[64px] whitespace-nowrap">
              <p className="text-sm font-bold leading-tight tracking-tight text-foreground-base">
                {config?.shopName || 'PetShop'}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                Management
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="no-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto py-4">
        {NAV_GROUPS.map((navGroup, groupIndex) => {
          const visibleItems = navGroup.items.filter(canAccessItem)
          if (visibleItems.length === 0) return null

          return (
            <div key={groupIndex} className="flex w-full flex-col gap-1">
              <AnimatePresence mode="wait">
                {navGroup.group && isSidebarOpen ? (
                  <motion.p
                    key={`group-${groupIndex}`}
                    {...fadeIn}
                    className="mb-1 px-5 text-[11px] font-bold uppercase tracking-wider text-foreground-muted"
                  >
                    {navGroup.group}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              {visibleItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={!isSidebarOpen ? item.label : undefined}
                    className={clsx(
                      'group relative mx-3 flex h-11 w-[calc(100%-24px)] items-center overflow-hidden rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-500/10 text-primary-500'
                        : 'text-foreground-secondary hover:bg-white/5 hover:text-foreground-base',
                    )}
                  >
                    <div className="flex h-full w-[56px] shrink-0 items-center justify-center transition-all duration-300">
                      <Icon
                        size={22}
                        className={clsx(
                          'transition-all duration-300',
                          isSidebarOpen && 'group-hover:scale-110',
                          isActive ? 'opacity-100' : 'opacity-70',
                        )}
                      />
                    </div>

                    <AnimatePresence mode="wait">
                      {isSidebarOpen ? (
                        <motion.span
                          key={`label-${item.href}`}
                          {...fadeIn}
                          className="absolute left-[56px] whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="relative flex w-full shrink-0 flex-col items-center border-t border-border/50 bg-background-base py-4">
        {canViewSettings ? (
          <Link
            href="/settings"
            title={!isSidebarOpen ? 'Cài đặt' : undefined}
            className={clsx(
              'group relative mx-3 mb-2 flex h-11 w-[calc(100%-24px)] items-center overflow-hidden rounded-lg text-sm font-medium transition-colors',
              pathname.startsWith('/settings')
                ? 'bg-primary-500/10 text-primary-500'
                : 'text-foreground-secondary hover:bg-white/5 hover:text-foreground-base',
            )}
          >
            <div className="flex h-full w-[56px] shrink-0 items-center justify-center transition-all duration-300">
              <Settings
                size={22}
                className={clsx(
                  'transition-all duration-300',
                  pathname.startsWith('/settings') ? 'opacity-100' : 'opacity-70',
                )}
              />
            </div>

            <AnimatePresence mode="wait">
              {isSidebarOpen ? (
                <motion.span key="settings-label" {...fadeIn} className="absolute left-[56px] whitespace-nowrap">
                  Cài đặt
                </motion.span>
              ) : null}
            </AnimatePresence>
          </Link>
        ) : null}

        {user ? (
          <div className="group relative mx-3 flex h-14 w-[calc(100%-24px)] items-center overflow-hidden rounded-lg transition-colors hover:bg-white/5">
            <div
              className="flex h-full w-[56px] shrink-0 cursor-pointer items-center justify-center transition-all duration-300"
              title={!isSidebarOpen ? 'Đăng xuất' : undefined}
              onClick={!isSidebarOpen ? () => logout() : undefined}
            >
              <div
                className={clsx(
                  'flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-500/20 text-xs font-bold text-primary-500 transition-colors',
                  !isSidebarOpen && 'group-hover:bg-error group-hover:text-white',
                )}
              >
                {!isSidebarOpen ? (
                  <>
                    <span className="block group-hover:hidden">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.fullName} className="h-full w-full object-cover" />
                      ) : (
                        user.username?.charAt(0).toUpperCase() || 'A'
                      )}
                    </span>
                    <LogOut size={14} className="hidden group-hover:block" />
                  </>
                ) : user.avatar ? (
                  <img src={user.avatar} alt={user.fullName} className="h-full w-full object-cover" />
                ) : (
                  user.username?.charAt(0).toUpperCase() || 'A'
                )}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isSidebarOpen ? (
                <motion.div
                  key="user-info"
                  {...fadeIn}
                  className="absolute left-[56px] right-10 flex flex-col whitespace-nowrap"
                >
                  <span className="truncate text-xs font-bold text-foreground-base">{roleLabel}</span>
                  <span className="truncate text-[11px] text-foreground-muted">@{user.username}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {isSidebarOpen ? (
                <motion.button
                  key="logout-btn"
                  {...fadeIn}
                  onClick={() => logout()}
                  className="absolute right-2 z-10 rounded-md bg-background-base p-1.5 text-foreground-muted opacity-0 transition-colors hover:bg-error/10 hover:text-error group-hover:opacity-100"
                  title="Đăng xuất"
                >
                  <LogOut size={16} />
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </motion.aside>
  )
}
