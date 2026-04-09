import { Metadata } from 'next'
import { PetList } from './_components/pet-list'
import { PageContainer } from '@/components/layout/PageLayout'

export const metadata: Metadata = {
  title: 'Thú cưng | Petshop',
  description: 'Quản lý thông tin thú cưng và liên kết với chủ sở hữu',
}

export default function PetsPage() {
  return (
    <PageContainer maxWidth="full" className="!h-full !min-h-0 !gap-0 !overflow-hidden !py-4">
      <PetList />
    </PageContainer>
  )
}
