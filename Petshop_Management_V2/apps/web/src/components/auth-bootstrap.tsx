'use client'

import { useEffect, useRef } from 'react'
import { AUTH_SESSION_COOKIE } from '@/lib/auth-session-cookie'
import { useAuthStore } from '@/stores/auth.store'

function hasAuthSessionCookie() {
  if (typeof document === 'undefined') return false

  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${AUTH_SESSION_COOKIE}=1`)
}

export function AuthBootstrap() {
  const { user, fetchMe, hasHydrated } = useAuthStore()
  const hasBootstrappedRef = useRef(false)

  useEffect(() => {
    if (!hasHydrated || hasBootstrappedRef.current) return
    if (user || !hasAuthSessionCookie()) return

    hasBootstrappedRef.current = true
    void fetchMe()
  }, [fetchMe, hasHydrated, user])

  return null
}
