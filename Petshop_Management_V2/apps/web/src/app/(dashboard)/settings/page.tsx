'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRightLeft,
  Bell,
  Check,
  CheckCircle2,
  Database,
  History,
  MapPin,
  Moon,
  Package,
  Palette,
  Printer,
  Save,
  Settings,
  Store,
  Zap,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuthorization } from '@/hooks/useAuthorization'
import { cn } from '@/lib/utils'
import { ThemeTogglePremium } from '@/components/ui/dark-mode-button'
import { useThemeStore } from '@/stores/theme.store'
import { useAnimationStore, type AnimConfig } from '@/stores/animation.store'
import { TabBackup } from './components/TabBackup'
import { TabPayments } from './components/TabPayments'
import { TabBranches } from './components/TabBranches'
import { TabGeneral } from './components/TabGeneral'
import { TabHistory } from './components/TabHistory'
import { TabNotifications } from './components/TabNotifications'
import { TabPrintTemplates } from './components/TabPrintTemplates'
import { TabModules } from './components/TabModules'

type SettingsTabConfig = {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  anyPermissions?: string[]
  superAdminOnly?: boolean
}

const THEME_COLORS = [
  { label: 'Xanh la (Mac dinh)', value: '#10b981' },
  { label: 'Xanh duong', value: '#3b82f6' },
  { label: 'Tim', value: '#8b5cf6' },
  { label: 'Hong', value: '#ec4899' },
  { label: 'Cam', value: '#f97316' },
  { label: 'Do', value: '#ef4444' },
  { label: 'Vang', value: '#eab308' },
  { label: 'Xanh cyan', value: '#06b6d4' },
]

