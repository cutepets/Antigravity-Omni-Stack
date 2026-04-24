'use client'

import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Edit2, Link2, LogOut, Monitor, Moon, Settings, Shield, Sun, X } from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { API_URL } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'

interface UserSettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
}

type GoogleAuthStatus = {
  enabled: boolean
  configured: boolean
  allowedDomain: string | null
}

export function UserSettingsDrawer({ isOpen, onClose }: UserSettingsDrawerProps) {
  const { user, logout, allowedBranches, activeBranchId, fetchMe } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const currentBranch = allowedBranches.find((branch) => branch.id === activeBranchId)
  const [mounted, setMounted] = useState(false)
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false)

  const googleStatusQuery = useQuery({
    queryKey: ['auth', 'google-status', 'drawer'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/auth/google/status`, {
        credentials: 'include',
      })
      const payload = await response.json()
      return (payload?.data ?? {
        enabled: false,
        configured: false,
        allowedDomain: null,
      }) as GoogleAuthStatus
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: mounted,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    void fetchMe()
  }, [fetchMe, isOpen])

  useEffect(() => {
    if (!mounted) return

    const currentUrl = new URL(window.location.href)
    const googleLinkStatus = currentUrl.searchParams.get('google_link')
    if (!googleLinkStatus) return

    const message = currentUrl.searchParams.get('message')

    if (googleLinkStatus === 'success') {
      void fetchMe()
      toast.success('Liên kết Google thành công')
    } else {
      toast.error(message || 'Liên kết Google thất bại')
    }

    currentUrl.searchParams.delete('google_link')
    currentUrl.searchParams.delete('message')
    window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
  }, [fetchMe, mounted])

  if (!user || !mounted) return null

  const googleStatus = googleStatusQuery.data
  const canUseGoogleLink = Boolean(googleStatus?.enabled && googleStatus?.configured)

  const handleGoogleLink = () => {
    const current = new URL(window.location.href)
    current.searchParams.delete('google_link')
    current.searchParams.delete('message')
    const redirect = `${current.pathname}${current.search}` || '/dashboard'

    setIsConnectingGoogle(true)
    window.location.href = `${API_URL}/api/auth/google/link?redirect=${encodeURIComponent(redirect)}`
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 z-50 flex h-full w-[360px] flex-col overflow-y-auto border-l border-white/10 glass-panel"
            style={{ boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4)' }}
          >
            <div className="flex items-center justify-between border-b border-white/5 p-5">
              <div className="flex items-center gap-2 text-primary-400">
                <Settings className="h-5 w-5" />
                <h2 className="text-lg font-semibold text-foreground-base">Cài đặt tài khoản</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-foreground-muted transition-colors hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 p-5">
              <div className="group relative flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 text-xl font-bold text-white shadow-[0_4px_12px_color-mix(in_srgb,var(--color-primary-500)_40%,transparent)]">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.fullName}
                      className="h-full w-full object-cover"
                      width={400}
                      height={400}
                      unoptimized
                    />
                  ) : (
                    user.fullName[0]?.toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-foreground-base">{user.fullName}</h3>
                  <p className="truncate text-sm text-foreground-muted">@{user.username}</p>
                  <p className="mt-0.5 text-xs text-primary-400">{currentBranch?.name || 'Chưa chọn nhánh'}</p>
                </div>
                <button
                  onClick={() => {
                    onClose()
                    window.location.href = `/staff/${user.username}`
                  }}
                  title="Chỉnh sửa tài khoản"
                  className="absolute right-4 top-4 rounded-lg p-1.5 text-foreground-muted opacity-0 transition-all hover:bg-white/10 hover:text-white group-hover:opacity-100"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-orange-500/10 p-2 text-orange-400">
                    <Shield className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-foreground-base">Bảo mật tài khoản</span>
                </div>
                <button className="text-sm font-medium text-primary-400 transition-colors hover:text-primary-300">
                  Đổi mật khẩu
                </button>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400">
                      <Link2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground-base">Google login</p>
                      <p className="text-xs text-foreground-muted">
                        {user.googleLinked
                          ? user.googleEmail || 'Tài khoản Google đã được liên kết'
                          : 'Liên kết để đăng nhập bằng Google ở những lần sau'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${user.googleLinked
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-white/10 text-foreground-muted'
                      }`}
                  >
                    {user.googleLinked ? 'Đã liên kết' : 'Chưa liên kết'}
                  </span>
                </div>

                {googleStatusQuery.isLoading ? (
                  <div className="rounded-xl border border-border/60 bg-background-base px-4 py-3 text-sm text-foreground-muted">
                    Đang tải trạng thái Google...
                  </div>
                ) : canUseGoogleLink ? (
                  <>
                    {googleStatus?.allowedDomain ? (
                      <p className="text-xs text-foreground-muted">
                        Domain được phép: <span className="font-medium text-foreground-base">{googleStatus.allowedDomain}</span>
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleGoogleLink}
                      disabled={isConnectingGoogle}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background-base px-4 py-3 text-sm font-semibold text-foreground-base transition-colors hover:bg-background-elevated disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="text-base">G</span>
                      {isConnectingGoogle
                        ? 'Đang chuyển sang Google...'
                        : user.googleLinked
                          ? 'Kết nối lại Google'
                          : 'Kết nối Google'}
                    </button>
                  </>
                ) : (
                  <div className="rounded-xl border border-border/60 bg-background-base px-4 py-3 text-sm text-foreground-muted">
                    Google login hiện chưa sẵn sàng. Liên hệ admin để hoàn tất cấu hình OAuth.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
                    <Monitor className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-foreground-base">Giao diện</span>
                </div>
                <div className="flex items-center rounded-full border border-white/10 bg-background p-1">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center rounded-full p-1.5 transition-all ${theme === 'light' ? 'bg-white/10 text-primary-400' : 'text-foreground-muted hover:text-white'
                      }`}
                  >
                    <Sun className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center rounded-full p-1.5 transition-all ${theme === 'dark' ? 'bg-white/10 text-primary-400' : 'text-foreground-muted hover:text-white'
                      }`}
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-primary-400" />
                  <span className="text-sm font-medium text-foreground-base">Thông tin hệ thống</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-foreground-muted">Phien ban:</span>
                  <span className="font-medium text-foreground-base">1.0.0-beta</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-foreground-muted">Chi nhanh:</span>
                  <span className="font-medium text-foreground-base">{currentBranch?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-foreground-muted">Vai trò:</span>
                  <span className="font-medium text-foreground-base">{user.role}</span>
                </div>
              </div>
            </div>

            <div className="mt-auto border-t border-white/5 bg-black/20 p-5">
              <button
                onClick={async () => {
                  onClose()
                  await logout()
                  window.location.href = '/login'
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-error/30 py-3 font-medium text-error transition-all hover:border-error/50 hover:bg-error/10"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
