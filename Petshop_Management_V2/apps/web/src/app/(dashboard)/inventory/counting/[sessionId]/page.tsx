import { use } from 'react'
import type { Metadata } from 'next'
import { SessionDetailClient } from './session-detail-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Chi tiết kiểm kho',
  description: 'Theo dõi tiến độ kiểm kho theo ca trong tuần',
}

export default function SessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const resolvedParams = use(params)
  return <SessionDetailClient sessionId={resolvedParams.sessionId} />
}
