'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

type DashboardMetrics = {
  todayRevenue: number
  todayOrderCount: number
  monthRevenue: number
  monthOrderCount: number
  totalCustomers: number
  newCustomersThisMonth: number
  lowStockCount: number
  pendingGrooming: number
  activeHotelStays: number
}

type RevenuePoint = {
  date: string
  revenue: number
}

type TopCustomer = {
  customer: {
    id: string
    fullName: string
    phone?: string
    customerCode?: string
  }
  totalSpent: number
  orderCount: number
}

type TopProduct = {
  product: {
    id: string
    name: string
    sku?: string
  }
  totalQuantity: number
  totalRevenue: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value))
}

export default function DashboardPage() {
  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ['reports', 'dashboard'],
    queryFn: async () => {
      const res = await api.get('/reports/dashboard')
      return res.data.data
    },
    staleTime: 60_000,
  })

  const { data: revenueChart = [] } = useQuery<RevenuePoint[]>({
    queryKey: ['reports', 'revenue-chart', 7],
    queryFn: async () => {
      const res = await api.get('/reports/revenue-chart', { params: { days: 7 } })
      return res.data.data
    },
    staleTime: 60_000,
  })

  const { data: topCustomers = [] } = useQuery<TopCustomer[]>({
    queryKey: ['reports', 'top-customers'],
    queryFn: async () => {
      const res = await api.get('/reports/top-customers')
      return res.data.data
    },
    staleTime: 60_000,
  })

  const { data: topProducts = [] } = useQuery<TopProduct[]>({
    queryKey: ['reports', 'top-products'],
    queryFn: async () => {
      const res = await api.get('/reports/top-products')
      return res.data.data
    },
    staleTime: 60_000,
  })

  const maxRevenue = revenueChart.reduce((max, item) => Math.max(max, item.revenue), 0)

  const stats = [
    {
      label: 'Doanh thu hôm nay',
      value: formatCurrency(metrics?.todayRevenue ?? 0),
      icon: '$',
      color: 'var(--color-primary-500)',
      bg: 'var(--color-primary-500)',
    },
    {
      label: 'Đơn hàng hôm nay',
      value: formatNumber(metrics?.todayOrderCount ?? 0),
      icon: '🛒',
      color: 'var(--color-amber-500)',
      bg: 'var(--color-amber-500)',
    },
    {
      label: 'Doanh thu tháng',
      value: formatCurrency(metrics?.monthRevenue ?? 0),
      icon: '📈',
      color: 'var(--color-blue-500)',
      bg: 'var(--color-blue-500)',
    },
    {
      label: 'Khách hàng',
      value: formatNumber(metrics?.totalCustomers ?? 0),
      icon: '👥',
      color: 'var(--color-purple-500)',
      bg: 'var(--color-purple-500)',
    },
  ]

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="mb-2 bg-gradient-to-r from-foreground-base to-foreground-muted bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
          Tổng quan
        </h1>
        <p className="text-sm font-medium text-foreground-secondary">
          Chào mừng. Đây là bức tranh vận hành theo chi nhánh đang chọn.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="glass-panel group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div
              className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-10"
              style={{ background: `linear-gradient(135deg, transparent, ${stat.color})` }}
            />

            <div className="flex items-center justify-between">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground-secondary">
                  {stat.label}
                </p>
                <p className="text-3xl font-extrabold text-foreground-base">{stat.value}</p>
              </div>

              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
                style={{
                  background: stat.bg,
                  boxShadow: `0 8px 16px -4px color-mix(in srgb, ${stat.color} 50%, transparent)`,
                }}
              >
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-panel lg:col-span-2 flex min-h-[400px] flex-col rounded-3xl p-6">
          <h2 className="mb-6 flex items-center gap-2 text-sm font-bold text-primary-500">
            <span className="text-lg">📊</span> Doanh thu 7 ngày qua
          </h2>

          {revenueChart.length > 0 ? (
            <div className="grid flex-1 grid-cols-7 items-end gap-3">
              {revenueChart.map((item) => {
                const height = maxRevenue > 0 ? Math.max((item.revenue / maxRevenue) * 100, 16) : 16
                return (
                  <div key={item.date} className="flex h-full flex-col items-center justify-end gap-3">
                    <div className="text-center text-[11px] font-semibold text-foreground-muted">
                      {formatCurrency(item.revenue)}
                    </div>
                    <div className="flex h-[240px] w-full items-end rounded-2xl bg-black/5 p-2 dark:bg-white/5">
                      <div
                        className="w-full rounded-xl bg-gradient-to-t from-primary-500 to-blue-400"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <div className="text-xs font-bold uppercase tracking-wider text-foreground-muted">
                      {formatShortDate(item.date)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-foreground-muted opacity-50">
              <span className="mb-3 text-4xl">📈</span>
              <p className="text-sm font-medium">Chưa có dữ liệu</p>
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-6">
          <div className="glass-panel rounded-3xl p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-blue-500">
              <span className="text-lg">✂️</span> SPA & Grooming hôm nay
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/50 bg-black/5 p-4 text-center dark:bg-white/5">
                <p className="mb-1 text-3xl font-bold text-amber-500">
                  {formatNumber(metrics?.pendingGrooming ?? 0)}
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
                  Đang chờ
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-black/5 p-4 text-center dark:bg-white/5">
                <p className="mb-1 text-3xl font-bold text-emerald-500">
                  {formatNumber(metrics?.newCustomersThisMonth ?? 0)}
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
                  Khách mới tháng này
                </p>
              </div>
            </div>
          </div>

          <div className="glass-panel flex-1 rounded-3xl p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-amber-500">
              <span className="text-lg">🏨</span> Pet Hotel
            </h2>
            <div className="flex h-[calc(100%-40px)] flex-col items-center justify-center rounded-2xl border border-border/50 bg-black/5 p-6 text-center dark:bg-white/5">
              <p className="mb-2 text-4xl font-extrabold text-primary-500">
                {formatNumber(metrics?.activeHotelStays ?? 0)}
              </p>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground-muted">
                Đang lưu trú
              </p>
              <p className="mt-4 text-sm text-foreground-secondary">
                Sắp thiếu hàng: {formatNumber(metrics?.lowStockCount ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-panel rounded-3xl p-6">
          <h2 className="mb-6 flex items-center gap-2 text-sm font-bold text-rose-500">
            <span className="text-lg">⚡</span> Thao tác nhanh
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Tạo đơn hàng', icon: '➕', href: '/pos', color: 'var(--color-cyan-500)' },
              { label: 'Grooming mới', icon: '✂️', href: '/grooming', color: 'var(--color-blue-500)' },
              { label: 'Check-in Hotel', icon: '🏨', href: '/hotel', color: 'var(--color-amber-500)' },
              { label: 'Thêm khách hàng', icon: '👥', href: '/customers', color: 'var(--color-purple-500)' },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/50 bg-black/5 p-4 transition-all hover:bg-black/10 hover:border-border dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md transition-transform group-hover:scale-110"
                  style={{ background: action.color }}
                >
                  {action.icon}
                </div>
                <span className="text-center text-xs font-bold tracking-wide text-foreground-secondary">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass-panel flex flex-col rounded-3xl p-6">
          <h2 className="mb-6 flex items-center gap-2 text-sm font-bold text-amber-500">
            <span className="text-lg">🏆</span> Top khách hàng
          </h2>

          {topCustomers.length > 0 ? (
            <div className="space-y-4">
              {topCustomers.map((item, index) => (
                <div
                  key={item.customer?.id ?? `customer-${index}`}
                  className="flex items-center justify-between rounded-2xl border border-border/50 bg-black/5 px-4 py-3 dark:bg-white/5"
                >
                  <div>
                    <p className="font-semibold text-foreground-base">
                      #{index + 1} {item.customer?.fullName ?? 'Khách lẻ / Đã xóa'}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {item.customer?.customerCode ?? 'KH'} • {item.orderCount} đơn
                    </p>
                  </div>
                  <p className="text-sm font-bold text-primary-500">{formatCurrency(item.totalSpent)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-foreground-muted opacity-50">
              <p className="text-sm font-medium">Chưa có dữ liệu</p>
            </div>
          )}
        </div>

        <div className="glass-panel flex flex-col rounded-3xl p-6">
          <h2 className="mb-6 flex items-center gap-2 text-sm font-bold text-emerald-500">
            <span className="text-lg">📦</span> Top sản phẩm/dịch vụ
          </h2>

          {topProducts.length > 0 ? (
            <div className="space-y-4">
              {topProducts.map((item, index) => (
                <div
                  key={item.product?.id ?? `product-${index}`}
                  className="flex items-center justify-between rounded-2xl border border-border/50 bg-black/5 px-4 py-3 dark:bg-white/5"
                >
                  <div>
                    <p className="font-semibold text-foreground-base">
                      #{index + 1} {item.product?.name ?? 'Sản phẩm đã xóa'}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {item.product?.sku ?? 'N/A'} • {formatNumber(item.totalQuantity)} lượt bán
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-500">{formatCurrency(item.totalRevenue)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-foreground-muted opacity-50">
              <p className="text-sm font-medium">Chưa có dữ liệu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
