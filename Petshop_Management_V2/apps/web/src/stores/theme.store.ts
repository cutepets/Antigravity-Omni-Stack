import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
    primaryColor: string
    setPrimaryColor: (color: string) => void
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            primaryColor: '#10b981', // Default Tailwind emerald-500
            setPrimaryColor: (color) => set({ primaryColor: color }),
        }),
        {
            name: 'petshop-theme-storage',
        }
    )
)
