'use client'

import type { CSSProperties } from 'react'
import { useMemo, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { API_URL } from '@/lib/api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthStore } from '@/stores/auth.store'

export function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  const { login, error, clearError, isLoading } = useAuthStore()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/dashboard'
  const googleError = searchParams.get('error')
  const googleMessage = searchParams.get('message')

  const externalError = useMemo(() => {
    if (googleError !== 'google_auth_failed') {
      return null
    }
    return googleMessage || 'Dang nhap Google that bai'
  }, [googleError, googleMessage])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    clearError()

    try {
      await login(username, password)
      toast.success('Dang nhap thanh cong')
      window.location.href = redirect
    } catch {
      // store handles the error message
    }
  }

  const handleGoogleLogin = () => {
    const target = `${API_URL}/api/auth/google?redirect=${encodeURIComponent(redirect)}`
    window.location.href = target
  }

  const loading = isPending || isLoading
  const visibleError = error || externalError

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
          Dang nhap
        </h1>
        <p style={{ color: 'var(--color-foreground-muted)', fontSize: 15 }}>
          Dang nhap bang tai khoan noi bo hoac Google.
        </p>
      </div>

      {visibleError && (
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
          <span style={{ fontSize: 16 }}>!</span>
          <span style={{ color: 'var(--color-error)', fontSize: 14, fontWeight: 500 }}>{visibleError}</span>
        </motion.div>
      )}

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-border/60 bg-background-base px-4 py-3 text-sm font-semibold text-foreground-base transition-colors hover:bg-background-elevated disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-base">G</span>
        Dang nhap voi Google
      </button>

      <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-foreground-muted">
        <span className="h-px flex-1 bg-border/50" />
        <span>Noi bo</span>
        <span className="h-px flex-1 bg-border/50" />
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="username"
            style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-foreground-secondary)', marginBottom: 8 }}
          >
            Ten dang nhap
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Nhap ten dang nhap"
            autoComplete="username"
            required
            disabled={loading}
            style={inputStyle(loading)}
          />
        </div>

        <div style={{ marginBottom: 32 }}>
          <label
            htmlFor="password"
            style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-foreground-secondary)', marginBottom: 8 }}
          >
            Mat khau
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nhap mat khau"
              autoComplete="current-password"
              required
              disabled={loading}
              style={{ ...inputStyle(loading), padding: '12px 48px 12px 16px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
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
              }}
              aria-label={showPassword ? 'An mat khau' : 'Hien mat khau'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !username || !password}
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
              Dang dang nhap...
            </>
          ) : (
            'Dang nhap he thong'
          )}
        </button>
      </form>

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
            <strong>Dev accounts:</strong> <br />
            admin / Admin@123 · staff01 / Staff@123
          </div>
        </div>
      )}
    </motion.div>
  )
}

function inputStyle(loading: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '12px 16px',
    border: '1.5px solid var(--color-border)',
    borderRadius: 12,
    fontSize: 15,
    outline: 'none',
    transition: 'all 0.2s',
    color: 'var(--color-foreground-base)',
    background: loading ? 'var(--color-background-tertiary)' : 'var(--color-background-base)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02) inset',
  }
}
