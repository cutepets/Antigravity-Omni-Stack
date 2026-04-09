import React from 'react'

export interface ReceiptWorkspaceProps {
  children?: React.ReactNode
}

export function ReceiptWorkspace({ children }: ReceiptWorkspaceProps) {
  return (
    <div
      className="-mx-6 -mt-2 -mb-6 flex h-[calc(100vh-56px)] flex-col overflow-hidden rounded-[24px] border border-border/70 bg-background shadow-[0_30px_80px_-45px_rgba(15,23,42,0.65)]"
    >
      {children}
    </div>
  )
}
