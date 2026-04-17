'use client'

import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payrollApi } from '@/lib/api/payroll.api'
import { Calculator, Eye, Plus, FileText, CheckCircle2, Loader2 } from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import {
    DataListShell,
    DataListToolbar,
    DataListTable,
} from '@petshop/ui/data-list'
import { PayrollPeriodForm } from './payroll-period-form'
import { PayrollSlipDetail } from './payroll-slip-detail'

export function PayrollView() {
    const queryClient = useQueryClient()
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
    const [isPeriodFormOpen, setIsPeriodFormOpen] = useState(false)
    const [detailSlipId, setDetailSlipId] = useState<string | null>(null)

    // Load Periods
    const { data: periods = [], isLoading: isLoadingPeriods } = useQuery({
        queryKey: ['payroll-periods'],
        queryFn: payrollApi.listPeriods,
    })

    // Auto-select first period
    useEffect(() => {
        if (periods.length > 0 && !selectedPeriodId) {
            setSelectedPeriodId(periods[0].id)
        }
    }, [periods, selectedPeriodId])

    const activePeriod = useMemo(() => periods.find((p) => p.id === selectedPeriodId), [periods, selectedPeriodId])

    // Load Slips
    const { data: slips = [], isLoading: isLoadingSlips } = useQuery({
        queryKey: ['payroll-slips', selectedPeriodId],
        queryFn: () => payrollApi.listSlips({ periodId: selectedPeriodId }),
        enabled: !!selectedPeriodId,
    })

    // Calculate Mutation
    const calculateMutation = useMutation({
        mutationFn: () => payrollApi.calculate({ periodId: selectedPeriodId }),
        onSuccess: (data) => {
            toast.success(`Đã tính lương xong cho ${data.count} nhân sự`)
            queryClient.invalidateQueries({ queryKey: ['payroll-slips', selectedPeriodId] })
            queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
        },
        onError: () => toast.error('Lỗi khi tính lương'),
    })

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)

    if (isLoadingPeriods) {
        return <div className="p-8 text-center text-foreground-muted">Đang tải danh sách kỳ lương...</div>
    }

    return (
        <div className="flex h-full flex-col gap-4">
            {/* Header / Period Selector */}
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold">Bảng lương &amp; Thu nhập</h2>
                        <p className="text-xs text-foreground-muted">Quản lý lương, thưởng và khấu trừ nhân viên</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={selectedPeriodId}
                        onChange={(e) => setSelectedPeriodId(e.target.value)}
                        className="form-select h-10 w-[260px] rounded-xl border border-border bg-background px-3 text-sm font-medium"
                    >
                        <option value="">Chọn kỳ lương...</option>
                        {periods.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name} ({new Date(p.startDate).toLocaleDateString('vi-VN')} - {new Date(p.endDate).toLocaleDateString('vi-VN')})
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={() => setIsPeriodFormOpen(true)}
                        className="flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-background-secondary transition-colors"
                    >
                        <Plus size={15} /> Tạo kỳ lương
                    </button>
                </div>
            </div>

            {/* Main Content */}
            {selectedPeriodId ? (
                <DataListShell className="flex-1">
                    <DataListToolbar
                        searchValue={''}
                        onSearchChange={() => { }}
                        searchPlaceholder="Tìm nhân viên..."
                        extraActions={
                            <>
                                {slips.length === 0 && activePeriod?.status === 'DRAFT' && (
                                    <button
                                        type="button"
                                        onClick={() => calculateMutation.mutate()}
                                        disabled={calculateMutation.isPending}
                                        className="flex h-11 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
                                    >
                                        {calculateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}
                                        {calculateMutation.isPending ? 'Đang tính...' : 'Tính lương tự động'}
                                    </button>
                                )}
                                {slips.length > 0 && activePeriod?.status !== 'CLOSED' && (
                                    <button
                                        type="button"
                                        onClick={() => calculateMutation.mutate()}
                                        disabled={calculateMutation.isPending}
                                        className="flex h-11 items-center gap-2 rounded-xl border border-primary-500/20 bg-primary-500/10 px-4 text-sm font-semibold text-primary-600 hover:bg-primary-500/20 transition-colors disabled:opacity-50"
                                    >
                                        {calculateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}
                                        Cập nhật lại lương
                                    </button>
                                )}
                            </>
                        }
                    />

                    {slips.length === 0 && !isLoadingSlips ? (
                        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center text-foreground-muted animate-in fade-in">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-background-secondary">
                                <Calculator className="h-6 w-6" />
                            </div>
                            <h3 className="mt-4 text-base font-semibold text-foreground">Bạn chưa tính lương cho kỳ này</h3>
                            <p className="mt-2 max-w-sm text-sm">
                                Hệ thống sẽ tự động tổng hợp số ngày công, hoa hồng, thưởng phạt để tính ra thu nhập thực nhận.
                            </p>
                            <button
                                type="button"
                                className="mt-6 flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
                                onClick={() => calculateMutation.mutate()}
                                disabled={calculateMutation.isPending}
                            >
                                {calculateMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                                Bắt đầu tính lương
                            </button>
                        </div>
                    ) : (
                        <DataListTable
                            columns={[
                                { id: 'staff' as any, label: 'Nhân viên', minWidth: 'min-w-[180px]' },
                                { id: 'workDays' as any, label: 'Ngày công', width: 'w-24' },
                                { id: 'income' as any, label: 'Lương & HH', width: 'w-32' },
                                { id: 'deductions' as any, label: 'Giảm trừ', width: 'w-32' },
                                { id: 'net' as any, label: 'Thực nhận', width: 'w-32' },
                                { id: 'status' as any, label: 'Trạng thái', width: 'w-32' },
                                { id: 'actions' as any, label: '', width: 'w-16' },
                            ]}
                            isLoading={isLoadingSlips}
                            isEmpty={!isLoadingSlips && slips.length === 0}
                            emptyText="Không có bảng lương nào"
                        >
                            {slips.map((s: any) => (
                                <tr key={s.id} className="border-b border-border/50 hover:bg-background-secondary/30 transition-colors">
                                    <td className="px-4 py-3 min-w-[180px]">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-600 font-bold text-sm">
                                                {s.staff?.fullName?.charAt(0) || 'U'}
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-semibold">{s.staff?.fullName || s.staffId}</span>
                                                <span className="text-xs text-foreground-muted">{s.staff?.staffCode || s.staffId}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 w-24">
                                        <span className="inline-flex items-center rounded-lg bg-background-secondary px-2 py-1 text-xs font-semibold">
                                            {s.actualWorkDays} ngày
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 w-32">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-bold text-primary-600">{formatCurrency(s.grossSalary)}</span>
                                            <span className="text-[11px] text-foreground-muted">CB: {formatCurrency(s.baseSalary)}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 w-32">
                                        <span className="text-sm font-semibold text-error">{formatCurrency(s.totalDeductions)}</span>
                                    </td>
                                    <td className="px-4 py-3 w-32">
                                        <span className="text-base font-bold text-success-600">{formatCurrency(s.netSalary)}</span>
                                    </td>
                                    <td className="px-4 py-3 w-32">
                                        {s.status === 'PAID'
                                            ? <span className="badge-success inline-flex items-center gap-1"><CheckCircle2 size={11} /> Đã trả</span>
                                            : <span className="badge-gray">Chờ trả lương</span>
                                        }
                                    </td>
                                    <td className="px-4 py-3 w-16 text-right">
                                        <button
                                            type="button"
                                            onClick={() => setDetailSlipId(s.id)}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-background-secondary transition-colors text-foreground-muted hover:text-foreground"
                                        >
                                            <Eye size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </DataListTable>
                    )}
                </DataListShell>
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-foreground-muted text-sm">
                    Hãy chọn một Kỳ Lương để bắt đầu hoặc tạo một kỳ mới.
                </div>
            )}

            {/* Dialogs */}
            <PayrollPeriodForm open={isPeriodFormOpen} onOpenChange={setIsPeriodFormOpen} />
            <PayrollSlipDetail open={!!detailSlipId} onOpenChange={(val) => !val && setDetailSlipId(null)} slipId={detailSlipId} />
        </div>
    )
}