const SETTINGS_PAGE_PERMISSIONS = [
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

const SETTINGS_TABS: SettingsTabConfig[] = [
  {
    id: 'general',
    label: 'Cua hang',
    icon: Store,
    anyPermissions: ['settings.app.read', 'settings.app.update'],
  },
  {
    id: 'branches',
    label: 'Chi nhanh',
    icon: MapPin,
    anyPermissions: ['branch.read', 'branch.create', 'branch.update', 'branch.delete'],
  },
  {
    id: 'payments',
    label: 'Thanh toan',
    icon: ArrowRightLeft,
    anyPermissions: ['settings.payment.manage'],
  },
  {
    id: 'print-templates',
    label: 'Mau in',
    icon: Printer,
    anyPermissions: ['settings.template.manage'],
  },
  {
    id: 'backup',
    label: 'Backup',
    icon: Database,
    superAdminOnly: true,
  },
  { id: 'theme', label: 'Giao dien', icon: Palette },
  {
    id: 'notifications',
    label: 'Thong bao',
    icon: Bell,
    anyPermissions: ['settings.app.read', 'settings.app.update'],
  },
  {
    id: 'history',
    label: 'Lich su thao tac',
    icon: History,
    anyPermissions: ['settings.audit_log.read'],
  },
  { id: 'modules', label: 'Module', icon: Package, superAdminOnly: true },
]

export default function SettingsPage() {
  const router = useRouter()
  const { hasAnyPermission, hasRole, isLoading } = useAuthorization()
  const [activeTab, setActiveTab] = useState<string>('general')
  const pageTransition = useAnimationStore((state) => state.pageTransition)

  const canAccessSettings =
    hasAnyPermission(SETTINGS_PAGE_PERMISSIONS) ||
    hasRole(['SUPER_ADMIN', 'ADMIN'])

  const visibleTabs = useMemo(
    () =>
      SETTINGS_TABS.filter((tab) => {
        if (tab.superAdminOnly) return hasRole(['SUPER_ADMIN'])
        if (!tab.anyPermissions || tab.anyPermissions.length === 0) return true
        return hasAnyPermission(tab.anyPermissions)
      }),
    [hasAnyPermission, hasRole],
  )

  useEffect(() => {
    if (isLoading) return

    if (!canAccessSettings) {
      router.replace('/dashboard')
      return
    }

    if (visibleTabs.length > 0 && !visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id)
    }
  }, [activeTab, canAccessSettings, isLoading, router, visibleTabs])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Dang kiem tra quyen truy cap...
      </div>
    )
  }

  if (!canAccessSettings) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Dang chuyen huong...
      </div>
    )
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'payments':
        return <TabPayments />
      case 'general':
        return <TabGeneral />
      case 'branches':
        return <TabBranches />
      case 'print-templates':
        return <TabPrintTemplates />
      case 'backup':
        return <TabBackup />
      case 'notifications':
        return <TabNotifications />
      case 'history':
        return <TabHistory />
      case 'modules':
        return <TabModules />
      case 'theme':
      default:
        return <ThemeTabComponent />
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 py-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl border border-primary-500/20 bg-primary-500/10 p-2.5 text-primary-500">
          <Settings size={26} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground-base">
            Cai dat he thong
          </h1>
          <p className="mt-0.5 text-sm text-foreground-secondary">
            Quan ly cau hinh chung, giao dien va thong bao he thong
          </p>
        </div>
      </div>

      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="w-full shrink-0 space-y-6 lg:sticky lg:top-[100px] lg:w-[280px]">
          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/50 bg-background-secondary p-2 shadow-sm">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
                      : 'bg-transparent text-foreground-secondary hover:bg-black/5 hover:text-foreground-base',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isActive ? 'text-white' : 'opacity-70'} />
                    <span>{tab.label}</span>
                  </div>
                  {isActive ? (
                    <motion.div
                      layoutId="active-indicator"
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-white"
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="relative min-h-[500px] w-full">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{
                duration:
                  (pageTransition?.enabled ? (pageTransition.durationMs ?? 200) : 0) / 1000,
              }}
            >
              {renderActiveTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function ThemeTabComponent() {
  const { theme } = useTheme()
  const primaryColor = useThemeStore((state) => state.primaryColor)
  const setPrimaryColor = useThemeStore((state) => state.setPrimaryColor)
  const [savedConfig, setSavedConfig] = useState(false)

  const { pageTransition, modalAnimation, hoverEffect, themeTransition, setAnim } =
    useAnimationStore()

  const handleSave = () => {
    setSavedConfig(true)
    setTimeout(() => setSavedConfig(false), 2000)
  }

  return (
    <div className="relative z-0 h-full w-full">
      <div className="relative h-full w-full overflow-hidden rounded-3xl border border-border/60 bg-background-secondary p-8 shadow-sm transition-all duration-700">
        <div className="mb-8 flex items-center justify-between border-b border-border/50 pb-6">
          <div className="flex items-center gap-3">
            <div className="text-primary-500">
              <Palette size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground-base">
                Giao dien va trai nghiem
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                Ca nhan hoa mau sac va che do hien thi he thong.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-10 px-2">
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground-base">
              <Moon size={16} className="text-primary-500" />
              Che do nen
            </h3>
            <div className="flex items-center gap-6 rounded-2xl border border-border/40 bg-black/5 p-5">
              <ThemeTogglePremium />
              <div>
                <p className="flex items-center gap-2 text-sm font-bold tracking-wide text-foreground-base">
                  {theme === 'dark' ? 'Trang thai toi' : 'Trang thai sang'}
                </p>
                <p className="mt-1 text-sm text-foreground-muted">
                  {theme === 'dark'
                    ? 'Giam choi mat khi lam viec buoi toi'
                    : 'Bo cuc sang ro de quan sat nhanh'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground-base">
              <Palette size={16} className="text-primary-500" />
              Mau chu dao
            </h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {THEME_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setPrimaryColor(color.value)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3.5 text-sm font-medium transition-all',
                    primaryColor === color.value
                      ? 'border-primary-500 bg-primary-500/10 shadow-sm'
                      : 'border-border/50 bg-background-elevated hover:bg-black/5',
                  )}
                >
                  <div
                    className="h-5 w-5 rounded-full border border-black/10 shadow-inner"
                    style={{ background: color.value }}
                  />
                  <span className="truncate text-[13px] text-foreground-base">
                    {color.label}
                  </span>
                  {primaryColor === color.value ? (
                    <Check size={16} className="ml-auto text-primary-500" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground-base">
              <Zap size={16} className="text-primary-500" />
              Hieu ung va hoat anh
            </h3>
            <p className="mb-4 text-xs text-foreground-muted">
              Bat tat tung hieu ung. Khi bat, nhap so mili giay de dieu chinh toc do.
            </p>

            <div className="space-y-3">
              <AnimRow
                label="Chuyen trang / tab"
                description="Fade va slide khi doi noi dung trang va tab"
                config={pageTransition}
                onChange={(patch: Partial<AnimConfig>) => setAnim('pageTransition', patch)}
              />
              <AnimRow
                label="Mo modal / drawer"
                description="Zoom va slide khi mo hop thoai hoac ngan keo"
                config={modalAnimation}
                onChange={(patch: Partial<AnimConfig>) => setAnim('modalAnimation', patch)}
              />
              <AnimRow
                label="Hover va micro-animation"
                description="Transition tren nut va hang du lieu"
                config={hoverEffect}
                onChange={(patch: Partial<AnimConfig>) => setAnim('hoverEffect', patch)}
              />
              <AnimRow
                label="Chuyen sang / toi"
                description="Transition body background khi doi che do"
                config={themeTransition}
                onChange={(patch: Partial<AnimConfig>) => setAnim('themeTransition', patch)}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end border-t border-border/30 pt-6">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90"
              style={{ background: primaryColor }}
            >
              {savedConfig ? (
                <>
                  <CheckCircle2 size={18} />
                  Da luu thanh cong
                </>
              ) : (
                <>
                  <Save size={18} />
                  Luu cai dat
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnimRow({
  label,
  description,
  config,
  onChange,
}: {
  label: string
  description: string
  config: AnimConfig
  onChange: (patch: Partial<AnimConfig>) => void
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-black/5 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground-base">{label}</div>
        <div className="mt-1 text-xs text-foreground-muted">{description}</div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange({ enabled: !config.enabled })}
          className={cn(
            'inline-flex h-9 items-center rounded-xl px-4 text-xs font-semibold transition-colors',
            config.enabled
              ? 'bg-primary-500/15 text-primary-500'
              : 'bg-background-elevated text-foreground-muted',
          )}
        >
          {config.enabled ? 'Bat' : 'Tat'}
        </button>
        <label className="flex items-center gap-2 text-xs text-foreground-muted">
          <span>ms</span>
          <input
            type="number"
            min={0}
            step={50}
            value={config.durationMs}
            onChange={(event) =>
              onChange({ durationMs: Number(event.target.value) || 0 })
            }
            disabled={!config.enabled}
            className="h-9 w-24 rounded-xl border border-border/50 bg-background-secondary px-3 text-sm text-foreground-base outline-none disabled:opacity-50"
          />
        </label>
      </div>
    </div>
  )
}
