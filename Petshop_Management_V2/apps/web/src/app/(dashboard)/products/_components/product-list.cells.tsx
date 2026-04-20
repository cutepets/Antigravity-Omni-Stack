import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PackageCheck } from 'lucide-react'

export function ImageCell({ image, size = 'md' }: { image?: string | null; size?: 'md' | 'sm' }) {
  const dimensions = size === 'sm' ? 'w-8 h-8 rounded-md' : 'w-10 h-10 rounded-lg'
  return image ? (
    <div className={`${dimensions} overflow-hidden flex-shrink-0 bg-background-secondary border border-border`}>
      <Image src={image} alt="" className="w-full h-full object-cover" width={400} height={400} unoptimized />
    </div>
  ) : (
    <div className={`${dimensions} flex items-center justify-center bg-background-secondary border border-border text-foreground-muted`}>
      <PackageCheck size={size === 'sm' ? 14 : 18} />
    </div>
  )
}

export function NameCell({
  name,
  href,
  meta,
  toggle,
  prefix,
  tone = 'product',
}: {
  name: string
  href?: string
  meta?: string | null
  toggle?: ReactNode
  prefix?: ReactNode
  tone?: 'product' | 'variant' | 'conversion'
}) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="w-4 flex-shrink-0 pt-1">{toggle}</div>
      <div className="flex items-start gap-2 min-w-0 flex-1">
        {prefix}
        <div className="min-w-0 flex-1">
          {href ? (
            <Link href={href} title={name} className="block truncate font-semibold text-foreground transition-colors hover:text-primary-500">
              {name}
            </Link>
          ) : (
            <div title={name} className={`truncate ${tone === 'product' ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
              {name}
            </div>
          )}
          {meta ? <div className="sr-only">{meta}</div> : null}
        </div>
      </div>
    </div>
  )
}
