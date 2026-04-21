'use client'

import type { AuthUser, BaseBranch, PosPreferences } from '@petshop/shared'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, authApi } from '@/lib/api'
import { clearAuthSessionCookie, setAuthSessionCookie } from '@/lib/auth-session-cookie'

type AuthState = {
  user: AuthUser | null
  allowedBranches: BaseBranch[]
  activeBranchId: string | null
  error: string | null
  isLoading: boolean
  hasHydrated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<AuthUser | null>
  switchBranch: (branchId: string | null | undefined, persist?: boolean) => void
  updatePosPreferences: (prefs: Partial<PosPreferences>) => Promise<void>
  clearError: () => void
  setHydrated: (value: boolean) => void
}

function normalizeAllowedBranches(user: AuthUser | null) {
  return user?.authorizedBranches ?? []
}

function resolveActiveBranchId(user: AuthUser | null, currentBranchId?: string | null) {
  const allowedBranches = normalizeAllowedBranches(user)

  // Ưu tiên: currentBranchId > defaultBranchId từ DB > branchId gốc > branch đầu tiên
  const candidates = [currentBranchId, user?.defaultBranchId, user?.branchId]
  for (const id of candidates) {
    if (id && allowedBranches.some((branch) => branch.id === id)) return id
  }

  return allowedBranches[0]?.id ?? null
}

function buildAuthState(user: AuthUser | null, currentBranchId?: string | null) {
  const allowedBranches = normalizeAllowedBranches(user)
  return {
    user,
    allowedBranches,
    activeBranchId: resolveActiveBranchId(user, currentBranchId),
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      allowedBranches: [],
      activeBranchId: null,
      error: null,
      isLoading: false,
      hasHydrated: false,

      async login(username, password) {
        set({ isLoading: true, error: null })

        try {
          const response = await authApi.login(username, password)
          setAuthSessionCookie()
          // Ưu tiên defaultBranchId từ DB khi login
          set({
            ...buildAuthState(response.user, response.user.defaultBranchId ?? get().activeBranchId),
            isLoading: false,
            error: null,
            hasHydrated: true,
          })
        } catch (error: any) {
          clearAuthSessionCookie()
          set({
            isLoading: false,
            error: error?.response?.data?.message ?? error?.message ?? 'Đăng nhập thất bại',
          })
          throw error
        }
      },

      async logout() {
        set({ isLoading: true })

        try {
          await authApi.logout()
        } finally {
          clearAuthSessionCookie()
          set({
            user: null,
            allowedBranches: [],
            activeBranchId: null,
            error: null,
            isLoading: false,
            hasHydrated: true,
          })
        }
      },

      async fetchMe() {
        set({ isLoading: true, error: null })

        try {
          const user = await authApi.me()
          setAuthSessionCookie()
          // Ưu tiên defaultBranchId từ DB, fallback sang activeBranchId hiện tại
          set({
            ...buildAuthState(user, user.defaultBranchId ?? get().activeBranchId),
            isLoading: false,
            error: null,
            hasHydrated: true,
          })
          return user
        } catch (error: any) {
          clearAuthSessionCookie()
          set({
            user: null,
            allowedBranches: [],
            // Giữ lại activeBranchId đã chọn thay vì reset null
            isLoading: false,
            error: error?.response?.status === 401 ? null : error?.response?.data?.message ?? error?.message ?? null,
            hasHydrated: true,
          })
          return null
        }
      },

      switchBranch(branchId, persistToDB = true) {
        const nextBranchId = branchId ?? null
        const allowedBranches = get().allowedBranches

        if (nextBranchId && !allowedBranches.some((branch) => branch.id === nextBranchId)) {
          return
        }

        set({ activeBranchId: nextBranchId, error: null })

        // Lưu lên DB nền (fire & forget)
        if (persistToDB) {
          api.patch('/auth/default-branch', { branchId: nextBranchId }).catch(() => {
            // Không block UI nếu lưu DB thất bại
          })
        }
      },

      async updatePosPreferences(prefs) {
        try {
          await api.patch('/auth/preferences', prefs)
          // Cập nhật local user object
          const user = get().user
          if (user) {
            set({ user: { ...user, posPreferences: { ...user.posPreferences, ...prefs } } })
          }
        } catch {
          // Không block UI
        }
      },

      clearError() {
        set({ error: null })
      },

      setHydrated(value) {
        set({ hasHydrated: value })
      },
    }),
    {
      name: 'petshop-auth-store',
      partialize: (state) => ({
        user: state.user,
        allowedBranches: state.allowedBranches,
        activeBranchId: state.activeBranchId,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!state) return

        if (error) {
          state.setHydrated(true)
          return
        }

        const normalized = buildAuthState(state.user, state.activeBranchId)
        state.switchBranch(normalized.activeBranchId, false) // false = không gọi API khi rehydrate
        state.setHydrated(true)
      },
    },
  ),
)
