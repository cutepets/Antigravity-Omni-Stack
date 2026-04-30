import { Metadata } from 'next'
import { Suspense } from 'react'
import { PageContainer } from '@/components/layout/PageLayout'

export const metadata: Metadata = {
    title: 'Lịch phân ca',
    description: 'Sắp xếp lịch làm việc của nhân viên',
}

import { ShiftScheduleMatrix } from './_components/shift-schedule-matrix'

export default function SchedulePage() {
    return (
        <Suspense fallback={<div>Đang tải...</div>}>
            <PageContainer maxWidth="full" className="h-full! min-h-0! gap-0! overflow-hidden!">
                <ShiftScheduleMatrix />
            </PageContainer>
        </Suspense>
    )
}
