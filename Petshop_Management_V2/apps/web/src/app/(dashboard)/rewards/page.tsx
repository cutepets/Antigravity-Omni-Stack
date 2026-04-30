import { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { Gift, Star, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Thưởng phạt',
    description: 'Quản lý bảng thưởng phạt nhân viên',
}

export default function RewardsPage() {
    return (
        <PageContainer maxWidth="2xl">
            <PageHeader
                title="Bảng thưởng phạt"
                description="Ghi nhận thưởng, phạt và các khoản điều chỉnh cho nhân viên"
                icon={Gift}
            />

            {/* Placeholder section */}
            <div className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-border/50 bg-background-secondary px-6 py-20 shadow-sm">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
                    <Star size={40} />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-bold text-foreground-base">Tính năng đang phát triển</h2>
                    <p className="mt-2 max-w-sm text-sm text-foreground-muted">
                        Tính năng quản lý thưởng phạt sẽ được tích hợp với module Chấm công và Bảng lương trong các phiên bản tới.
                    </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                    <AlertCircle size={16} />
                    <span>Dự kiến ra mắt: Q3/2026</span>
                </div>
            </div>

            {/* Preview Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                    { label: 'Thưởng tháng', value: '--', color: 'text-success-600', bg: 'bg-success-500/10' },
                    { label: 'Phạt tháng', value: '--', color: 'text-error', bg: 'bg-error/10' },
                    { label: 'Tổng điều chỉnh', value: '--', color: 'text-primary-500', bg: 'bg-primary-500/10' },
                ].map((card) => (
                    <div key={card.label} className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-background-secondary p-5 shadow-sm">
                        <p className="text-sm text-foreground-muted">{card.label}</p>
                        <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                        <div className={`h-1.5 w-12 rounded-full ${card.bg}`} />
                    </div>
                ))}
            </div>
        </PageContainer>
    )
}
