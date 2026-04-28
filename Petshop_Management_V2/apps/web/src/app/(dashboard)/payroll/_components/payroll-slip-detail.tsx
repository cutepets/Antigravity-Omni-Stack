'use client'

import { useQuery } from '@tanstack/react-query'
import { payrollApi } from '@/lib/api/payroll.api'
import { X, Loader2 } from 'lucide-react'

interface PayrollSlipDetailProps {
    slipId: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

const fmtVND = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

export function PayrollSlipDetail({ slipId, open, onOpenChange }: PayrollSlipDetailProps) {
    const { data: slip, isLoading } = useQuery({
        queryKey: ['payroll-slip', slipId],
        queryFn: () => payrollApi.getSlipById(slipId!),
        enabled: !!slipId && open,
    })

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end app-modal-overlay" onPointerDown={() => onOpenChange(false)}>
            <div
                className="h-full w-full max-w-xl overflow-y-auto bg-background shadow-2xl animate-in slide-in-from-right"
                onPointerDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-start justify-between bg-background border-b border-border p-5">
                    <div>
                        <h3 className="text-base font-bold">Chi tiết bảng lương</h3>
                        {slip && (
                            <p className="text-xs text-foreground-muted mt-0.5">
                                {slip.staff?.staffCode || slip.staffId} — {slip.staff?.fullName || 'Không rõ'}
                            </p>
                        )}
                    </div>
                    <button type="button" onClick={() => onOpenChange(false)} className="text-foreground-muted hover:text-foreground mt-0.5">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                {isLoading && (
                    <div className="flex h-40 items-center justify-center gap-2 text-foreground-muted">
                        <Loader2 size={18} className="animate-spin" /> Đang tải chi tiết...
                    </div>
                )}

                {!isLoading && slip && (
                    <div className="flex flex-col gap-5 p-5 pb-10">
                        {/* Summary */}
                        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-primary-500/20 bg-primary-500/5 p-5 text-center">
                            <div>
                                <div className="text-xs font-semibold text-foreground-muted uppercase">Lương Gross</div>
                                <div className="mt-1 text-xl font-bold text-primary-600">{fmtVND(slip.grossSalary)}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-foreground-muted uppercase">Thực nhận (Net)</div>
                                <div className="mt-1 text-xl font-bold text-success-600">{fmtVND(slip.netSalary)}</div>
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Income */}
                            <div className="rounded-xl border border-border overflow-hidden">
                                <div className="bg-background-secondary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground-secondary">
                                    Thu nhập
                                </div>
                                <ul className="divide-y divide-border text-sm">
                                    {[
                                        { label: 'Lương cơ bản', value: fmtVND(slip.baseSalary), color: '' },
                                        { label: `Ngày công (${slip.actualWorkDays} ngày)`, value: '', color: 'text-foreground-muted' },
                                        { label: `Tăng ca (${slip.overtimeHours}h)`, value: fmtVND(slip.overtimePay), color: 'text-blue-600' },
                                        { label: 'Hoa hồng Spa', value: fmtVND(slip.commissionSpa), color: 'text-blue-600' },
                                        { label: 'Hoa hồng Hotel', value: fmtVND(slip.commissionHotel), color: 'text-blue-600' },
                                        { label: 'Phụ cấp', value: fmtVND(slip.allowances), color: 'text-blue-600' },
                                    ].map(row => (
                                        <li key={row.label} className="flex items-center justify-between px-4 py-2.5">
                                            <span className="text-foreground-muted">{row.label}</span>
                                            <span className={`font-semibold ${row.color}`}>{row.value}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Deductions */}
                            <div className="rounded-xl border border-border overflow-hidden">
                                <div className="bg-background-secondary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground-secondary">
                                    Giảm trừ
                                </div>
                                <ul className="divide-y divide-border text-sm">
                                    {[
                                        { label: 'BHXH', value: slip.bhxh },
                                        { label: 'BHYT', value: slip.bhyt },
                                        { label: 'BHTN', value: slip.bhtn },
                                        { label: 'Thuế TNCN (PIT)', value: slip.pit },
                                        { label: 'Phạt / Đi trễ', value: slip.penalties },
                                        { label: 'Tạm ứng', value: slip.advances },
                                    ].map(row => (
                                        <li key={row.label} className="flex items-center justify-between px-4 py-2.5">
                                            <span className="text-foreground-muted">{row.label}</span>
                                            <span className="font-semibold text-error">{fmtVND(row.value)}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="flex items-center justify-between border-t border-border bg-background-secondary/50 px-4 py-3 font-bold text-sm">
                                    <span>Tổng giảm trừ</span>
                                    <span className="text-error">{fmtVND(slip.totalDeductions)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Line Items */}
                        {slip.lineItems && slip.lineItems.length > 0 && (
                            <div className="rounded-xl border border-border overflow-hidden">
                                <div className="bg-background-secondary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground-secondary">
                                    Ghi nhận chi tiết
                                </div>
                                <ul className="divide-y divide-border text-sm">
                                    {slip.lineItems.map(item => (
                                        <li key={item.id} className="flex items-center justify-between px-4 py-2.5">
                                            <span className="text-foreground-muted">{item.description}</span>
                                            <span className={`font-semibold ${['DEDUCTION', 'TAX'].includes(item.type) ? 'text-error' : 'text-success-600'}`}>
                                                {['DEDUCTION', 'TAX'].includes(item.type) ? '-' : '+'}{fmtVND(item.amount)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
