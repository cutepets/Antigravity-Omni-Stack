export function buildFinanceVoucherHref(voucherNumber: string) {
  return `/finance?voucher=${encodeURIComponent(voucherNumber)}`
}
