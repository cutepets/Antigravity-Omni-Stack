import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

// Page Container - The root wrapper for a page, keeping consistent max-width and padding
interface PageContainerProps {
  children: ReactNode
  className?: string
  maxWidth?: 'lg' | 'xl' | '2xl' | 'full'
  variant?: 'default' | 'data-list'
}

const maxWidthMap = {
  lg: 'w-full max-w-[1024px]',
  xl: 'w-full max-w-[1280px]',
  '2xl': 'w-full max-w-[1400px]',
  full: 'w-full'
}

export function PageContainer({ children, className, maxWidth = 'full', variant = 'default' }: PageContainerProps) {
  return (
    <div
      className={cn(
        "flex min-h-full w-full flex-col gap-4",
        maxWidthMap[maxWidth],
        variant === 'data-list' && 'h-full min-h-0 gap-0 overflow-hidden py-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

// Page Header
interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2", className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="text-primary-500 bg-primary-500/10 p-2.5 rounded-xl border border-primary-500/20 shrink-0">
            <Icon size={26} />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground-base tracking-tight">{title}</h1>
          {description && (
            <p className="text-foreground-secondary text-sm mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}

// Page Content Block - Usually what wraps cards or forms (like the transparent subtle backgrounds)
interface PageContentProps {
  children: ReactNode
  className?: string
}

export function PageContent({ children, className }: PageContentProps) {
  return (
    <div className={cn("rounded-3xl p-6 lg:p-8 bg-background-secondary border border-border/50 shadow-sm relative overflow-hidden", className)}>
      {children}
    </div>
  )
}
