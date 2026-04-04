import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
    primaryColor: string
    isSidebarOpen: boolean
    setPrimaryColor: (color: string) => void
    toggleSidebar: () => void
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            primaryColor: '#10b981', // Default Tailwind emerald-500
            isSidebarOpen: true,
            setPrimaryColor: (color) => set({ primaryColor: color }),
            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
        }),
        {
            name: 'petshop-theme-storage',
        }
    )
)
