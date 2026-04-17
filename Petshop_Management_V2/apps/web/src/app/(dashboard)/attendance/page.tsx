'use client'

import { Suspense, useState } from 'react'
import { PageContainer } from '@/components/layout/PageLayout'
import { AttendanceView } from './_components/attendance-view'
import { ShiftScheduleMatrix } from '../schedule/_components/shift-schedule-matrix'
import { LeaveView } from '../leave/_components/leave-view'
import { Clock, CalendarDays, CalendarOff } from 'lucide-react'
import { clsx } from 'clsx'

const TABS = [
    { id: 'attendance', label: 'Chấm công', icon: Clock },
    { id: 'schedule', label: 'Ca làm việc', icon: CalendarDays },
    { id: 'leave', label: 'Xin nghỉ phép', icon: CalendarOff },
] as const

type TabId = typeof TABS[number]['id']

export default function AttendancePage() {
    const [activeTab, setActiveTab] = useState<TabId>('attendance')

    return (
        <PageContainer maxWidth="full" className="h-full! min-h-0! gap-0! overflow-hidden! py-4!">
            {/* Tab Header */}
            <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-2 pb-0">
                {TABS.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                                isActive
                                    ? 'text-primary-500'
                                    : 'text-foreground-muted hover:text-foreground-base',
                            )}
                        >
                            <Icon size={15} />
                            {tab.label}
                            {isActive && (
                                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-primary-500" />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Tab Content */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Suspense fallback={<div className="p-8 text-center text-foreground-muted">Đang tải...</div>}>
                    {activeTab === 'attendance' && <AttendanceView />}
                    {activeTab === 'schedule' && (
                        <div className="flex-1 overflow-auto p-4">
                            <ShiftScheduleMatrix />
                        </div>
                    )}
                    {activeTab === 'leave' && <LeaveView />}
                </Suspense>
            </div>
        </PageContainer>
    )
}
