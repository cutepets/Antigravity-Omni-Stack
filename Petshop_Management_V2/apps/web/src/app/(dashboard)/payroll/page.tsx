import { Metadata } from 'next'
import { Suspense } from 'react'
import { PageContainer } from '@/components/layout/PageLayout'

export const metadata: Metadata = {
    title: '💰 Bảng lương',
    description: 'Quản lý bảng lương nhân viên',
}

import { PayrollView } from './_components/payroll-view'

export default function PayrollPage() {
    return (
        <Suspense fallback={<div>Đang tải...</div>}>
            <PageContainer maxWidth="full" className="h-full! min-h-0! gap-0! overflow-hidden! py-4!">
                <PayrollView />
            </PageContainer>
        </Suspense>
    )
}
