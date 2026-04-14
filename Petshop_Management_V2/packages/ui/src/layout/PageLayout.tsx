import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface PageContainerProps {
  children: ReactNode
  className?: string
  maxWidth?: 'lg' | 'xl' | '2xl' | 'full'
}

const maxWidthMap = {
  lg: 'max-w-[1024px]',
  xl: 'max-w-[1280px]',
  '2xl': 'max-w-[1400px]',
  full: 'w-full'
}

export function PageContainer({ children, className, maxWidth = '2xl' }: PageContainerProps) {
  return (
    <div className={cn("flex flex-col gap-6 w-full mx-auto py-8 px-6 lg:px-8 bg-background-base min-h-full", maxWidthMap[maxWidth], className)}>
      {children}
    </div>
  )
}

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
