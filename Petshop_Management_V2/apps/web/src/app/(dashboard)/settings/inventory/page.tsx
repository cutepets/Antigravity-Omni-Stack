'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Tags, Scale, Settings, Check, Loader2, Edit2, Trash2, Plus, ArrowLeft } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// Types
type DictionaryItem = {
    id: string
    name: string
    description?: string | null
    createdAt: string
}

// Reusable Dictionary Manager Component
function DictionaryManager({ endpoint, title, icon: Icon, queryKey }: { endpoint: string, title: string, icon: any, queryKey: string[] }) {
    const queryClient = useQueryClient()
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({ name: '', description: '' })

    const { data: items = [], isLoading } = useQuery({
        queryKey,
        queryFn: async () => {
            const res = await api.get(endpoint)
            return res.data.data as DictionaryItem[]
        }
    })

    const mutationCreate = useMutation({
        mutationFn: async (payload: typeof formData) => {
            const res = await api.post(endpoint, payload)
            return res.data.data
        },
        onSuccess: () => {
            toast.success(`Đã thêm ${title.toLowerCase()}`)
            queryClient.invalidateQueries({ queryKey })
            closeForm()
        }
    })

    const mutationUpdate = useMutation({
        mutationFn: async ({ id, payload }: { id: string, payload: typeof formData }) => {
            const res = await api.put(`${endpoint}/${id}`, payload)
            return res.data.data
        },
        onSuccess: () => {
            toast.success(`Đã cập nhật ${title.toLowerCase()}`)
            queryClient.invalidateQueries({ queryKey })
            closeForm()
        }
    })

    const mutationDelete = useMutation({
        mutationFn: async (id: string) => {
            const res = await api.delete(`${endpoint}/${id}`)
            return res.data
        },
        onSuccess: () => {
            toast.success(`Đã xóa ${title.toLowerCase()}`)
            queryClient.invalidateQueries({ queryKey })
        }
    })

    const closeForm = () => {
        setIsFormOpen(false)
        setEditingId(null)
        setFormData({ name: '', description: '' })
    }

    const handleSave = () => {
        if (!formData.name) return toast.error('Vui lòng nhập tên')
        if (editingId) {
            mutationUpdate.mutate({ id: editingId, payload: formData })
        } else {
            mutationCreate.mutate(formData)
        }
    }

    const handleEdit = (item: DictionaryItem) => {
        setFormData({ name: item.name, description: item.description || '' })
        setEditingId(item.id)
        setIsFormOpen(true)
    }

    return (
        <div className="w-full bg-background-secondary border border-border/60 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[500px]">
            <div className="border-b border-border/50 p-6 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground-base flex items-center gap-3">
                        <Icon className="text-primary-500" size={24} /> 
                        Quản lý {title}
                    </h2>
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
                {isFormOpen && (
                    <div className="bg-background-elevated border border-primary-500/30 p-6 rounded-2xl shadow-sm space-y-4 animate-in slide-in-from-top-4 fade-in duration-300">
                        <h3 className="font-bold text-sm text-primary-500 flex items-center gap-2">
                            {editingId ? <Edit2 size={16} /> : <Plus size={16} />}
                            {editingId ? `Sửa ${title.toLowerCase()}` : `Thêm ${title.toLowerCase()}`}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-bold text-foreground-base">Tên {title.toLowerCase()} <span className="text-red-500">*</span></label>
                                <input 
                                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-black/20 border border-border/50 rounded-lg px-4 py-2.5 outline-none focus:border-primary-500 transition-colors text-sm"
                                    placeholder="Nhập tên..."
                                />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-bold text-foreground-base">Mô tả</label>
                                <input 
                                    value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-black/20 border border-border/50 rounded-lg px-4 py-2.5 outline-none focus:border-primary-500 transition-colors text-sm"
                                    placeholder="Không bắt buộc"
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

                {isLoading ? (
                    <div className="flex items-center justify-center h-40 text-foreground-muted">
                        <Loader2 className="animate-spin" size={24} />
                    </div>
                ) : items.length === 0 ? (
                    <div className="border border-dashed border-border/60 rounded-2xl h-40 flex items-center justify-center text-foreground-muted text-sm">
                        Chưa có dữ liệu.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map(item => (
                            <div key={item.id} className="bg-background-tertiary border border-border/40 rounded-2xl p-5 hover:border-primary-500/50 transition-colors group relative">
                                <h4 className="font-bold text-foreground-base break-words">{item.name}</h4>
                                <p className="text-xs text-foreground-muted mt-1 truncate">
                                    {item.description || 'Không có mô tả'}
                                </p>
                                
                                {/* Hover Actions */}
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 bg-background-tertiary pl-2">
                                    <button 
                                        onClick={() => handleEdit(item)}
                                        className="p-1.5 bg-black/20 hover:bg-primary-500 hover:text-white rounded-md text-foreground-muted transition-colors"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (confirm(`Xóa ${item.name}?`)) mutationDelete.mutate(item.id)
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

export default function InventorySettingsPage() {
    const [activeTab, setActiveTab] = useState('categories')

    const tabs = [
        { id: 'categories', label: 'Danh mục', icon: Tags, endpoint: '/inventory/categories', title: 'Danh mục' },
        { id: 'brands', label: 'Thương hiệu', icon: Package, endpoint: '/inventory/brands', title: 'Thương hiệu' },
        { id: 'units', label: 'Đơn vị tính', icon: Scale, endpoint: '/inventory/units', title: 'Đơn vị tính' },
    ]

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1400px] mx-auto py-8 px-6 lg:px-8">
            <div className="flex flex-col gap-4">
                <Link href="/settings" className="inline-flex items-center text-sm font-bold text-foreground-muted hover:text-primary-500 transition-colors w-fit">
                    <ArrowLeft size={16} className="mr-2" /> Quay lại Cài đặt
                </Link>
                <div className="flex items-center gap-3">
                    <div className="text-primary-500 bg-primary-500/10 p-2.5 rounded-xl border border-primary-500/20 shrink-0">
                        <Settings size={26} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground-base tracking-tight">
                            Cấu hình Kho Hàng
                        </h1>
                        <p className="text-foreground-secondary text-sm mt-0.5">
                            Quản lý các danh mục, thương hiệu và đơn vị tính dùng trong kho.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-full lg:w-[280px] shrink-0 space-y-6 lg:sticky lg:top-[100px]">
                    <div className="flex flex-col gap-1.5 p-2 bg-background-secondary border border-border/50 rounded-2xl shadow-sm">
                        {tabs.map(tab => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm",
                                        isActive
                                            ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
                                            : "bg-transparent text-foreground-secondary hover:text-foreground-base hover:bg-black/5"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon size={18} className={isActive ? "text-white" : "opacity-70"} />
                                        <span>{tab.label}</span>
                                    </div>
                                    {isActive && (
                                        <motion.div layoutId="inv-active-indicator" className="w-1.5 h-1.5 bg-white rounded-full ml-auto" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="w-full relative min-h-[500px]">
                    <AnimatePresence mode="popLayout">
                        {tabs.map(tab => (
                            activeTab === tab.id && (
                                <motion.div 
                                    key={tab.id} 
                                    initial={{ opacity: 0, x: 20 }} 
                                    animate={{ opacity: 1, x: 0 }} 
                                    exit={{ opacity: 0, x: -20 }} 
                                    transition={{ duration: 0.2 }}
                                >
                                    <DictionaryManager 
                                        endpoint={tab.endpoint} 
                                        title={tab.title} 
                                        icon={tab.icon} 
                                        queryKey={['inventory', tab.id]} 
                                    />
                                </motion.div>
                            )
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
