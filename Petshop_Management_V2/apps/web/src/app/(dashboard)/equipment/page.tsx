import type { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import { EquipmentWorkspace } from './_components/equipment-workspace'

export const metadata: Metadata = {
  title: 'Thiết bị',
  description: 'Quản lý trang thiết bị công ty',
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>
}) {
  const { draft } = await searchParams

  return (
    <PageContainer maxWidth="full" className="!min-h-0 !gap-4">
      <EquipmentWorkspace initialDraftCode={draft} />
    </PageContainer>
  )
}
