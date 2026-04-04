'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const ENTER_LABELS = ['lưu', 'xác nhận', 'đồng ý', 'thêm', 'cập nhật', 'hoàn tất']
const ESC_LABELS = ['hủy', 'đóng', 'thoát', 'quay lại']

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
}

function isTextEditable(element: HTMLElement | null) {
  if (!element) return false
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLInputElement) {
    const blockedTypes = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color'])
    return !blockedTypes.has(element.type)
  }
  return element.isContentEditable
}

function isEnterIgnoredTarget(element: HTMLElement | null) {
  if (!element) return false
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLSelectElement) return true
  if (element instanceof HTMLButtonElement) return true
  if (element instanceof HTMLAnchorElement) return true
  if (element.getAttribute('role') === 'combobox') return true
  return false
}

function getScopeElement(element: HTMLElement | null) {
  let current = element
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)
    if (
      current.hasAttribute('data-hotkey-scope') ||
      current.getAttribute('role') === 'dialog' ||
      current.getAttribute('aria-modal') === 'true' ||
      style.position === 'fixed'
    ) {
      return current
    }
    current = current.parentElement
  }
  return document.body
}

function findButtonByLabels(scope: HTMLElement, labels: string[]) {
  const candidates = Array.from(scope.querySelectorAll<HTMLElement>('button,[role="button"],a'))
    .filter((element) => isVisible(element) && !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true')

  return candidates.find((element) => {
    const text = (element.textContent || '').trim().toLowerCase()
    return labels.some((label) => text === label || text.startsWith(label))
  })
}

function findAction(scope: HTMLElement, action: 'enter' | 'esc') {
  const explicit = scope.querySelector<HTMLElement>(`[data-hotkey-${action}]`)
  if (explicit && isVisible(explicit)) return explicit
  return findButtonByLabels(scope, action === 'enter' ? ENTER_LABELS : ESC_LABELS)
}

export function GlobalKeyboardShortcuts() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (pathname.startsWith('/pos')) return

      const target = event.target instanceof HTMLElement ? event.target : null
      const scope = getScopeElement(target)

      if (event.key === 'Escape') {
        const action = findAction(scope, 'esc')
        if (action) {
          event.preventDefault()
          action.click()
          return
        }

        if (scope === document.body && !isTextEditable(target)) {
          router.back()
        }
        return
      }

      if (event.key !== 'Enter' || event.shiftKey || isEnterIgnoredTarget(target)) return

      const form = target?.closest('form')
      if (form) {
        event.preventDefault()
        ;(form as HTMLFormElement).requestSubmit()
        return
      }

      const action = scope !== document.body ? findAction(scope, 'enter') : null
      if (action) {
        event.preventDefault()
        action.click()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pathname, router])

  return null
}
