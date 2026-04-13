import { Metadata } from 'next'
import { CountingDashboard } from './_components/counting-dashboard'

export const metadata: Metadata = {
  title: 'Kiểm kho | Petshop',
  description: 'Quản lý kiểm kho theo ca hàng tuần',
}

export default function CountingPage() {
  return (
    <>
      <CountingDashboard />
    </>
  )
}
