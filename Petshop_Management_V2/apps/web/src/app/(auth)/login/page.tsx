import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoginForm } from './_components/login-form'

export const metadata: Metadata = {
  title: 'Đăng nhập',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex bg-grid-pattern relative overflow-hidden" style={{ background: 'var(--color-background-base)' }}>
      {/* Decorative gradient blobs */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full opacity-30 animate-spin-slow"
        style={{
          background: 'radial-gradient(circle, var(--color-primary-500) 0%, transparent 70%)',
          filter: 'blur(100px)'
        }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, var(--color-accent-500) 0%, transparent 60%)',
          filter: 'blur(80px)'
        }}
      />

      {/* Main glass container wrapping both sides */}
      <div className="flex-1 flex max-w-6xl mx-auto my-12 glass-panel rounded-3xl overflow-hidden relative z-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">
        {/* ---- Left panel — Brand ---- */}
        <div
          className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden text-white"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-700) 100%)',
          }}
        >
          {/* Decorative circles inside left panel */}
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute w-[400px] h-[400px] rounded-full bg-white/5 -top-[120px] -right-[80px]" />
            <div className="absolute w-[300px] h-[300px] rounded-full bg-white/5 bottom-[80px] -left-[60px]" />
          </div>

          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl backdrop-blur-xl shadow-lg border border-white/30">
              🐾
            </div>
            <div>
              <p className="text-xl font-bold leading-tight">Petshop Pro</p>
            </div>
          </div>

          <div className="relative z-10">
            <h2 className="text-4xl font-extrabold leading-tight mb-4">
              Quản lý thú cưng<br />
              <span className="text-white/70">đẳng cấp & mượt mà</span>
            </h2>
            <p className="text-white/80 text-lg max-w-[360px]">
              Trải nghiệm hệ thống mượt mà, quản lý mọi dịch vụ dễ dàng với giao diện hiện đại nhất.
            </p>

            <div className="flex flex-wrap gap-2 mt-8">
              {['💅 Grooming', '🏨 Hotel', '📦 Tồn kho', '💰 POS'].map((feat) => (
                <span
                  key={feat}
                  className="bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-full px-4 py-1.5 text-sm font-semibold shadow-sm"
                >
                  {feat}
                </span>
              ))}
            </div>
          </div>

          <div className="relative z-10">
            <p className="text-white/50 text-sm">
              © 2026 Powered by Antigravity
            </p>
          </div>
        </div>

        {/* ---- Right panel — Login form ---- */}
        <div className="flex-[0.8] flex items-center justify-center p-8 bg-transparent">
          <Suspense fallback={<div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
