'use client'

import React from 'react'
import { AlertCircle, Box, CheckCircle2, Loader2, Package } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

type ModuleConfig = {
    key: string
    displayName: string
    description: string
    isActive: boolean
    isCore: boolean
    icon: string
    sortOrder: number
    version: string
}

// Map icon emoji → Lucide fallback khi cần class styling
const MODULE_ACCENT: Record<string, { from: string; to: string; ring: string }> = {
    pet: { from: 'from-violet-500/20', to: 'to-pink-500/10', ring: 'ring-violet-500/30' },
    hotel: { from: 'from-sky-500/20', to: 'to-blue-500/10', ring: 'ring-sky-500/30' },
    grooming: { from: 'from-emerald-500/20', to: 'to-teal-500/10', ring: 'ring-emerald-500/30' },
}

function ModuleCard({
    module,
    onToggle,
    isToggling,
}: {
    module: ModuleConfig
    onToggle: (key: string, isActive: boolean) => void
    isToggling: boolean
}) {
    const accent = MODULE_ACCENT[module.key] ?? {
        from: 'from-primary-500/20',
        to: 'to-primary-500/10',
        ring: 'ring-primary-500/30',
    }

    return (
        <div
            className={cn(
                'group relative overflow-hidden rounded-2xl border bg-background-secondary p-6 transition-all duration-300',
                module.isActive
                    ? 'border-border/60 shadow-sm'
                    : 'border-border/30 opacity-70 grayscale-[0.4]',
            )}
        >
            {/* Gradient background */}
            <div
                className={cn(
                    'pointer-events-none absolute inset-0 bg-linear-to-br opacity-60 transition-opacity group-hover:opacity-100',
                    accent.from,
                    accent.to,
                )}
            />

            <div className="relative flex items-start gap-4">
                {/* Icon */}
                <div
                    className={cn(
                        'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-background-elevated text-2xl ring-1',
                        accent.ring,
                    )}
                >
                    {module.icon || '📦'}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-bold text-foreground-base">{module.displayName}</h3>
                        {module.isCore && (
                            <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-500">
                                Cốt lõi
                            </span>
                        )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground-secondary">{module.description}</p>

                    {/* Status badge */}
                    <div className="mt-3 flex items-center gap-2">
                        {module.isActive ? (
                            <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-500">
                                <CheckCircle2 size={12} />
                                Đang hoạt động
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 rounded-full bg-gray-500/10 px-3 py-1 text-xs font-semibold text-foreground-muted">
                                <AlertCircle size={12} />
                                Đã tắt
                            </span>
                        )}
                        <span className="text-[11px] text-foreground-muted">v{module.version}</span>
                    </div>
                </div>

                {/* Toggle switch */}
                {!module.isCore && (
                    <button
                        disabled={isToggling}
                        onClick={() => onToggle(module.key, !module.isActive)}
                        className={cn(
                            'relative mt-1 h-7 w-12 shrink-0 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                            module.isActive ? 'bg-primary-500' : 'bg-border',
                            isToggling && 'cursor-not-allowed opacity-50',
                        )}
                        title={module.isActive ? 'Tắt module này' : 'Bật module này'}
                    >
                        <span
                            className={cn(
                                'absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300',
                                module.isActive ? 'left-6' : 'left-1',
                            )}
                        />
                        {isToggling && (
                            <span className="absolute inset-0 flex items-center justify-center">
                                <Loader2 size={12} className="animate-spin text-white" />
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* Bottom warning when disabled */}
            {!module.isActive && !module.isCore && (
                <div className="relative mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-600">
                    ⚠️ Module đang tắt — tất cả API và giao diện liên quan sẽ trả về lỗi 403
                </div>
            )}
        </div>
    )
}

export function TabModules() {
    const queryClient = useQueryClient()
    const [togglingKey, setTogglingKey] = React.useState<string | null>(null)

    const { data: modules = [], isLoading, isError } = useQuery({
        queryKey: ['settings', 'modules'],
        queryFn: async () => {
            const response = await api.get('/settings/modules')
            return response.data.data as ModuleConfig[]
        },
    })

    const mutationToggle = useMutation({
        mutationFn: async ({ key, isActive }: { key: string; isActive: boolean }) => {
            const response = await api.patch(`/settings/modules/${key}`, { isActive })
            return response.data.data as ModuleConfig
        },
        onMutate: ({ key }) => setTogglingKey(key),
        onSuccess: (updated) => {
            toast.success(
                updated.isActive
                    ? `✅ Đã bật module "${updated.displayName}"`
                    : `🔴 Đã tắt module "${updated.displayName}"`,
            )
            queryClient.invalidateQueries({ queryKey: ['settings', 'modules'] })
        },
        onError: () => {
            toast.error('Không thể thay đổi trạng thái module. Vui lòng thử lại.')
        },
        onSettled: () => setTogglingKey(null),
    })

    const handleToggle = (key: string, isActive: boolean) => {
        if (togglingKey) return
        if (!isActive && !confirm(`Bạn chắc chắn muốn TẮT module này?\nTất cả chức năng liên quan sẽ ngừng hoạt động.`)) return
        mutationToggle.mutate({ key, isActive })
    }

    const activeCount = modules.filter((m) => m.isActive && !m.isCore).length
    const totalCount = modules.filter((m) => !m.isCore).length

    return (
        <div className="flex min-h-[500px] w-full flex-col overflow-hidden rounded-3xl border border-border/60 bg-background-secondary shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 p-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-primary-500/20 bg-primary-500/10 p-2.5 text-primary-500">
                        <Package size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground-base">Quản lý Module</h2>
                        <p className="mt-0.5 text-sm text-foreground-secondary">
                            Bật hoặc tắt các phân hệ phụ của hệ thống
                        </p>
                    </div>
                </div>

                {/* Stats */}
                {!isLoading && !isError && (
                    <div className="hidden items-center gap-2 rounded-xl border border-border/40 bg-background-elevated px-4 py-2 text-sm sm:flex">
                        <Box size={14} className="text-primary-500" />
                        <span className="font-semibold text-foreground-base">{activeCount}</span>
                        <span className="text-foreground-muted">/ {totalCount} đang hoạt động</span>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 bg-black/5 p-6">
                {isLoading ? (
                    <div className="flex h-64 items-center justify-center">
                        <Loader2 className="animate-spin text-primary-500" size={28} />
                    </div>
                ) : isError ? (
                    <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-foreground-muted">
                        <AlertCircle size={28} className="text-red-400" />
                        Không thể tải dữ liệu module. Vui lòng thử lại.
                    </div>
                ) : modules.length === 0 ? (
                    <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border/60 text-sm text-foreground-muted">
                        Chưa có module nào được cài đặt.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {modules.map((module) => (
                            <ModuleCard
                                key={module.key}
                                module={module}
                                onToggle={handleToggle}
                                isToggling={togglingKey === module.key}
                            />
                        ))}
                    </div>
                )}

                {/* Admin notice */}
                {!isLoading && !isError && modules.length > 0 && (
                    <div className="mt-6 flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-600">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>
                            Chỉ <strong>Quản trị viên chính (Super Admin)</strong> mới có quyền thay đổi cài đặt module.
                            Việc tắt module sẽ áp dụng ngay lập tức mà không cần khởi động lại hệ thống.
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}
