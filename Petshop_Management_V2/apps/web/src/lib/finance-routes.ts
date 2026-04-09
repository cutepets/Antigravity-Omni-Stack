export function buildFinanceVoucherHref(voucherNumber: string) {
  return `/finance/${encodeURIComponent(voucherNumber)}`
}
