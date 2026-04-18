'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCustomerPets(customerId: string | undefined) {
  return useQuery({
    queryKey: ['pets', 'customer', customerId],
    queryFn: () =>
      api.get('/pets', { params: { customerId } }).then((response) => response.data.data ?? response.data),
    enabled: Boolean(customerId),
  });
}
