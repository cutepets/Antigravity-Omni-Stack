'use client'

import { useEffect } from 'react'
import { useAnimationStore } from '@/stores/animation.store'

/**
 * Reads animation settings from Zustand store and injects CSS custom
 * properties onto <html> so all animations respect the user's preferences.
 *
 * CSS variables applied:
 *   --dur-page   → page/tab fade-in, slide-in
 *   --dur-modal  → modal / drawer zoom-in, slide-in-right
 *   --dur-hover  → transition-colors, transition-all on interactive elements
 *   --dur-theme  → body background-color transition (dark/light switch)
 */
export function AnimationProvider() {
  const { pageTransition, modalAnimation, hoverEffect, themeTransition } =
    useAnimationStore()

  useEffect(() => {
    const root = document.documentElement

    root.style.setProperty(
      '--dur-page',
      pageTransition.enabled ? `${pageTransition.durationMs}ms` : '0ms',
    )
    root.style.setProperty(
      '--dur-modal',
      modalAnimation.enabled ? `${modalAnimation.durationMs}ms` : '0ms',
    )
    root.style.setProperty(
      '--dur-hover',
      hoverEffect.enabled ? `${hoverEffect.durationMs}ms` : '0ms',
    )
    root.style.setProperty(
      '--dur-theme',
      themeTransition.enabled ? `${themeTransition.durationMs}ms` : '0ms',
    )
  }, [pageTransition, modalAnimation, hoverEffect, themeTransition])

  return null
}
