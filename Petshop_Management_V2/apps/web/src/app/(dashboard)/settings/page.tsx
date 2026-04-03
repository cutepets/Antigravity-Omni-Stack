'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/stores/auth.store'
import {
    Store, MapPin, Palette, Bell, History, Search, Settings, ShieldAlert
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Import Tab Components
import { TabGeneral } from './components/TabGeneral'
import { TabBranches } from './components/TabBranches'
import { TabNotifications } from './components/TabNotifications'
import { TabHistory } from './components/TabHistory'
import { TabRoles } from './components/TabRoles'

// To keep the existing Theme configurations
import { useTheme } from 'next-themes'
import { useThemeStore } from '@/stores/theme.store'
import { ThemeTogglePremium } from '@/components/ui/dark-mode-button'
import { Check, Moon, Save, CheckCircle2 } from 'lucide-react'

// Constants for Theme Tab
const THEME_COLORS = [
    { label: 'Xanh lá (Mặc định)', value: '#10b981' },
    { label: 'Xanh dương',          value: '#3b82f6' },
    { label: 'Tím',                  value: '#8b5cf6' },
    { label: 'Hồng',                 value: '#ec4899' },
    { label: 'Cam',                  value: '#f97316' },
    { label: 'Đỏ',                   value: '#ef4444' },
    { label: 'Vàng',                 value: '#eab308' },
    { label: 'Xanh cyan',            value: '#06b6d4' },
]

export default function SettingsPage() {
    const { user } = useAuthStore()
    
    // Use standard state instead of nuqs to avoid new dependencies
    const [activeTab, setActiveTab] = useState<string>('general')

    const tabs = [
        { id: 'general', label: 'Cửa hàng', icon: Store },
        { id: 'branches', label: 'Chi nhánh', icon: MapPin },
        { id: 'theme', label: 'Giao diện', icon: Palette },
        { id: 'notifications', label: 'Thông báo', icon: Bell },
        { id: 'history', label: 'Lịch sử thao tác', icon: History },
        // Lời đề xuất thứ 2: Roles (Phân quyền)
        { id: 'roles', label: 'Phân quyền', icon: ShieldAlert },
    ]

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1400px] mx-auto py-8">
            {/* Header Area */}
            <div className="flex items-center gap-3 mb-4">
                <div className="text-primary-500 bg-primary-500/10 p-2.5 rounded-xl border border-primary-500/20">
                    <Settings size={26} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground-base tracking-tight">
                        Cài đặt Hệ thống
                    </h1>
                    <p className="text-foreground-secondary text-sm mt-0.5">
                        Quản lý cấu hình chung, thông báo và nhân sự
                    </p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* ── Left Sidebar Sub-navigation ── */}
                <div className="w-full lg:w-[280px] shrink-0 space-y-6 lg:sticky lg:top-[100px]">
                    <div className="flex flex-col gap-1.5 p-2 bg-background-secondary border border-border/50 rounded-2xl shadow-sm">
                        {tabs.map(tab => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm",
                                        isActive
                                            ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
                                            : "bg-transparent text-foreground-secondary hover:text-foreground-base hover:bg-black/5"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon size={18} className={isActive ? "text-white" : "opacity-70"} />
                                        <span>{tab.label}</span>
                                    </div>
                                    {isActive && (
                                        <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 bg-white rounded-full ml-auto" />
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Khung User Profile */}
                    <div className="p-5 rounded-2xl bg-black/5 border border-border/50 flex flex-col items-center justify-center text-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-primary-500/10 mb-1 flex items-center justify-center text-primary-500/80 shadow-inner text-xl font-bold border border-primary-500/20">
                            {user?.username?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div>
                            <p className="font-bold text-foreground-base leading-tight">Quản trị viên</p>
                            <p className="text-xs text-foreground-muted mt-0.5">@{user?.username || 'admin'}</p>
                        </div>
                        <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded-md mt-2 flex items-center gap-1 uppercase tracking-widest border border-amber-500/20">
                            👑 CHỦ CỬA HÀNG
                        </span>
                    </div>
                </div>

                {/* ── Right Content Area ── */}
                <div className="w-full relative min-h-[500px]">
                    <AnimatePresence mode="popLayout">
                        {activeTab === 'general' && (
                            <motion.div key="general" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                <TabGeneral />
                            </motion.div>
                        )}
                        {activeTab === 'branches' && (
                            <motion.div key="branches" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                <TabBranches />
                            </motion.div>
                        )}
                        {activeTab === 'notifications' && (
                            <motion.div key="notifications" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                <TabNotifications />
                            </motion.div>
                        )}
                        {activeTab === 'history' && (
                            <motion.div key="history" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                <TabHistory />
                            </motion.div>
                        )}
                        {activeTab === 'roles' && (
                            <motion.div key="roles" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                <TabRoles />
                            </motion.div>
                        )}
                        {activeTab === 'theme' && (
                            <motion.div key="theme" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                <ThemeTabComponent />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

// Giữ lại Component Theme cũ thay vì xóa đi, chúng ta biến nó thành 1 component nội bộ
function ThemeTabComponent() {
    const { theme } = useTheme()
    const primaryColor = useThemeStore(s => s.primaryColor)
    const setPrimaryColor = useThemeStore(s => s.setPrimaryColor)
    const [savedConfig, setSavedConfig] = useState(false)
    const [isLiquidGlass, setIsLiquidGlass] = useState(false)

    const handleSave = () => {
        setSavedConfig(true)
        setTimeout(() => setSavedConfig(false), 2000)
    }

    return (
        <div className="relative w-full z-0 h-full">
            {isLiquidGlass && (
                <div className="absolute inset-0 pointer-events-none overflow-visible -z-10">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }} 
                        animate={{ opacity: 0.6, scale: 1, x: [0, 40, 0], y: [0, 30, 0] }} 
                        exit={{ opacity: 0 }}
                        className="absolute -top-10 -left-10 w-80 h-80 rounded-full mix-blend-multiply dark:mix-blend-color-dodge filter blur-[90px]"
                        style={{ backgroundColor: primaryColor }}
                        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    />
                </div>
            )}
            <div
                className={cn(
                    "rounded-3xl p-8 relative overflow-hidden transition-all duration-700 w-full h-full",
                    isLiquidGlass 
                        ? "bg-white/40 dark:bg-black/40 backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]" 
                        : "border border-border/60 bg-background-secondary shadow-sm"
                )}
            >
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="text-primary-500">
                            <Palette size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground-base">Giao Diện & Trải Nghiệm</h2>
                            <p className="text-sm text-foreground-muted mt-1">Cá nhân hóa màu sắc và chế độ hiển thị hệ thống.</p>
                        </div>
                    </div>
                    
                    {/* Liquid Glass Switch */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-black/5 dark:bg-black/20 rounded-xl border border-border/50">
                        <span className="text-sm font-medium">Liquid Glass (Beta)</span>
                        <button
                            onClick={() => setIsLiquidGlass(!isLiquidGlass)}
                            className={cn(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                isLiquidGlass ? "bg-primary-500" : "bg-neutral-300 dark:bg-neutral-600"
                            )}
                        >
                            <span
                                className={cn(
                                    "inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out shadow-sm",
                                    isLiquidGlass ? "translate-x-6" : "translate-x-1"
                                )}
                            />
                        </button>
                    </div>
                </div>

                <div className="space-y-10 px-2">
                    {/* Chế độ nền */}
                    <div>
                        <h3 className="text-sm font-bold text-foreground-base flex items-center gap-2 mb-4">
                            <Moon size={16} className="text-primary-500" /> Chế độ nền
                        </h3>
                        <div className="flex items-center gap-6 p-5 rounded-2xl border border-border/40 bg-black/5">
                            <ThemeTogglePremium />
                            <div>
                                <p className="font-bold text-sm tracking-wide text-foreground-base flex items-center gap-2">
                                    {theme === 'dark' ? '🌙 Chế độ Tối' : '☀️ Chế độ Sáng'}
                                </p>
                                <p className="text-sm text-foreground-muted mt-1 leading-relaxed">
                                    {theme === 'dark' 
                                        ? 'Deep space — Bảo vệ mắt khi làm việc ban đêm' 
                                        : 'Clean white — Trực quan và tươi sáng ban ngày'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Trải nghiệm màu sắc */}
                    <div>
                        <h3 className="text-sm font-bold text-foreground-base flex items-center gap-2 mb-4">
                            <Palette size={16} className="text-primary-500" /> Màu chủ đạo
                        </h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {THEME_COLORS.map(color => (
                                <button
                                    key={color.value}
                                    onClick={() => setPrimaryColor(color.value)}
                                    className={cn(
                                        "flex items-center gap-3 p-3.5 rounded-xl border transition-all text-sm font-medium",
                                        primaryColor === color.value 
                                            ? "border-primary-500 bg-primary-500/10 shadow-sm" 
                                            : "border-border/50 bg-background-elevated hover:bg-black/5"
                                    )}
                                >
                                    <div 
                                        className="w-5 h-5 rounded-full shadow-inner border border-black/10" 
                                        style={{ background: color.value }}
                                    />
                                    <span className="truncate text-foreground-base text-[13px]">{color.label}</span>
                                    {primaryColor === color.value && <Check size={16} className="ml-auto text-primary-500" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action bar */}
                    <div className="pt-6 mt-8 border-t border-border/30 flex justify-end">
                        <button 
                            onClick={handleSave}
                            className="px-6 py-2.5 rounded-xl text-white font-semibold flex items-center gap-2 hover:opacity-90 transition-all text-sm shadow-md"
                            style={{ background: primaryColor }}
                        >
                            {savedConfig ? (
                                <><CheckCircle2 size={18} /> Đã lưu thành công</>
                            ) : (
                                <><Save size={18} /> Lưu cài đặt</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
