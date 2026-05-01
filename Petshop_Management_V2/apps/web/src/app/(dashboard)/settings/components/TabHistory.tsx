'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { History, Search, Filter, Calendar as CalendarIcon, User, Activity, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek, startOfMonth, startOfToday, subDays } from 'date-fns'
import { api } from '@/lib/api'

export function TabHistory() {
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(20)
    
    // Filter states
    const [timeRange, setTimeRange] = useState('this_week')
    
    const defaultDates = useMemo(() => {
        const today = new Date()
        return {
            today: { from: format(today, 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') },
            yesterday: { from: format(subDays(today, 1), 'yyyy-MM-dd'), to: format(subDays(today, 1), 'yyyy-MM-dd') },
            this_week: { from: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') },
            this_month: { from: format(startOfMonth(today), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') },
        }
    }, [])

    const [dateFrom, setDateFrom] = useState(defaultDates.this_week.from)
    const [dateTo, setDateTo] = useState(defaultDates.this_week.to)
    const [action, setAction] = useState('all')
    const [target, setTarget] = useState('all')
    const [search, setSearch] = useState('')

    // Update dates when quick range changes
    useEffect(() => {
        if (timeRange !== 'custom') {
            const range = defaultDates[timeRange as keyof typeof defaultDates]
            if (range) {
                setDateFrom(range.from)
                setDateTo(range.to)
            }
        }
    }, [timeRange, defaultDates])

    // If typing custom dates, set selector to custom
    const handleCustomDateChange = (type: 'from' | 'to', value: string) => {
        if (type === 'from') setDateFrom(value)
        if (type === 'to') setDateTo(value)
        setTimeRange('custom')
    }
    
    // Fetch logs data
    const { data: logRes, isLoading } = useQuery({
        queryKey: ['activity-logs', page, limit, dateFrom, dateTo, action, target, search],
        queryFn: async () => {
            const res = await api.get('/activity-logs', {
                params: {
                    page,
                    limit,
                    from: dateFrom,
                    to: dateTo,
                    action: action !== 'all' ? action : undefined,
                    target: target !== 'all' ? target : undefined,
                    search: search || undefined
                }
            })
            return res.data
        }
    })

    const logs = logRes?.data || []
    const total = logRes?.total || 0
    const totalPages = Math.ceil(total / limit)

    return (
        <div className="w-full bg-background-secondary border border-border/60 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[600px]">
            <div className="border-b border-border/50 p-6 flex flex-col gap-6">
                <div>
                    <h2 className="text-lg font-bold text-foreground-base flex items-center gap-3">
                        <History className="text-primary-500" size={24} /> 
                        Lịch sử thao tác
                    </h2>
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
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-background-secondary border border-border/50 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-primary-500 text-foreground-base"
                        />
                    </div>
                    <select 
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        className="bg-background-secondary border border-border/50 rounded-xl px-4 py-2 text-sm outline-none text-foreground-base appearance-none cursor-pointer"
                    >
                        <option value="all" className="bg-background">Tất cả action</option>
                        <option value="CREATE" className="bg-background">CREATE</option>
                        <option value="UPDATE" className="bg-background">UPDATE</option>
                        <option value="DELETE" className="bg-background">DELETE</option>
                    </select>
                    <select 
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="bg-background-secondary border border-border/50 rounded-xl px-4 py-2 text-sm outline-none text-foreground-base appearance-none cursor-pointer"
                    >
                        <option value="all" className="bg-background">Tất cả mục</option>
                        <option value="Product" className="bg-background">Product</option>
                        <option value="Order" className="bg-background">Order</option>
                        <option value="Customer" className="bg-background">Customer</option>
                    </select>
                    <div className="flex items-center gap-2">
                        <select 
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="bg-background-secondary border border-border/50 rounded-xl px-4 py-2 text-sm outline-none text-foreground-base appearance-none cursor-pointer font-medium"
                        >
                            <option value="today" className="bg-background text-foreground-base">Hôm nay</option>
                            <option value="yesterday" className="bg-background text-foreground-base">Hôm qua</option>
                            <option value="this_week" className="bg-background text-foreground-base">Tuần này</option>
                            <option value="this_month" className="bg-background text-foreground-base">Tháng này</option>
                            <option value="custom" className="bg-background text-foreground-base">Tùy chỉnh</option>
                        </select>
                        <div className="flex items-center gap-2 bg-background-secondary border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground-muted">
                            <input 
                                type="date" 
                                className="bg-transparent outline-none text-foreground-base" 
                                value={dateFrom} 
                                onChange={(e) => handleCustomDateChange('from', e.target.value)}
                            />
                        </div>
                        <span>→</span>
                        <div className="flex items-center gap-2 bg-background-secondary border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground-muted">
                            <input 
                                type="date" 
                                className="bg-transparent outline-none text-foreground-base" 
                                value={dateTo}
                                onChange={(e) => handleCustomDateChange('to', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 flex-1 bg-black/5 flex flex-col">
                {isLoading ? (
                    <div className="flex items-center justify-center text-foreground-muted py-20">Đang tải lịch sử...</div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-foreground-muted/60 py-20 gap-3">
                        <History size={40} className="opacity-20" />
                        <p>Chưa có lịch sử thao tác nào.</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-3 flex-1 mb-6">
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
                        
                        {/* Pagination Footer */}
                        <div className="flex items-center justify-between pt-4 border-t border-border/50">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-foreground-muted">Hiển thị mục:</span>
                                <select 
                                    value={limit} 
                                    onChange={(e) => {
                                        setLimit(Number(e.target.value))
                                        setPage(1)
                                    }}
                                    className="bg-background-secondary border border-border/50 rounded-lg px-2 py-1 text-sm outline-none text-foreground-base"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-foreground-muted">
                                    Trang {page} / {Math.max(1, totalPages)} (Tổng: {total})
                                </span>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="p-1.5 rounded-lg border border-border/50 text-foreground-base hover:bg-background-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button 
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages || totalPages === 0}
                                        className="p-1.5 rounded-lg border border-border/50 text-foreground-base hover:bg-background-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
