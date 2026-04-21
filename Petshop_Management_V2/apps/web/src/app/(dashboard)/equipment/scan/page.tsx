import type { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import { EquipmentScanView } from '../_components/equipment-scan-view'

export const metadata: Metadata = {
  title: 'Quét thiết bị | Petshop',
}

export default function EquipmentScanPage() {
  return (
    <PageContainer maxWidth="full" className="!min-h-0 !gap-4">
      <EquipmentScanView />
    </PageContainer>
  )
}
