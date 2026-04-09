import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AnimConfig {
  enabled: boolean
  durationMs: number
}

export interface AnimationState {
  /** Hiệu ứng chuyển trang/tab: fadeIn, slideIn trên content  */
  pageTransition: AnimConfig
  /** Hiệu ứng mở modal/drawer: zoom-in, fade-in */
  modalAnimation: AnimConfig
  /** Hiệu ứng hover: transition-colors, transition-all */
  hoverEffect: AnimConfig
  /** Hiệu ứng chuyển giao diện: body background-color transition */
  themeTransition: AnimConfig

  setAnim: (key: keyof Omit<AnimationState, 'setAnim'>, patch: Partial<AnimConfig>) => void
}

export const useAnimationStore = create<AnimationState>()(
  persist(
    (set) => ({
      pageTransition:  { enabled: true, durationMs: 300 },
      modalAnimation:  { enabled: true, durationMs: 200 },
      hoverEffect:     { enabled: true, durationMs: 150 },
      themeTransition: { enabled: true, durationMs: 500 },

      setAnim: (key, patch) =>
        set((s) => ({ [key]: { ...s[key as keyof typeof s] as AnimConfig, ...patch } })),
    }),
    { name: 'petshop-animation-storage' },
  ),
)
