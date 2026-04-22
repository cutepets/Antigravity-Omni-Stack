import { cn } from '@/lib/utils'
import { normalizeCurrencyInput } from './pricing-helpers'

export function PriceInput({
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(normalizeCurrencyInput(event.target.value))}
      placeholder={placeholder ?? '0'}
      inputMode="numeric"
      disabled={disabled}
      className={cn(
        'h-11 w-full min-w-[70px] rounded-xl border bg-background-base px-3 text-right text-sm font-bold tabular-nums text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-70',
        value ? 'border-border' : 'border-amber-500/35 bg-amber-500/5',
      )}
    />
  )
}
