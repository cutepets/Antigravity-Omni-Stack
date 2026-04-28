'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { payrollApi } from '@/lib/api/payroll.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { Loader2, X } from 'lucide-react'

interface PayrollPeriodFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function PayrollPeriodForm({ open, onOpenChange }: PayrollPeriodFormProps) {
    const queryClient = useQueryClient()
    const now = new Date()
    const [formData, setFormData] = useState({
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        name: `Lương tháng ${now.getMonth() + 1}/${now.getFullYear()}`,
        startDate: '',
        endDate: '',
    })

    const createMutation = useMutation({
        mutationFn: payrollApi.createPeriod,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
            toast.success(`Đã tạo kỳ lương: ${data.name}`)
            onOpenChange(false)
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Không thể tạo kỳ lương')
        },
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        createMutation.mutate({
            ...formData,
            startDate: new Date(formData.startDate).toISOString(),
            endDate: new Date(formData.endDate).toISOString(),
        })
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 app-modal-overlay" onPointerDown={() => onOpenChange(false)}>
            <div className="w-full max-w-sm bg-background rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95" onPointerDown={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <h3 className="text-base font-bold">Tạo kỳ lương mới</h3>
                    <button type="button" onClick={() => onOpenChange(false)} className="text-foreground-muted hover:text-foreground">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="month" className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">Tháng</label>
                            <input
                                id="month"
                                type="number"
                                min={1}
                                max={12}
                                value={formData.month}
                                onChange={(e) => setFormData(p => ({ ...p, month: parseInt(e.target.value) }))}
                                className="form-input h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="year" className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">Năm</label>
                            <input
                                id="year"
                                type="number"
                                min={2020}
                                max={2100}
                                value={formData.year}
                                onChange={(e) => setFormData(p => ({ ...p, year: parseInt(e.target.value) }))}
                                className="form-input h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">Tên kỳ lương</label>
                        <input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                            className="form-input h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="startDate" className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">Từ ngày</label>
                            <input
                                id="startDate"
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => setFormData(p => ({ ...p, startDate: e.target.value }))}
                                className="form-input h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="endDate" className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">Đến ngày</label>
                            <input
                                id="endDate"
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData(p => ({ ...p, endDate: e.target.value }))}
                                className="form-input h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                                required
                            />
                        </div>
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
                            disabled={createMutation.isPending || !formData.startDate || !formData.endDate || !formData.name}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
                        >
                            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            Khởi tạo
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
