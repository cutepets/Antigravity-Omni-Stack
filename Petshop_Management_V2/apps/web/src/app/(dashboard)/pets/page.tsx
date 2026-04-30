import { Metadata } from 'next'
import { PetList } from './_components/pet-list'
import { PageContainer } from '@/components/layout/PageLayout'

export const metadata: Metadata = {
  title: 'Thú cưng',
  description: 'Quản lý thông tin thú cưng và liên kết với chủ sở hữu',
}

export default function PetsPage() {
  return (
    <PageContainer maxWidth="full" variant="data-list">
      <PetList />
    </PageContainer>
  )
}
