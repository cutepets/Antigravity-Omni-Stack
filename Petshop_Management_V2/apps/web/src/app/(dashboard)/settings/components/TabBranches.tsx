'use client'

import React, { useState } from 'react'
import { MapPin, Plus, Check, Loader2, Edit2, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { api } from '@/lib/api'

type Branch = {
    id: string
    name: string
    address: string
    phone: string
    isActive: boolean
}

export function TabBranches() {
    const queryClient = useQueryClient()
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({ name: '', phone: '', address: '', isActive: true })

    const { data: branches = [], isLoading } = useQuery({
        queryKey: ['settings', 'branches'],
        queryFn: async () => {
            const res = await api.get('/settings/branches')
            return res.data.data as Branch[]
        }
    })

    const mutationCreate = useMutation({
        mutationFn: async (payload: typeof formData) => {
            const res = await api.post('/settings/branches', payload)
            return res.data.data
        },
        onSuccess: () => {
            toast.success('Đã thêm chi nhánh mới')
            queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] })
            closeForm()
        }
    })

    const mutationUpdate = useMutation({
        mutationFn: async ({ id, payload }: { id: string, payload: typeof formData }) => {
            const res = await api.put(`/settings/branches/${id}`, payload)
            return res.data.data
        },
        onSuccess: () => {
            toast.success('Đã cập nhật chi nhánh')
            queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] })
            closeForm()
        }
    })

    const mutationDelete = useMutation({
        mutationFn: async (id: string) => {
            const res = await api.delete(`/settings/branches/${id}`)
            return res.data
        },
        onSuccess: () => {
            toast.success('Đã xóa chi nhánh')
            queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] })
        }
    })

    const closeForm = () => {
        setIsFormOpen(false)
        setEditingId(null)
        setFormData({ name: '', phone: '', address: '', isActive: true })
    }

    const handleSave = () => {
        if (!formData.name) return toast.error('Vui lòng nhập tên chi nhánh')
        if (editingId) {
            mutationUpdate.mutate({ id: editingId, payload: formData })
        } else {
            mutationCreate.mutate(formData)
        }
    }

    const handleEdit = (branch: Branch) => {
        setFormData({ name: branch.name, phone: branch.phone || '', address: branch.address || '', isActive: branch.isActive })
        setEditingId(branch.id)
        setIsFormOpen(true)
    }

    return (
        <div className="w-full bg-background-secondary border border-border/60 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[500px]">
            <div className="border-b border-border/50 p-6 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground-base flex items-center gap-3">
                        <MapPin className="text-primary-500" size={24} /> 
                        Quản lý Chi nhánh
                    </h2>
                    <p className="text-sm text-foreground-muted mt-1">Hệ thống đa chi nhánh dùng chung dữ liệu khách hàng.</p>
                </div>
                {!isFormOpen && (
                    <button 
                        onClick={() => { closeForm(); setIsFormOpen(true) }}
                        className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                    >
                        <Plus size={16} /> Thêm
                    </button>
                )}
            </div>

            <div className="p-8 space-y-6 flex-1 bg-black/5">
                {/* Form Add New */}
                {isFormOpen && (
                    <div className="bg-background-elevated border border-primary-500/30 p-6 rounded-2xl shadow-sm space-y-4 animate-in slide-in-from-top-4 fade-in duration-300">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-primary-500 flex items-center gap-2">
                                {editingId ? <Edit2 size={16} /> : <Plus size={16} />}
                                {editingId ? 'Sửa chi nhánh' : 'Chi nhánh mới'}
                            </h3>
                            {editingId && (
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground-base">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.isActive} 
                                        onChange={e => setFormData({ ...formData, isActive: e.target.checked })} 
                                        className="rounded border-border/50 text-primary-500 focus:ring-primary-500 bg-black/20"
                                    />
                                    Đang hoạt động
                                </label>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground-base">Tên chi nhánh <span className="text-red-500">*</span></label>
                                <input 
                                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-black/20 border border-border/50 rounded-lg px-4 py-2.5 outline-none focus:border-primary-500 transition-colors text-sm"
                                    placeholder="VD: Petshop Quận 1"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground-base">Điện thoại</label>
                                <input 
                                    value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-black/20 border border-border/50 rounded-lg px-4 py-2.5 outline-none focus:border-primary-500 transition-colors text-sm"
                                    placeholder="09..."
                                />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-bold text-foreground-base">Địa chỉ</label>
                                <input 
                                    value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-black/20 border border-border/50 rounded-lg px-4 py-2.5 outline-none focus:border-primary-500 transition-colors text-sm"
                                    placeholder="Số nhà, Đường..."
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button 
                                onClick={closeForm}
                                className="text-foreground-muted hover:text-foreground-base px-4 py-2 text-sm font-medium transition-colors"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={handleSave} disabled={mutationCreate.isPending || mutationUpdate.isPending}
                                className="bg-primary-500 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                            >
                                {(mutationCreate.isPending || mutationUpdate.isPending) ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                Xác nhận
                            </button>
                        </div>
                    </div>
                )}

                {/* List Branches */}
                {isLoading ? (
                    <div className="flex items-center justify-center h-40 text-foreground-muted">
                        <Loader2 className="animate-spin" size={24} />
                    </div>
                ) : branches.length === 0 ? (
                    <div className="border border-dashed border-border/60 rounded-2xl h-40 flex items-center justify-center text-foreground-muted text-sm">
                        Chưa có chi nhánh nào.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {branches.map(branch => (
                            <div key={branch.id} className="bg-background-tertiary border border-border/40 rounded-2xl p-5 hover:border-primary-500/50 transition-colors group relative">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-bold text-foreground-base">{branch.name}</h4>
                                        <p className="text-xs text-foreground-muted mt-1">{branch.phone || 'Chưa cập nhật SĐT'}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {branch.isActive && (
                                            <span className="px-2 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold uppercase rounded">Hoạt động</span>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-border/40 flex items-center gap-2 text-xs text-foreground-muted">
                                    <MapPin size={14} />
                                    <span className="truncate">{branch.address || 'Chưa cập nhật địa chỉ'}</span>
                                </div>
                                
                                {/* Hover Actions */}
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 bg-background-tertiary pl-2">
                                    <button 
                                        onClick={() => handleEdit(branch)}
                                        className="p-1.5 bg-black/20 hover:bg-primary-500 hover:text-white rounded-md text-foreground-muted transition-colors"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (confirm('Bạn có chắc muốn xóa chi nhánh này?')) {
                                                mutationDelete.mutate(branch.id)
                                            }
                                        }}
                                        className="p-1.5 bg-black/20 hover:bg-red-500 hover:text-white rounded-md text-foreground-muted transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

