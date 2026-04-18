'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { shiftApi } from '@/lib/api/shift.api';
import { useAuthStore } from '@/stores/auth.store';

export function usePosShiftGuard() {
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const [showShiftClosingModal, setShowShiftClosingModal] = useState(false);

  const currentShiftQuery = useQuery({
    queryKey: ['shifts', 'current', activeBranchId],
    queryFn: () => shiftApi.current(),
    enabled: Boolean(activeBranchId),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!currentShiftQuery.isFetched) return;
    if (!currentShiftQuery.data) {
      setShowShiftClosingModal(true);
    }
  }, [currentShiftQuery.data, currentShiftQuery.isFetched]);

  const openShiftClosingModal = useCallback(() => {
    setShowShiftClosingModal(true);
  }, []);

  const closeShiftClosingModal = useCallback(() => {
    setShowShiftClosingModal(false);
  }, []);

  const handleShiftSaved = useCallback(() => {
    void currentShiftQuery.refetch();
  }, [currentShiftQuery]);

  return {
    currentShift: currentShiftQuery.data ?? null,
    showShiftClosingModal,
    openShiftClosingModal,
    closeShiftClosingModal,
    handleShiftSaved,
  };
}
