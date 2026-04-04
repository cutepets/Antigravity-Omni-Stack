'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { animate, motion } from 'framer-motion'
import { customToast as toast } from '@/components/ui/toast-with-copy'

export function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  const { login, error, clearError, isLoading } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    startTransition(async () => {
      try {
        await login(username, password)
        toast.success(`Chào mừng trở lại! 👋`)
        router.push(redirect)
        router.refresh()
      } catch {
        // error is set in store
      }
    })
  }

  const loading = isPending || isLoading

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="glass-panel"
      style={{
        width: '100%',
        maxWidth: 420,
        borderRadius: 24,
        padding: 40,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <motion.div
          whileHover={{ scale: 1.05, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700))',
            boxShadow: '0 8px 16px color-mix(in srgb, var(--color-primary-500) 40%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            marginBottom: 20,
          }}
        >
          🐾
        </motion.div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-foreground-base)', marginBottom: 6, letterSpacing: '-0.02em' }}>
          Đăng nhập
        </h1>
        <p style={{ color: 'var(--color-foreground-muted)', fontSize: 15 }}>
          Nhập thông tin truy cập hệ thống quản lý
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-error) 20%, transparent)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
          role="alert"
        >
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ color: 'var(--color-error)', fontSize: 14, fontWeight: 500 }}>{error}</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Username */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="username"
            style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-foreground-secondary)', marginBottom: 8 }}
          >
            Tên đăng nhập
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nhập tên đăng nhập"
            autoComplete="username"
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1.5px solid var(--color-border)',
              borderRadius: 12,
              fontSize: 15,
              outline: 'none',
              transition: 'all 0.2s',
              color: 'var(--color-foreground-base)',
              background: loading ? 'var(--color-background-tertiary)' : 'var(--color-background-base)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02) inset'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-primary-500)';
              e.target.style.boxShadow = '0 0 0 4px color-mix(in srgb, var(--color-primary-500) 15%, transparent)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--color-border)';
              e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02) inset';
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 32 }}>
          <label
            htmlFor="password"
            style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-foreground-secondary)', marginBottom: 8 }}
          >
            Mật khẩu
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 48px 12px 16px',
                border: '1.5px solid var(--color-border)',
                borderRadius: 12,
                fontSize: 15,
                outline: 'none',
                transition: 'all 0.2s',
                color: 'var(--color-foreground-base)',
                background: loading ? 'var(--color-background-tertiary)' : 'var(--color-background-base)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02) inset'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--color-primary-500)';
                e.target.style.boxShadow = '0 0 0 4px color-mix(in srgb, var(--color-primary-500) 15%, transparent)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--color-border)';
                e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02) inset';
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-foreground-muted)',
                fontSize: 16,
                lineHeight: 1,
                padding: 4,
                transition: 'color 0.2s'
              }}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-foreground-base)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-foreground-muted)'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !username || !password}
          id="login-submit-btn"
          className={(!username || !password || loading) ? '' : 'liquid-button'}
          style={{
            width: '100%',
            padding: '14px',
            background: loading || (!username || !password)
              ? 'color-mix(in srgb, var(--color-primary-500) 40%, var(--color-background-tertiary))'
              : undefined,
            color: 'white',
            border: 'none',
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 700,
            cursor: loading || !username || !password ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  width: 18,
                  height: 18,
                  border: '2.5px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  display: 'inline-block',
                }}
                className="animate-spin"
              />
              Đang đăng nhập...
            </>
          ) : (
            'Đăng nhập hệ thống →'
          )}
        </button>
      </form>

      {/* Dev hint */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            marginTop: 32,
            padding: '14px 16px',
            background: 'color-mix(in srgb, var(--color-info) 5%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-info) 20%, transparent)',
            borderRadius: 12,
            fontSize: 13,
            color: 'var(--color-info)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
           <span className="text-xl">🛠</span>
           <div>
             <strong>Dev accounts:</strong> <br/>
             admin / Admin@123 · staff01 / Staff@123
           </div>
        </div>
      )}
    </motion.div>
  )
}

