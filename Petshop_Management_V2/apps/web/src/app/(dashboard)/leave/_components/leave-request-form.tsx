'use client'

import { useState } from 'react'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { staffApi } from '@/lib/api/staff.api'
import { leaveApi, CreateLeavePayload } from '@/lib/api/leave.api'
import { differenceInDays } from 'date-fns'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { Loader2, X } from 'lucide-react'

interface LeaveRequestFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultBranchId?: string
}

const LEAVE_TYPES = [
    { value: 'ANNUAL', label: 'Nghỉ phép năm' },
    { value: 'SICK', label: 'Nghỉ ốm' },
    { value: 'UNPAID', label: 'Nghỉ không lương' },
    { value: 'MATERNITY', label: 'Nghỉ thai sản' },
    { value: 'OTHER', label: 'Lý do khác' },
]

export function LeaveRequestForm({ open, onOpenChange, defaultBranchId = '' }: LeaveRequestFormProps) {
    const queryClient = useQueryClient()
    const [isLoading, setIsLoading] = useState(false)
    const [formDate, setFormDate] = useState({
        startDate: '',
        endDate: '',
        userId: '',
        leaveType: 'ANNUAL' as CreateLeavePayload['leaveType'],
        reason: ''
    })

    const { data: staffs = [], isLoading: isStaffLoading } = useQuery({
        queryKey: ['staffs'],
        queryFn: () => staffApi.getAll()
    })

    const createMutation = useMutation({
        mutationFn: leaveApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leave'] })
            toast.success('Đã tạo đơn xin nghỉ phép')
            onOpenChange(false)
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Không thể tạo đơn nghỉ phép')
        },
        onSettled: () => setIsLoading(false)
    })

    const calcDays = () => {
        if (!formDate.startDate || !formDate.endDate) return 1
        const d = differenceInDays(new Date(formDate.endDate), new Date(formDate.startDate)) + 1
        return d > 0 ? d : 1
    }

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        createMutation.mutate({
            userId: formDate.userId,
            branchId: defaultBranchId || (staffs.find(s => s.id === formDate.userId) as any)?.branch?.id || '',
            leaveType: formDate.leaveType,
            startDate: new Date(formDate.startDate).toISOString(),
            endDate: new Date(formDate.endDate).toISOString(),
            totalDays: calcDays(),
            reason: formDate.reason
        })
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 app-modal-overlay" onPointerDown={() => onOpenChange(false)}>
            <div className="w-full max-w-md bg-background rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95" onPointerDown={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <h3 className="text-base font-bold">Tạo đơn xin nghỉ</h3>
                    <button type="button" onClick={() => onOpenChange(false)} className="text-foreground-muted hover:text-foreground">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="userId" className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">Nhân viên</label>
                        <select
                            id="userId"
                            value={formDate.userId}
                            onChange={(e) => setFormDate(p => ({ ...p, userId: e.target.value }))}
                            disabled={isStaffLoading}
                            className="form-select h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                            required
                        >
                            <option value="">Chọn nhân viên...</option>
                            {staffs.map(s => (
                                <option key={s.id} value={s.id}>{s.fullName} ({s.staffCode})</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="leaveType" className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">Loại nghỉ phép</label>
                        <select
                            id="leaveType"
                            value={formDate.leaveType}
                            onChange={(e) => setFormDate(p => ({ ...p, leaveType: e.target.value as any }))}
                            className="form-select h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                            required
                        >
                            {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="startDate" className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">Từ ngày</label>
                            <input
                                id="startDate"
                                type="date"
                                value={formDate.startDate}
                                onChange={(e) => setFormDate(p => ({ ...p, startDate: e.target.value }))}
                                className="form-input h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="endDate" className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">Đến ngày</label>
                            <input
                                id="endDate"
                                type="date"
                                value={formDate.endDate}
                                onChange={(e) => setFormDate(p => ({ ...p, endDate: e.target.value }))}
                                className="form-input h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex h-10 items-center rounded-xl border border-border bg-background-secondary px-3 text-sm">
                        Tổng số ngày tạm tính: <span className="ml-2 font-bold text-primary-600">{calcDays()} ngày</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="reason" className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">Lý do nghỉ</label>
                        <textarea
                            id="reason"
                            rows={3}
                            placeholder="Vui lòng ghi rõ lý do..."
                            value={formDate.reason}
                            onChange={(e) => setFormDate(p => ({ ...p, reason: e.target.value }))}
                            className="form-textarea w-full resize-none rounded-xl border border-border bg-background p-3 text-sm"
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-background-secondary transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !formDate.userId || !formDate.startDate || !formDate.endDate}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
                        >
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Tạo Đơn
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
