import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '@petshop/shared'
import { authApi } from '@/lib/api'
import type { BaseBranch } from '@petshop/shared'

interface AuthState {
  user: AuthUser | null
  activeBranchId: string | null
  allowedBranches: BaseBranch[]
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  clearError: () => void
  setUser: (user: AuthUser) => void
  switchBranch: (branchId: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      activeBranchId: null,
      allowedBranches: [],
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (username, password) => {
        set({ isLoading: true, error: null })
        try {
          const data = await authApi.login(username, password)
          if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', data.accessToken)
            localStorage.setItem('refresh_token', data.refreshToken)
            document.cookie = `access_token=${data.accessToken}; path=/; max-age=86400; SameSite=Lax`
          }
          const activeBranchId = get().activeBranchId
          const isAllowed = data.user.authorizedBranches?.find((b: BaseBranch) => b.id === activeBranchId)
          
          set({ 
            user: data.user, 
            allowedBranches: data.user.authorizedBranches || [],
            activeBranchId: isAllowed ? activeBranchId : (data.user.branchId || data.user.authorizedBranches?.[0]?.id || null),
            isAuthenticated: true, 
            isLoading: false 
          })
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Đăng nhập thất bại'
          set({ error: msg, isLoading: false, isAuthenticated: false })
          throw err
        }
      },

      logout: async () => {
        const refreshToken = typeof window !== 'undefined'
          ? localStorage.getItem('refresh_token')
          : null

        if (refreshToken) {
          try {
            await authApi.logout(refreshToken)
          } catch {
            // silent — logout locally regardless
          }
        }

        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        }

        set({ user: null, activeBranchId: null, allowedBranches: [], isAuthenticated: false })
      },

      fetchMe: async () => {
        set({ isLoading: true })
        try {
          const user = await authApi.me()
          const activeBranchId = get().activeBranchId
          const isAllowed = user.authorizedBranches?.find((b: BaseBranch) => b.id === activeBranchId)
          
          set({ 
            user, 
            allowedBranches: user.authorizedBranches || [],
            activeBranchId: isAllowed ? activeBranchId : (user.branchId || user.authorizedBranches?.[0]?.id || null),
            isAuthenticated: true, 
            isLoading: false 
          })
        } catch {
          set({ user: null, activeBranchId: null, allowedBranches: [], isAuthenticated: false, isLoading: false })
        }
      },

      clearError: () => set({ error: null }),
      setUser: (user) => set({ user, isAuthenticated: true }),
      switchBranch: (branchId: string) => {
        set({ activeBranchId: branchId })
        // You might want to trigger a layout reload or event here.
      }
    }),
    {
      name: 'petshop-auth',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated,
        activeBranchId: state.activeBranchId,
        allowedBranches: state.allowedBranches
      }),
    },
  ),
)
