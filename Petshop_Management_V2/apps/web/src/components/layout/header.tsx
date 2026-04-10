'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Settings } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { settingsApi } from '@/lib/api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthStore } from '@/stores/auth.store'
import { useThemeStore } from '@/stores/theme.store'
import { UserSettingsDrawer } from './user-settings-drawer'
import dynamic from 'next/dynamic'
import { useAuthorization } from '@/hooks/useAuthorization'

const CustomerSettingsDrawer = dynamic(
  () => import('@/app/(dashboard)/customers/_components/customer-settings-drawer').then(mod => mod.CustomerSettingsDrawer),
  { ssr: false }
)

const InventorySettingsDrawer = dynamic(
  () => import('@/app/(dashboard)/products/_components/inventory-settings-drawer').then(mod => mod.InventorySettingsDrawer),
  { ssr: false }
)

const CashbookSettingsDrawer = dynamic(
  () => import('@/app/(dashboard)/finance/_components/cashbook-settings-drawer').then(mod => mod.CashbookSettingsDrawer),
  { ssr: false }
)

const PetSettingsModal = dynamic(
  () => import('@/app/(dashboard)/pets/_components/pet-settings-modal').then(mod => mod.PetSettingsModal),
  { ssr: false }
)

function resolveHeaderTitle(pathname: string) {
  if (pathname.startsWith('/finance')) return 'Sổ quỹ'
  if (pathname.startsWith('/products')) return 'Sản phẩm & Kho'
  if (pathname.startsWith('/orders')) return 'Quản lý Đơn hàng'
  if (pathname.startsWith('/customers')) return 'Khách hàng'
  if (pathname.startsWith('/pets')) return 'Thú cưng'
  if (pathname.startsWith('/inventory/stock')) return 'Tồn kho'
  if (pathname.startsWith('/inventory/suppliers')) return 'Nhà cung cấp'
  if (pathname.startsWith('/inventory/receipts')) return 'Phiếu nhập'
  if (pathname.startsWith('/pos')) return 'Tạo đơn hàng'
  if (pathname.startsWith('/dashboard')) return 'Tổng quan'
  return ''
}

