import { Metadata } from 'next'
import { PetList } from './_components/pet-list'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { PawPrint } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Thú cưng | Petshop',
  description: 'Quản lý thông tin thú cưng và liên kết với chủ sở hữu',
}

export default function PetsPage() {
  return (
    <PageContainer maxWidth="2xl">
      <PageHeader
        title="Thú cưng"
        description="Quản lý thông tin thú cưng và liên kết với chủ sở hữu"
        icon={PawPrint}
      />
      <PetList />
    </PageContainer>
  )
}
