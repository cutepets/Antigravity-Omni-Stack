import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Tổng quan' }

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-foreground-base to-foreground-muted mb-2 tracking-tight">
          Tổng quan
        </h1>
        <p className="text-foreground-secondary text-sm font-medium">
          Chào mừng! Đây là tổng quan hoạt động của cửa hàng.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Doanh thu hôm nay', value: '0 ₫', icon: '$',       color: 'var(--color-primary-500)', bg: 'var(--color-primary-500)' },
          { label: 'Đơn hàng hôm nay',  value: '0',   icon: '🛒',     color: 'var(--color-amber-500)',   bg: 'var(--color-amber-500)' },
          { label: 'Doanh thu tháng',   value: '0',   icon: '📈',     color: 'var(--color-blue-500)',    bg: 'var(--color-blue-500)' },
          { label: 'Khách hàng',        value: '0',   icon: '👥',     color: 'var(--color-purple-500)',  bg: 'var(--color-purple-500)' },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="glass-panel p-6 rounded-2xl flex items-center justify-between group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Subtle background glow on hover */}
            <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                style={{ background: `linear-gradient(135deg, transparent, ${stat.color})` }}
            />
            
            <div>
              <p className="text-foreground-secondary text-xs font-bold uppercase tracking-wider mb-2">{stat.label}</p>
              <p className="text-3xl font-extrabold text-foreground-base">{stat.value}</p>
            </div>
            
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
              style={{ 
                background: stat.bg,
                boxShadow: `0 8px 16px -4px color-mix(in srgb, ${stat.color} 50%, transparent)`
              }}
            >
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Doanh thu 7 ngày qua */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl min-h-[400px] flex flex-col">
            <h2 className="text-sm font-bold text-primary-500 flex items-center gap-2 mb-6">
              <span className="text-lg">📊</span> Doanh thu 7 ngày qua
            </h2>
            <div className="flex-1 flex flex-col items-center justify-center text-foreground-muted opacity-50">
                <span className="text-4xl mb-3">📈</span>
                <p className="text-sm font-medium">Chưa có dữ liệu</p>
            </div>
        </div>

        {/* Right side panels */}
        <div className="space-y-6 flex flex-col">
          {/* SPA & Grooming */}
          <div className="glass-panel p-6 rounded-3xl">
              <h2 className="text-sm font-bold text-blue-500 flex items-center gap-2 mb-4">
                <span className="text-lg">✂️</span> SPA & Grooming hôm nay
              </h2>
              <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 text-center border border-border/50">
                      <p className="text-3xl font-bold text-amber-500 mb-1">0</p>
                      <p className="text-[11px] text-foreground-muted font-bold uppercase tracking-wider">Đang làm</p>
                  </div>
                  <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 text-center border border-border/50">
                      <p className="text-3xl font-bold text-emerald-500 mb-1">0</p>
                      <p className="text-[11px] text-foreground-muted font-bold uppercase tracking-wider">Hoàn thành</p>
                  </div>
              </div>
          </div>

          {/* Hotel */}
          <div className="glass-panel p-6 rounded-3xl flex-1">
              <h2 className="text-sm font-bold text-amber-500 flex items-center gap-2 mb-4">
                <span className="text-lg">🏨</span> Pet Hotel
              </h2>
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-6 text-center border border-border/50 h-[calc(100%-40px)] flex flex-col items-center justify-center">
                  <p className="text-4xl font-extrabold text-primary-500 mb-2">0</p>
                  <p className="text-xs text-foreground-muted font-bold uppercase tracking-wider">Đang lưu trú</p>
              </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick actions */}
        <div className="glass-panel p-6 rounded-3xl">
          <h2 className="text-sm font-bold text-rose-500 flex items-center gap-2 mb-6">
            <span className="text-lg">⚡</span> Thao tác nhanh
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Tạo đơn hàng', icon: '➕', href: '/pos', color: 'var(--color-cyan-500)' },
              { label: 'Grooming mới', icon: '✂️', href: '/grooming', color: 'var(--color-blue-500)' },
              { label: 'Check-in Hotel', icon: '🏨', href: '/hotel', color: 'var(--color-amber-500)' },
              { label: 'Thêm Khách hàng', icon: '👥', href: '/customers', color: 'var(--color-purple-500)' },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-all border border-border/50 hover:border-border group"
              >
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110"
                  style={{ background: action.color }}
                >
                  {action.icon}
                </div>
                <span className="text-xs font-bold text-foreground-secondary text-center tracking-wide">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Top Khách hàng */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col">
            <h2 className="text-sm font-bold text-amber-500 flex items-center gap-2 mb-6">
              <span className="text-lg">🏆</span> Top khách hàng
            </h2>
            <div className="flex-1 flex items-center justify-center text-foreground-muted opacity-50">
                <p className="text-sm font-medium">Chưa có dữ liệu</p>
            </div>
        </div>

        {/* Top Sản phẩm */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col">
            <h2 className="text-sm font-bold text-emerald-500 flex items-center gap-2 mb-6">
              <span className="text-lg">📦</span> Top sản phẩm/dịch vụ
            </h2>
            <div className="flex-1 flex items-center justify-center text-foreground-muted opacity-50">
                <p className="text-sm font-medium">Chưa có dữ liệu</p>
            </div>
        </div>
      </div>
    </div>
  )
}
