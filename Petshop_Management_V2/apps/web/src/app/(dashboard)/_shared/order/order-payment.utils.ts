import type { PaymentMethod } from '@/lib/api/settings.api'
import { filterVisiblePaymentMethods } from '@/lib/payment-methods'

type ResolveVisibleOrderPaymentMethodsParams = {
  branchId?: string | null
  paidAmount?: number | null
  selectedId?: string | null
  total: number
}

export function calculateOrderRemainingAmount(total: number, paidAmount = 0) {
  return Math.max(0, Number(total || 0) - Number(paidAmount || 0))
}

export function resolveOrderPaymentCollectionAmount({
  total,
  paidAmount = 0,
}: Pick<ResolveVisibleOrderPaymentMethodsParams, 'total' | 'paidAmount'>) {
  const remainingAmount = calculateOrderRemainingAmount(total, paidAmount ?? 0)
  return remainingAmount > 0 ? remainingAmount : Math.max(0, Number(total || 0))
}

export function resolveVisibleOrderPaymentMethods(
  methods: PaymentMethod[],
  params: ResolveVisibleOrderPaymentMethodsParams,
) {
  return filterVisiblePaymentMethods(methods, {
    branchId: params.branchId,
    amount: resolveOrderPaymentCollectionAmount(params),
    selectedId: params.selectedId,
  })
}
