export function TransactionBadge({ type }: { type: string }) {
  const className =
    type === 'INCOME'
      ? 'border-emerald-500/20 bg-emerald-500/12 text-emerald-400'
      : 'border-rose-500/20 bg-rose-500/12 text-rose-400'

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{type === 'INCOME' ? 'Thu' : 'Chi'}</span>
}

export function SourceBadge({ source }: { source: string }) {
  const palette: Record<string, string> = {
    MANUAL: 'border-sky-500/20 bg-sky-500/12 text-sky-300',
    ORDER_PAYMENT: 'border-amber-500/20 bg-amber-500/12 text-amber-300',
    STOCK_RECEIPT: 'border-violet-500/20 bg-violet-500/12 text-violet-300',
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${palette[source] ?? 'border-border bg-white/5 text-foreground-muted'}`}>
      {source}
    </span>
  )
}
