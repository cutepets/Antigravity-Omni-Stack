import { Metadata } from 'next'
import { Suspense } from 'react'
import { PageContainer } from '@/components/layout/PageLayout'

export const metadata: Metadata = {
    title: '🏖️ Nghỉ phép',
    description: 'Quản lý yêu cầu nghỉ phép của nhân viên',
}

import { LeaveView } from './_components/leave-view'

export default function LeavePage() {
    return (
        <Suspense fallback={<div>Đang tải...</div>}>
            <PageContainer maxWidth="full" className="h-full! min-h-0! gap-0! overflow-hidden!">
                <LeaveView />
            </PageContainer>
        </Suspense>
    )
}
