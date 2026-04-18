'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderPaymentIntent } from '@/lib/api/order.api';
import { usePaymentIntentStream } from '@/hooks/use-payment-intent-stream';
import {
  clearStoredPaymentIntent,
  readStoredPaymentIntent,
  resolvePaymentIntentForDisplay,
  writeStoredPaymentIntent,
} from './payment-intent.utils';

type UsePaymentIntentSessionOptions = {
  storageKey?: string | null;
  streamEnabled?: boolean;
  onPaid?: (intent: OrderPaymentIntent) => void;
};

export function usePaymentIntentSession({
  storageKey,
  streamEnabled = true,
  onPaid,
}: UsePaymentIntentSessionOptions = {}) {
  const [activeIntent, setActiveIntent] = useState<OrderPaymentIntent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasResumeIntent, setHasResumeIntent] = useState(false);
  const handledPaidCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!storageKey) {
      setHasResumeIntent(false);
      setActiveIntent(null);
      return;
    }

    const storedIntent = readStoredPaymentIntent(storageKey);
    if (!storedIntent) {
      setHasResumeIntent(false);
      setActiveIntent(null);
      return;
    }

    setActiveIntent(storedIntent);
    setHasResumeIntent(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !activeIntent) return;

    writeStoredPaymentIntent(storageKey, activeIntent);
    if (activeIntent?.status === 'PAID') {
      setHasResumeIntent(false);
    }
  }, [activeIntent, storageKey]);

  const stream = usePaymentIntentStream(
    activeIntent?.code,
    streamEnabled && isModalOpen && Boolean(activeIntent?.code),
  );

  useEffect(() => {
    if (!stream.latestIntent || !activeIntent) return;
    if (stream.latestIntent.code !== activeIntent.code) return;

    setActiveIntent(stream.latestIntent);

    if (stream.lastEvent !== 'paid') return;
    if (handledPaidCodeRef.current === stream.latestIntent.code) return;

    handledPaidCodeRef.current = stream.latestIntent.code;
    onPaid?.(stream.latestIntent);
  }, [activeIntent, onPaid, stream.lastEvent, stream.latestIntent]);

  const openIntent = useCallback((intent: OrderPaymentIntent) => {
    handledPaidCodeRef.current = null;
    setActiveIntent(intent);
    setHasResumeIntent(false);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const clearIntent = useCallback(() => {
    if (storageKey) {
      clearStoredPaymentIntent(storageKey);
    }

    handledPaidCodeRef.current = null;
    setActiveIntent(null);
    setHasResumeIntent(false);
  }, [storageKey]);

  const displayedIntent = resolvePaymentIntentForDisplay(activeIntent, stream.latestIntent);

  return {
    activeIntent,
    setActiveIntent,
    displayedIntent,
    isModalOpen,
    setIsModalOpen,
    openIntent,
    closeModal,
    clearIntent,
    hasResumeIntent,
    setHasResumeIntent,
    stream,
  };
}
