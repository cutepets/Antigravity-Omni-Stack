'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/settings/branches').then((response) => response.data.data ?? response.data),
    staleTime: 60_000,
  });
}
