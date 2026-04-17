'use client'

import { useState, useMemo } from 'react'
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, isSameDay } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Clock, Plus, User, X, Trash2, Loader2 } from 'lucide-react'

import { scheduleApi, StaffSchedule } from '@/lib/api/schedule.api'
import { staffApi, Staff } from '@/lib/api/staff.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'

const SHIFT_TYPES = {
    MORNING: { label: 'Ca Sáng', color: 'bg-blue-500/10 text-blue-600 border border-blue-200' },
    AFTERNOON: { label: 'Ca Chiều', color: 'bg-orange-500/10 text-orange-600 border border-orange-200' },
    EVENING: { label: 'Ca Tối', color: 'bg-purple-500/10 text-purple-600 border border-purple-200' },
    NIGHT: { label: 'Ca Đêm', color: 'bg-slate-500/10 text-slate-600 border border-slate-200' },
}

export function ShiftScheduleMatrix() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedCell, setSelectedCell] = useState<{ staff: Staff, date: Date, schedule?: StaffSchedule } | null>(null)
    const [shiftType, setShiftType] = useState('MORNING')
    const [isActive, setIsActive] = useState(true)

    const queryClient = useQueryClient()

    // Week navigation — start on Monday
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
    const endDate = endOfWeek(currentDate, { weekStartsOn: 1 })

    const daysInWeek = useMemo(() => {
        const days = []
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate)
            date.setDate(startDate.getDate() + i)
            days.push(date)
        }
        return days
    }, [startDate])

    // Queries
    const { data: staffs = [], isLoading: isStaffsLoading } = useQuery({
        queryKey: ['staffs'],
        queryFn: () => staffApi.getAll(),
    })

    const { data: schedules = [] } = useQuery({
        queryKey: ['schedules', startDate.toISOString(), endDate.toISOString()],
        queryFn: () => scheduleApi.list({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        }),
    })

    // Mutations
    const upsertMutation = useMutation({
        mutationFn: async (data: any) => {
            if (data.id) return scheduleApi.update(data.id, data)
            return scheduleApi.create(data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules'] })
            toast.success('Đã lưu lịch làm việc')
            setSelectedCell(null)
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Không thể lưu lịch làm việc')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => scheduleApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules'] })
            toast.success('Đã xóa ca làm việc')
            setSelectedCell(null)
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Lỗi khi xóa lịch')
        }
    })

    const handleOpenCell = (staff: Staff, date: Date, schedule?: StaffSchedule) => {
        setSelectedCell({ staff, date, schedule })
        setShiftType(schedule?.shiftType || 'MORNING')
        setIsActive(schedule ? schedule.isActive : true)
    }

    const handleSaveSchedule = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!selectedCell) return

        const formData = new FormData(e.currentTarget)
        const startTime = formData.get('startTime') as string
        const endTime = formData.get('endTime') as string
        const note = formData.get('note') as string

        const payload: any = {
            userId: selectedCell.staff.id,
            branchId: (selectedCell.staff as any).branch?.id || '',
            date: selectedCell.date.toISOString(),
            shiftType,
            startTime,
            endTime,
            isActive,
            note: note || undefined,
        }

        if (selectedCell.schedule) payload.id = selectedCell.schedule.id
        upsertMutation.mutate(payload)
    }

    if (isStaffsLoading) return <div className="p-8 text-center text-foreground-muted">Đang tải danh sách nhân viên...</div>

    return (
        <div className="flex h-full flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-background">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold">Lịch phân ca</h2>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCurrentDate(new Date())}
                            className="h-8 rounded-lg border border-border px-3 text-sm font-medium hover:bg-background-secondary transition-colors"
                        >
                            Hôm nay
                        </button>
                        <div className="flex items-center rounded-lg border border-border">
                            <button
                                type="button"
                                onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
                                className="flex h-8 w-8 items-center justify-center border-r border-border hover:bg-background-secondary transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="px-4 text-sm font-medium">
                                {format(startDate, 'dd/MM/yyyy')} – {format(endDate, 'dd/MM/yyyy')}
                            </div>
                            <button
                                type="button"
                                onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
                                className="flex h-8 w-8 items-center justify-center border-l border-border hover:bg-background-secondary transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Matrix */}
            <div className="flex-1 overflow-auto bg-background-secondary/30">
                <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-background shadow-sm">
                        <tr>
                            <th className="w-56 border-b border-r border-border bg-background p-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                                Nhân sự
                            </th>
                            {daysInWeek.map(date => {
                                const isToday = isSameDay(date, new Date())
                                return (
                                    <th
                                        key={date.toISOString()}
                                        className={`min-w-[120px] border-b border-r border-border p-3 text-center ${isToday ? 'bg-primary-500/5 text-primary-600' : 'text-foreground-muted'}`}
                                    >
                                        <div className="font-medium text-xs uppercase">{format(date, 'EEEE', { locale: vi })}</div>
                                        <div className={`text-sm mt-0.5 ${isToday ? 'font-bold' : 'font-normal'}`}>
                                            {format(date, 'dd/MM')}
                                        </div>
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {staffs.map(staff => (
                            <tr key={staff.id} className="group border-b border-border bg-background hover:bg-background-secondary/40 transition-colors">
                                <td className="border-r border-border p-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-600">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-semibold leading-none">{staff.fullName}</span>
                                            <span className="text-[11px] text-foreground-muted leading-none">{staff.staffCode}</span>
                                        </div>
                                    </div>
                                </td>
                                {daysInWeek.map(date => {
                                    const daySchedules = schedules.filter(s => s.userId === staff.id && isSameDay(new Date(s.date), date))
                                    return (
                                        <td
                                            key={date.toISOString()}
                                            className="border-r border-border p-2 align-top relative min-h-[80px] cursor-pointer"
                                            onClick={() => handleOpenCell(staff, date, undefined)}
                                        >
                                            <div className="flex flex-col gap-1 min-h-[60px]">
                                                {daySchedules.map(schedule => {
                                                    const shiftMeta = SHIFT_TYPES[schedule.shiftType as keyof typeof SHIFT_TYPES]
                                                    return (
                                                        <div
                                                            key={schedule.id}
                                                            className={`flex cursor-pointer flex-col items-start gap-1 rounded-md p-1.5 hover:ring-2 hover:ring-primary-500/40 transition-all ${shiftMeta?.color || ''} ${!schedule.isActive ? 'opacity-50 grayscale' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleOpenCell(staff, date, schedule)
                                                            }}
                                                        >
                                                            <div className="flex w-full items-center justify-between gap-2">
                                                                <span className="text-[11px] font-bold">{shiftMeta?.label || schedule.shiftType}</span>
                                                                {!schedule.isActive && <span className="text-[9px] uppercase font-bold text-error">Nghỉ</span>}
                                                            </div>
                                                            <div className="flex items-center text-[10px] font-medium opacity-80">
                                                                <Clock className="mr-1 h-3 w-3" />
                                                                {schedule.startTime} - {schedule.endTime}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                {daySchedules.length === 0 && (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-500/10 text-primary-600">
                                                            <Plus className="h-3.5 w-3.5" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                        {staffs.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-foreground-muted">
                                    Không có nhân sự nào được tìm thấy.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Quick Editor Modal */}
            {selectedCell && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onPointerDown={() => setSelectedCell(null)}>
                    <div className="w-full max-w-md bg-background rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95" onPointerDown={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-start justify-between p-5 border-b border-border">
                            <div>
                                <h3 className="text-base font-bold">
                                    {selectedCell.schedule ? 'Sửa ca làm việc' : 'Phân ca làm việc'}
                                </h3>
                                <p className="text-xs text-foreground-muted mt-1">
                                    <span className="font-semibold text-foreground">{selectedCell.staff.fullName}</span>
                                    {' • '}
                                    {selectedCell.date && format(selectedCell.date, 'EEEE, dd/MM/yyyy', { locale: vi })}
                                </p>
                            </div>
                            <button type="button" onClick={() => setSelectedCell(null)} className="text-foreground-muted hover:text-foreground">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSchedule} className="p-5 flex flex-col gap-4">
                            {/* Shift Type */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">Ca làm việc</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(SHIFT_TYPES).map(([key, meta]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setShiftType(key)}
                                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${shiftType === key ? `${meta.color} ring-2 ring-primary-500/30` : 'border-border hover:bg-background-secondary'}`}
                                        >
                                            {meta.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Times */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="startTime" className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">Giờ vào</label>
                                    <input
                                        id="startTime"
                                        type="time"
                                        name="startTime"
                                        defaultValue={selectedCell.schedule?.startTime || '08:00'}
                                        className="form-input h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="endTime" className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">Giờ ra</label>
                                    <input
                                        id="endTime"
                                        type="time"
                                        name="endTime"
                                        defaultValue={selectedCell.schedule?.endTime || '17:00'}
                                        className="form-input h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Note */}
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="note" className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">Ghi chú (Tùy chọn)</label>
                                <input
                                    id="note"
                                    name="note"
                                    type="text"
                                    placeholder="VD: Bù ca, làm thêm..."
                                    defaultValue={selectedCell.schedule?.note || ''}
                                    className="form-input h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                                />
                            </div>

                            {/* isActive toggle */}
                            <div className="flex items-center justify-between rounded-xl border border-border p-3">
                                <div>
                                    <p className="text-sm font-semibold">Kích hoạt ca</p>
                                    <p className="text-xs text-foreground-muted mt-0.5">Tắt nếu nhân viên xin nghỉ ca này</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isActive}
                                    onClick={() => setIsActive(!isActive)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isActive ? 'bg-primary-500' : 'bg-border'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-2 border-t border-border">
                                {selectedCell.schedule ? (
                                    <button
                                        type="button"
                                        disabled={deleteMutation.isPending}
                                        onClick={() => deleteMutation.mutate(selectedCell.schedule!.id)}
                                        className="flex items-center gap-1.5 rounded-xl border border-error/20 bg-error/10 px-3 py-2 text-sm font-semibold text-error hover:bg-error/20 transition-colors disabled:opacity-50"
                                    >
                                        {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                        Xóa ca
                                    </button>
                                ) : <div />}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCell(null)}
                                        className="px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-background-secondary transition-colors"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={upsertMutation.isPending}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
                                    >
                                        {upsertMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                                        Lưu ca làm
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
