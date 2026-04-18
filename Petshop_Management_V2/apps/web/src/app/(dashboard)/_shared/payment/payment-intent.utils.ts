import type { OrderPaymentIntent } from '@/lib/api/order.api';
import { orderApi } from '@/lib/api/order.api';

export function buildOrderQrIntentStorageKey(orderNumber: string) {
  return `order-qr-intent-${orderNumber}`;
}

export function isPaidPaymentIntent(intent: OrderPaymentIntent | null | undefined) {
  return intent?.status === 'PAID';
}

export function isResumeablePaymentIntent(intent: OrderPaymentIntent | null | undefined) {
  return Boolean(intent && !isPaidPaymentIntent(intent));
}

export function resolvePaymentIntentForDisplay(
  activeIntent: OrderPaymentIntent | null,
  latestIntent: OrderPaymentIntent | null,
) {
  return latestIntent?.code === activeIntent?.code ? latestIntent : activeIntent;
}

export function readStoredPaymentIntent(storageKey: string) {
  if (typeof window === 'undefined') return null;

  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    const intent = JSON.parse(stored) as OrderPaymentIntent | null;
    if (isResumeablePaymentIntent(intent)) return intent;
  } catch {
    // Invalid cached payloads should not block the payment flow.
  }

  window.localStorage.removeItem(storageKey);
  return null;
}

export function writeStoredPaymentIntent(storageKey: string, intent: OrderPaymentIntent | null) {
  if (typeof window === 'undefined') return;

  if (!intent || isPaidPaymentIntent(intent)) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(intent));
}

export function clearStoredPaymentIntent(storageKey: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey);
}

export function createOrderQrPaymentIntent({
  orderId,
  paymentMethodId,
  amount,
}: {
  orderId: string;
  paymentMethodId: string;
  amount?: number;
}) {
  return orderApi.createPaymentIntent(orderId, { paymentMethodId, amount });
}
