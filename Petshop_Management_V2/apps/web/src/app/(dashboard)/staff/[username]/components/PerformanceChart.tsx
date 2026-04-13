'use client'

import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import dayjs from 'dayjs'

interface PerformanceChartProps {
  data: MonthlyPerformance[]
}

export interface MonthlyPerformance {
  month: number
  year: number
  revenue: number
  orders: number
  spaSessions: number
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`
    }
    return `${amount}`
  }

  const stats = useMemo(() => {
    if (data.length === 0) return null

    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0)
    const totalOrders = data.reduce((sum, d) => sum + d.orders, 0)
    const totalSpaSessions = data.reduce((sum, d) => sum + d.spaSessions, 0)
    const avgRevenue = totalRevenue / data.length

    // Calculate growth rate (last month vs first month)
    const firstMonth = data[0]
    const lastMonth = data[data.length - 1]
    const revenueGrowth =
      firstMonth.revenue > 0
        ? ((lastMonth.revenue - firstMonth.revenue) / firstMonth.revenue) * 100
        : 0

    return {
      totalRevenue,
      totalOrders,
      totalSpaSessions,
      avgRevenue,
      revenueGrowth,
      trend: revenueGrowth >= 0 ? 'up' : 'down' as const,
    }
  }, [data])

  if (data.length === 0 || !stats) {
    return (
      <div className="card flex h-64 items-center justify-center">
        <p className="text-foreground-muted">Chưa có dữ liệu hiệu suất</p>
      </div>
    )
  }

  // Chart dimensions
  const chartHeight = 200
  const chartWidth = 600
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1)

  const bars = data.map((d, i) => {
    const barWidth = innerWidth / data.length - 8
    const barHeight = (d.revenue / maxRevenue) * innerHeight
    const x = padding.left + (innerWidth / data.length) * i + 4
    const y = padding.top + innerHeight - barHeight

    return {
      ...d,
      x,
      y,
      barWidth,
      barHeight,
      label: `T${d.month}`,
    }
  })

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs text-foreground-muted">Tổng doanh thu</p>
          <p className="text-xl font-bold text-primary-500">
            {formatCurrency(stats.totalRevenue)}
          </p>
        </div>

        <div className="card">
          <p className="text-xs text-foreground-muted">Tổng đơn hàng</p>
          <p className="text-xl font-bold text-foreground">{stats.totalOrders}</p>
        </div>

        <div className="card">
          <p className="text-xs text-foreground-muted">TB doanh thu/tháng</p>
          <p className="text-xl font-bold text-foreground">
            {formatCurrency(stats.avgRevenue)}
          </p>
        </div>

        <div className="card">
          <p className="text-xs text-foreground-muted">Xu hướng</p>
          <div className="flex items-center gap-2">
            {stats.trend === 'up' ? (
              <TrendingUp size={16} className="text-primary-500" />
            ) : (
              <TrendingDown size={16} className="text-red-500" />
            )}
            <span className={`text-xl font-bold ${stats.trend === 'up' ? 'text-primary-500' : 'text-red-500'}`}>
              {stats.revenueGrowth >= 0 ? '+' : ''}{stats.revenueGrowth.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
          <TrendingUp size={16} className="text-primary-500" />
          Biểu đồ doanh thu ({data.length} tháng gần nhất)
        </h3>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full min-w-[400px]"
            style={{ maxHeight: chartHeight }}
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = padding.top + innerHeight * (1 - ratio)
              const value = maxRevenue * ratio
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={chartWidth - padding.right}
                    y2={y}
                    stroke="hsl(var(--bd))"
                    strokeWidth="1"
                    strokeDasharray={i === 0 ? '0' : '4,4'}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-foreground-muted"
                    fontSize="10"
                  >
                    {formatCurrency(value)}
                  </text>
                </g>
              )
            })}

            {/* Bars */}
            {bars.map((bar, i) => (
              <g key={i}>
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={bar.barWidth}
                  height={bar.barHeight}
                  fill="hsl(152 80% 40%)"
                  rx="4"
                  className="opacity-80 hover:opacity-100 transition-opacity"
                />
                <text
                  x={bar.x + bar.barWidth / 2}
                  y={bar.y - 8}
                  textAnchor="middle"
                  className="fill-foreground"
                  fontSize="10"
                  fontWeight="600"
                >
                  {formatCurrency(bar.revenue)}
                </text>
                <text
                  x={bar.x + bar.barWidth / 2}
                  y={chartHeight - padding.bottom + 16}
                  textAnchor="middle"
                  className="fill-foreground-muted"
                  fontSize="11"
                >
                  {bar.label}
                </text>
              </g>
            ))}

            {/* Axes */}
            <line
              x1={padding.left}
              y1={padding.top + innerHeight}
              x2={chartWidth - padding.right}
              y2={padding.top + innerHeight}
              stroke="hsl(var(--bd))"
              strokeWidth="1"
            />
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-6 text-xs text-foreground-muted">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-primary-500" />
            Doanh thu
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-foreground-muted/30" />
            Đơn hàng: {stats.totalOrders}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-foreground-muted/30" />
            Spa: {stats.totalSpaSessions} ca
          </div>
        </div>
      </div>
    </div>
  )
}
