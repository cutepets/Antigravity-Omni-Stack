import type { Metadata } from 'next'
import { SessionDetailClient } from './session-detail-client'

export const metadata: Metadata = {
  title: 'Chi tiết phiếu kiểm kho | Petshop',
  description: 'Theo dõi tiến độ kiểm kho theo ca trong tuần',
}

export default function SessionDetailPage({ params }: { params: { sessionId: string } }) {
  return <SessionDetailClient sessionId={params.sessionId} />
}
