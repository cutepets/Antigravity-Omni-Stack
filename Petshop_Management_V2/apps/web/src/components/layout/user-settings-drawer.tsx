'use client'
import Image from 'next/image';

import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/stores/auth.store'
import { useTheme } from 'next-themes'
import { X, LogOut, Edit2, Shield, Settings, Monitor, Moon, Sun } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'


interface UserSettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function UserSettingsDrawer({ isOpen, onClose }: UserSettingsDrawerProps) {
  const { user, logout, allowedBranches, activeBranchId } = useAuthStore()
  const { theme, setTheme } = useTheme()

  const currentBranch = allowedBranches.find(b => b.id === activeBranchId)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!user || !mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[360px] glass-panel border-l border-white/10 z-50 overflow-y-auto flex flex-col"
            style={{ boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-2 text-primary-400">
                <Settings className="w-5 h-5" />
                <h2 className="font-semibold text-lg text-foreground-base">Cài đặt tài khoản</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 text-foreground-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 space-y-6">
              {/* Profile Card */}
              <div className="relative p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-xl shadow-[0_4px_12px_color-mix(in_srgb,var(--color-primary-500)_40%,transparent)] overflow-hidden">
                  {user.avatar ? (
                    <Image src={user.avatar} alt={user.fullName} className="w-full h-full object-cover" width={400} height={400} unoptimized />
                  ) : (
                    user.fullName[0]?.toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base text-foreground-base truncate">{user.fullName}</h3>
                  <p className="text-sm text-foreground-muted truncate">@{user.username}</p>
                  <p className="text-xs text-primary-400 mt-0.5">{currentBranch?.name || 'Chưa chọn nhánh'}</p>
                </div>
                <button
                  onClick={() => {
                    onClose()
                    window.location.href = `/staff/${user.username}`
                  }}
                  title="Chỉnh sửa tài khoản"
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-foreground-muted hover:text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Security */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-black/20 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm text-foreground-base">Bảo mật tài khoản</span>
                </div>
                <button className="text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors">
                  Đổi mật khẩu
                </button>
              </div>

              {/* Theme Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-black/20 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm text-foreground-base">Giao diện</span>
                </div>
                <div className="flex items-center bg-background rounded-full p-1 border border-white/10">
                  <button
                    onClick={() => setTheme('light')}
                    className={`p-1.5 rounded-full flex items-center justify-center transition-all ${theme === 'light' ? 'bg-white/10 text-primary-400' : 'text-foreground-muted hover:text-white'}`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`p-1.5 rounded-full flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-white/10 text-primary-400' : 'text-foreground-muted hover:text-white'}`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* System Info */}
              <div className="p-4 rounded-2xl bg-black/20 border border-white/5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Monitor className="w-4 h-4 text-primary-400" />
                  <span className="font-medium text-sm text-foreground-base">Thông tin hệ thống</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-foreground-muted">Phiên bản:</span>
                  <span className="text-foreground-base font-medium">1.0.0-beta</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-foreground-muted">Chi nhánh:</span>
                  <span className="text-foreground-base font-medium">{currentBranch?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-foreground-muted">Vai trò:</span>
                  <span className="text-foreground-base font-medium">{user.role}</span>
                </div>
              </div>
            </div>

            {/* Footer / Logout */}
            <div className="p-5 border-t border-white/5 mt-auto bg-black/20">
              <button
                onClick={async () => {
                  onClose()
                  await logout()
                  window.location.href = '/login'
                }}
                className="w-full py-3 rounded-xl border border-error/30 text-error hover:bg-error/10 hover:border-error/50 transition-all flex items-center justify-center gap-2 font-medium"
              >
                <LogOut className="w-4 h-4" />
                Đăng xuất
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}