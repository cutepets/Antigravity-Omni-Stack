import type { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import { EquipmentDetail } from '../_components/equipment-detail'

export const metadata: Metadata = {
  title: 'Chi tiết thiết bị',
}

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  return (
    <PageContainer maxWidth="full" className="!min-h-0 !gap-4">
      <EquipmentDetail code={code} />
    </PageContainer>
  )
}