export function Header() {
  const { user, allowedBranches, activeBranchId, switchBranch } = useAuthStore()
  const { toggleSidebar } = useThemeStore()
  const { hasPermission, allowedBranchIds } = useAuthorization()
  const router = useRouter()
  const pathname = usePathname()
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showCustomerSettingsDrawer, setShowCustomerSettingsDrawer] = useState(false)
  const [showInventorySettingsDrawer, setShowInventorySettingsDrawer] = useState(false)
  const [showCashbookSettingsDrawer, setShowCashbookSettingsDrawer] = useState(false)
  const [showPetSettings, setShowPetSettings] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pageTitle = resolveHeaderTitle(pathname)
  const canManageCustomerSettings = hasPermission('customer.update')
  const canManagePetSettings = hasPermission('pet.update')
  const canManageCashbookSettings = hasPermission('settings.app.update')
  const canOpenInventorySettings =
    hasPermission('product.read') ||
    hasPermission('product.create') ||
    hasPermission('product.update') ||
    hasPermission('product.delete') ||
    hasPermission('settings.pricing_policy.manage')

  const { data: branches } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: settingsApi.getBranches,
    staleTime: 5 * 60 * 1000,
  })

  const displayBranches = useMemo(() => {
    const sourceBranches = (branches && branches.length > 0 ? branches : allowedBranches) ?? []
    const activeBranches = sourceBranches.filter((branch: any) => branch?.isActive !== false)

    if (hasPermission('branch.access.all')) {
      return activeBranches
    }

    return activeBranches.filter((branch: any) => allowedBranchIds.includes(branch.id))
  }, [allowedBranchIds, allowedBranches, branches, hasPermission])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBranchDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!displayBranches.length) return
    if (activeBranchId && displayBranches.some((branch: any) => branch.id === activeBranchId)) return
    switchBranch(displayBranches[0]!.id)
  }, [activeBranchId, displayBranches, switchBranch])

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel"
      style={{
        height: 64,
        margin: '16px 16px 16px 0',
        borderRadius: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
        position: 'sticky',
        top: 16,
        zIndex: 40,
      }}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-foreground-muted transition-colors hover:bg-background-tertiary hover:text-foreground-base"
        >
          <Menu size={20} />
        </button>
        {pageTitle ? (
          <div className="min-w-0 flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground-base">{pageTitle}</h1>
            {pathname === '/customers' && canManageCustomerSettings && (
              <button 
                onClick={() => setShowCustomerSettingsDrawer(true)} 
                className="p-1.5 rounded-lg text-foreground-muted hover:text-primary-500 hover:bg-background-tertiary transition-colors"
                title="Cài đặt khách hàng"
              >
                <Settings size={18} />
              </button>
            )}
            {pathname.startsWith('/finance') && canManageCashbookSettings && (
              <button 
                onClick={() => setShowCashbookSettingsDrawer(true)} 
                className="p-1.5 rounded-lg text-foreground-muted hover:text-primary-500 hover:bg-background-tertiary transition-colors"
                title="Cài đặt sổ quỹ"
              >
                <Settings size={18} />
              </button>
            )}
            {pathname.startsWith('/pets') && canManagePetSettings && (
              <button 
                onClick={() => setShowPetSettings(true)} 
                className="p-1.5 rounded-lg text-foreground-muted hover:text-primary-500 hover:bg-background-tertiary transition-colors"
                title="Cài đặt Pet"
              >
                <Settings size={18} />
              </button>
            )}
            {pathname === '/products' && canOpenInventorySettings && (
              <button 
                onClick={() => setShowInventorySettingsDrawer(true)} 
                className="p-1.5 rounded-lg text-foreground-muted hover:text-primary-500 hover:bg-background-tertiary transition-colors"
                title="Cấu hình kho"
              >
                <Settings size={18} />
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className="mr-1 h-2 w-2 rounded-full bg-primary-500 shadow-[0_0_8px_var(--color-primary-500)] animate-pulse"></span>

        {user ? (
          <div className="relative mr-2" ref={dropdownRef}>
            <button
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="flex items-center gap-2 rounded-xl border border-border/40 bg-background-tertiary px-3 py-1.5 transition-colors hover:bg-background-tertiary/80"
            >
              <span className="max-w-[150px] whitespace-nowrap truncate text-sm font-semibold text-foreground-base">
                {displayBranches?.find((branch: any) => branch.id === activeBranchId)?.name || 'Chi nhánh hệ thống'}
              </span>
              <span className="ml-1 text-xs text-foreground-muted">▼</span>
            </button>

            <AnimatePresence>
              {showBranchDropdown ? (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="glass-panel absolute right-0 top-full mt-2 w-64 overflow-hidden border border-primary-500/20 shadow-xl"
                  style={{ zIndex: 100 }}
                >
                  <div className="border-b border-border/50 bg-background-tertiary p-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Chi nhánh thao tác</p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-1">
                    {displayBranches?.map((branch: any) => (
                      <button
                        key={branch.id}
                        onClick={() => {
                          switchBranch(branch.id)
                          setShowBranchDropdown(false)
                          toast.success(`Đã chuyển sang chi nhánh: ${branch.name}`)
                          router.refresh()
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                          branch.id === activeBranchId
                            ? 'bg-primary-500/10 text-primary-500'
                            : 'text-foreground-base hover:bg-background-tertiary'
                        }`}
                      >
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate text-sm font-medium">{branch.name}</span>
                          {branch.address ? <span className="truncate text-[11px] text-foreground-muted">{branch.address}</span> : null}
                        </div>
                        {branch.id === activeBranchId ? <span className="ml-2 font-bold text-primary-500">✓</span> : null}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}

        {user ? (
          <button
            onClick={() => setShowDrawer(true)}
            className="flex items-center gap-3 text-left transition-opacity hover:opacity-80"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-foreground-base)',
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                {user.fullName}
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-primary-500)', fontWeight: 600, margin: 0 }}>{user.role}</p>
            </div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              style={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--color-primary-400), var(--color-primary-600))',
                boxShadow: '0 4px 12px color-mix(in srgb, var(--color-primary-500) 40%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: 16,
                overflow: 'hidden',
              }}
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user.fullName[0]?.toUpperCase()
              )}
            </motion.div>
          </button>
        ) : null}
      </div>

      <UserSettingsDrawer isOpen={showDrawer} onClose={() => setShowDrawer(false)} />
      <CustomerSettingsDrawer isOpen={showCustomerSettingsDrawer} onClose={() => setShowCustomerSettingsDrawer(false)} />
      <InventorySettingsDrawer isOpen={showInventorySettingsDrawer} onClose={() => setShowInventorySettingsDrawer(false)} />
      <CashbookSettingsDrawer isOpen={showCashbookSettingsDrawer} onClose={() => setShowCashbookSettingsDrawer(false)} />
      <PetSettingsModal open={showPetSettings} onClose={() => setShowPetSettings(false)} />
    </motion.header>
  )
}
