'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import { UserSettingsDrawer } from './user-settings-drawer'

export function Header() {
  const { user, allowedBranches, activeBranchId, switchBranch } = useAuthStore()
  const router = useRouter()
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBranchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      {/* Left */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-foreground-muted font-medium">
          <span>Giao diện Liquid Glass Beta</span>
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shadow-[0_0_8px_var(--color-primary-500)]"></span>
        </div>

        {/* Branch Context Dropdown */}
        {user && (
          <div className="relative ml-4" ref={dropdownRef}>
            <button
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background-tertiary border border-border/40 hover:bg-background-tertiary/80 transition-colors"
            >
              <span className="text-sm font-semibold whitespace-nowrap max-w-[150px] truncate text-foreground-base">
                {allowedBranches?.find(b => b.id === activeBranchId)?.name || 'Chi nhánh hệ thống'}
              </span>
              <span className="text-xs text-foreground-muted ml-1">▾</span>
            </button>

            <AnimatePresence>
              {showBranchDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-64 glass-panel border border-primary-500/20 shadow-xl overflow-hidden"
                  style={{ zIndex: 100 }}
                >
                  <div className="p-2 border-b border-border/50 bg-background-tertiary">
                    <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                      Chi nhánh thao tác
                    </p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-1">
                    {allowedBranches?.map(branch => (
                      <button
                        key={branch.id}
                        onClick={() => {
                          switchBranch(branch.id)
                          setShowBranchDropdown(false)
                          toast.success(`Đã chuyển sang chi nhánh: ${branch.name}`)
                          router.refresh() // Reload data via next router
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${
                          branch.id === activeBranchId 
                            ? 'bg-primary-500/10 text-primary-500' 
                            : 'hover:bg-background-tertiary text-foreground-base'
                        }`}
                      >
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm font-medium truncate">{branch.name}</span>
                          {branch.address && (
                            <span className="text-[11px] text-foreground-muted truncate">{branch.address}</span>
                          )}
                        </div>
                        {branch.id === activeBranchId && (
                          <span className="text-primary-500 font-bold ml-2">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Right — User info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {user && (
          <button 
            onClick={() => setShowDrawer(true)}
            className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
            style={{ 
              background: 'transparent', 
              border: 'none', 
              outline: 'none', 
              cursor: 'pointer' 
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-foreground-base)', lineHeight: 1.2, margin: 0 }}>
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
                overflow: 'hidden'
              }}
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user.fullName[0]?.toUpperCase()
              )}
            </motion.div>
          </button>
        )}
      </div>

      <UserSettingsDrawer 
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
      />
    </motion.header>
  )
}
