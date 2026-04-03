'use client'

import React, { useState } from 'react'
import { History, Search, Filter, Calendar as CalendarIcon, User, Activity, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { api } from '@/lib/api'

export function TabHistory() {
    const [page, setPage] = useState(1)
    
    // Fetch logs data
    const { data: logRes, isLoading } = useQuery({
        queryKey: ['activity-logs', page],
        queryFn: async () => {
            const res = await api.get(`/activity-logs?page=${page}&limit=10`)
            return res.data
        }
    })

    const logs = logRes?.data || []
    const total = logRes?.total || 0

    return (
        <div className="w-full bg-background-secondary border border-border/60 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[600px]">
            <div className="border-b border-border/50 p-6 flex flex-col gap-6">
                <div>
                    <h2 className="text-lg font-bold text-foreground-base flex items-center gap-3">
                        <History className="text-primary-500" size={24} /> 
                        Lịch sử thao tác
                    </h2>
                    <p className="text-sm text-foreground-muted mt-1">Giám sát và kiểm tra lại lịch sử người dùng trên hệ thống.</p>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-black/5 border border-border/50 rounded-2xl p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <Activity size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-foreground-muted font-bold uppercase tracking-wider">Hôm nay</p>
                            <p className="text-2xl font-bold font-mono">142</p>
                        </div>
                    </div>
                    <div className="bg-black/5 border border-border/50 rounded-2xl p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <History size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-foreground-muted font-bold uppercase tracking-wider">Tổng thao tác</p>
                            <p className="text-2xl font-bold font-mono">{total || '--'}</p>
                        </div>
                    </div>
                    <div className="bg-black/5 border border-border/50 rounded-2xl p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                            <User size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-foreground-muted font-bold uppercase tracking-wider">Người dùng</p>
                            <p className="text-2xl font-bold font-mono">4</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={16} />
                        <input 
                            placeholder="Tìm tên nhân viên, chi tiết..."
                            className="w-full bg-black/10 border border-border/50 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-primary-500"
                        />
                    </div>
                    <select className="bg-black/10 border border-border/50 rounded-xl px-4 py-2 text-sm outline-none text-foreground-base appearance-none cursor-pointer">
                        <option>Tất cả action</option>
                        <option>CREATE</option>
                        <option>UPDATE</option>
                        <option>DELETE</option>
                    </select>
                    <select className="bg-black/10 border border-border/50 rounded-xl px-4 py-2 text-sm outline-none text-foreground-base appearance-none cursor-pointer">
                        <option>Tất cả mục</option>
                        <option>Product</option>
                        <option>Order</option>
                        <option>Customer</option>
                    </select>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-black/10 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground-muted">
                            <input type="date" className="bg-transparent outline-none text-foreground-base" defaultValue={"2026-03-30"} />
                        </div>
                        <span>→</span>
                        <div className="flex items-center gap-2 bg-black/10 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground-muted">
                            <input type="date" className="bg-transparent outline-none text-foreground-base" defaultValue={"2026-04-03"} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 flex-1 bg-black/5">
                {isLoading ? (
                    <div className="flex items-center justify-center text-foreground-muted py-20">Đang tải lịch sử...</div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-foreground-muted/60 py-20 gap-3">
                        <History size={40} className="opacity-20" />
                        <p>Chưa có lịch sử thao tác nào.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {logs.map((log: any) => (
                            <div key={log.id} className="flex gap-4 p-4 rounded-xl bg-background-elevated border border-border/40 hover:border-border/80 transition-colors">
                                <div className="w-10 h-10 shrink-0 rounded-full bg-primary-500/10 flex items-center justify-center font-bold text-primary-500 border border-primary-500/20">
                                    {log.user?.fullName?.[0] || 'U'}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm font-medium text-foreground-base">
                                            <span className="font-bold">{log.user?.fullName}</span> đã thực hiện <span className="text-primary-500 font-bold bg-primary-500/10 px-1.5 py-0.5 rounded">{log.action}</span>
                                        </p>
                                        <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
                                            <Clock size={12} />
                                            {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm')}
                                        </div>
                                    </div>
                                    <p className="text-sm text-foreground-muted mt-1">{log.description}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[10px] uppercase font-bold tracking-widest text-foreground-muted bg-black/10 px-2 py-0.5 rounded">
                                            {log.target}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
