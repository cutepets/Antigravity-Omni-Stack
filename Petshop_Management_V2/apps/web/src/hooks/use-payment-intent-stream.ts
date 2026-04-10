'use client'

import { useEffect, useState } from 'react'
import type { OrderPaymentIntent } from '@/lib/api/order.api'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

type PaymentIntentStreamState = {
  latestIntent: OrderPaymentIntent | null
  lastEvent: 'snapshot' | 'paid' | null
  connected: boolean
}

function parseStreamIntent(event: MessageEvent) {
  try {
    const payload = JSON.parse(event.data) as { intent?: OrderPaymentIntent | null }
    return payload.intent ?? null
  } catch {
    return null
  }
}

export function usePaymentIntentStream(code?: string | null, enabled = true) {
  const [state, setState] = useState<PaymentIntentStreamState>({
    latestIntent: null,
    lastEvent: null,
    connected: false,
  })

  useEffect(() => {
    if (!enabled || !code || typeof window === 'undefined') {
      setState({
        latestIntent: null,
        lastEvent: null,
        connected: false,
      })
      return
    }

    const stream = new EventSource(
      `${API_URL}/api/payment-intents/${encodeURIComponent(code)}/stream`,
      { withCredentials: true },
    )

    const handleSnapshot = (event: MessageEvent) => {
      const intent = parseStreamIntent(event)
      if (!intent) return

      setState({
        latestIntent: intent,
        lastEvent: 'snapshot',
        connected: true,
      })
    }

    const handlePaid = (event: MessageEvent) => {
      const intent = parseStreamIntent(event)
      if (!intent) return

      setState({
        latestIntent: intent,
        lastEvent: 'paid',
        connected: true,
      })
    }

    const handleError = () => {
      setState((current) => ({
        ...current,
        connected: false,
      }))
    }

    stream.addEventListener('snapshot', handleSnapshot as EventListener)
    stream.addEventListener('paid', handlePaid as EventListener)
    stream.onerror = handleError

    return () => {
      stream.removeEventListener('snapshot', handleSnapshot as EventListener)
      stream.removeEventListener('paid', handlePaid as EventListener)
      stream.close()
    }
  }, [code, enabled])

  return state
}
