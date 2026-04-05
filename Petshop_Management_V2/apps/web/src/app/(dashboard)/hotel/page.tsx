import type { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import HotelWorkspace from './components/HotelWorkspace'

export const metadata: Metadata = {
  title: 'Pet Hotel | Petshop',
  description: 'Điều phối lưu trú, check-in, checkout và bảng giá hotel',
}

export default function HotelPage() {
  return (
    <PageContainer maxWidth="full" className="!h-full !min-h-0 !gap-0 !overflow-hidden !py-4">
      <HotelWorkspace />
    </PageContainer>
  )
}
