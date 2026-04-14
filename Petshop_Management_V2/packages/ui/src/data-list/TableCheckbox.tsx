import React from 'react'
import { Check } from 'lucide-react'

interface TableCheckboxProps {
  checked: boolean
  onCheckedChange?: (checked: boolean, shiftKey: boolean) => void
  size?: 'sm' | 'md'
  readOnly?: boolean
}

export function TableCheckbox({
  checked,
  onCheckedChange,
  size = 'sm',
  readOnly = false,
}: TableCheckboxProps) {
  const boxSize = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  const iconSize = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (readOnly) return

    if (e.shiftKey) {
      window.getSelection()?.removeAllRanges()
    }

    if (onCheckedChange) {
      onCheckedChange(!checked, e.shiftKey)
    }
  }

  return (
    <label 
      className={`relative inline-flex ${boxSize} ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
      onClick={handleClick}
      onDoubleClick={(e) => { e.preventDefault() }}
    >
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="peer sr-only"
        tabIndex={-1}
      />
      <span className="h-full w-full rounded border border-border bg-background-secondary shadow-inner shadow-black/10 transition-colors peer-checked:border-primary-500 peer-checked:bg-primary-500/90 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/50" />
      <Check className={`pointer-events-none absolute inset-0 m-auto ${iconSize} text-white opacity-0 transition-opacity peer-checked:opacity-100`} />
    </label>
  )
}