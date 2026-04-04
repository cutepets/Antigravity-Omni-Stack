'use client'

import React, { useState, useEffect } from 'react'
import { ShieldAlert, Plus, ShieldCheck, HelpCircle } from 'lucide-react'
import { rolesApi } from '@/lib/api'
import { customToast as toast } from '@/components/ui/toast-with-copy'

export function TabRoles() {
    const [roles, setRoles] = useState<any[]>([])
    const [selectedRole, setSelectedRole] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)

    // A sample mapping of permissions available to Check/Uncheck. 
    // Usually fetched dynamically, but for UI we statically list them for now.
    const availablePermissions = [
        { key: 'MANAGE_STAFF', label: 'Quản lý nhân viên' },
        { key: 'MANAGE_USERS', label: 'Quản lý tài khoản (Đình chỉ/Mở khóa)' },
        { key: 'MANAGE_ROLES', label: 'Quản lý phân quyền' },
        { key: 'MANAGE_BRANCHES', label: 'Quản lý thông tin chi nhánh' },
        { key: 'MANAGE_SETTINGS', label: 'Cài đặt hệ thống chung' },
        { key: 'MANAGE_PRODUCTS', label: 'Quản lý sản phẩm (Hàng hóa)' },
        { key: 'MANAGE_SERVICES', label: 'Quản lý dịch vụ' },
        { key: 'MANAGE_VACCINES', label: 'Quản lý danh mục Vaccine' },
        { key: 'MANAGE_PETS', label: 'Quản lý hồ sơ Thú cưng' },
        { key: 'MANAGE_CUSTOMERS', label: 'Quản lý khách hàng' },
        { key: 'MANAGE_ORDERS', label: 'Tạo và quản lý Bán hàng / Đơn hàng' },
        { key: 'MANAGE_BILLS', label: 'Quản lý hóa đơn thu chi' },
        { key: 'MANAGE_MEDICAL_RECORDS', label: 'Quản lý sổ khám bệnh' },
        { key: 'VIEW_FINANCIAL_REPORTS', label: 'Xem Báo cáo Tổng quan & Tài chính' },
        { key: 'FULL_BRANCH_ACCESS', label: 'Quyền chuyển đổi & Quản lý tất cả Chi nhánh' },
    ]

    useEffect(() => {
        rolesApi.list().then(data => {
            setRoles(data)
            if (data.length > 0) setSelectedRole(data[0])
            setLoading(false)
        }).catch(err => {
            console.error(err)
            toast.error('Lỗi tải danh sách vai trò')
            setLoading(false)
        })
    }, [])

    const togglePermission = (permKey: string) => {
        if (!selectedRole || selectedRole.isSystem) return
        const currentPerms = selectedRole.permissions || []
        const hasPerm = currentPerms.includes(permKey)
        const newPerms = hasPerm ? currentPerms.filter((p: string) => p !== permKey) : [...currentPerms, permKey]
        
        setSelectedRole({ ...selectedRole, permissions: newPerms })
    }

    const saveRole = async () => {
        if (!selectedRole) return
        try {
            await rolesApi.update(selectedRole.id, { permissions: selectedRole.permissions })
            toast.success('Đã lưu phân quyền!')
            setRoles(roles.map(r => r.id === selectedRole.id ? selectedRole : r))
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Lỗi lưu thông tin')
        }
    }

    const deleteRole = async () => {
        if (!selectedRole || selectedRole.isSystem) return
        if (!confirm(`Bạn có chắc muốn xóa vai trò "${selectedRole.name}"? Hành động này không thể hoàn tác.`)) return
        
        try {
            await rolesApi.delete(selectedRole.id)
            toast.success('Đã xóa vai trò thành công')
            const newRoles = roles.filter(r => r.id !== selectedRole.id)
            setRoles(newRoles)
            if (newRoles.length > 0) setSelectedRole(newRoles[0])
            else setSelectedRole(null)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi xóa vai trò')
        }
    }

    if (loading) return <div className="p-10 text-center text-foreground-muted animate-pulse">Đang tải...</div>

    return (
        <div className="w-full bg-background-secondary border border-border/60 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[500px]">
            <div className="border-b border-border/50 p-6 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-foreground-base flex items-center gap-3">
                        <ShieldAlert className="text-primary-500" size={24} /> 
                        Vai trò & Phân quyền
                    </h2>
                    <p className="text-sm text-foreground-muted mt-1">Quản lý phân quyền hiển thị và tính năng cho từng nhóm nhân viên.</p>
                </div>
                <button className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                    <Plus size={16} /> Thêm vai trò
                </button>
            </div>

            <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Danh sách vai trò */}
                    <div className="col-span-1 space-y-3">
                        {roles.map((role) => {
                            const isSelected = selectedRole?.id === role.id
                            return (
                                <div 
                                    key={role.id} 
                                    onClick={() => setSelectedRole(role)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-colors ${isSelected ? 'bg-primary-500/10 border-primary-500' : 'bg-black/5 border-border/50 hover:border-primary-500/50'}`}
                                >
                                    <h3 className="font-bold text-sm text-foreground-base flex items-center gap-2">
                                        {role.name}
                                        {role.isSystem && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded uppercase">Hệ thống</span>}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs font-medium text-foreground-muted bg-background-elevated px-2 py-0.5 rounded">{role._count?.users || 0} nhân viên</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Form phân quyền chi tiết */}
                    <div className="col-span-2 bg-background-elevated border border-border/50 rounded-2xl p-6">
                        {selectedRole ? (
                        <>
                            <div className="flex justify-between items-start mb-6 pb-4 border-b border-border/40">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <ShieldCheck className="text-primary-500" size={20} />
                                        {selectedRole.name}
                                    </h3>
                                    <p className="text-sm text-foreground-muted mt-1">{selectedRole.description || 'Chưa có mô tả'}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-sm mb-3">Tùy chọn quyền hệ thống</h4>
                                    <div className="space-y-2">
                                        {availablePermissions.map((perm) => {
                                            const isChecked = selectedRole.permissions?.includes(perm.key) || false
                                            return (
                                                <label key={perm.key} className={`flex items-center gap-3 p-2 rounded-lg ${selectedRole.isSystem ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/5 cursor-pointer'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isChecked} 
                                                        onChange={() => togglePermission(perm.key)}
                                                        disabled={selectedRole.isSystem}
                                                        className="w-4 h-4 rounded text-primary-500 accent-primary-500" 
                                                    />
                                                    <span className="text-sm text-foreground-base">{perm.label}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-border/40 flex justify-end gap-3">
                                {!selectedRole.isSystem && (
                                    <button 
                                        onClick={deleteRole}
                                        className="px-6 py-2 rounded-xl text-sm font-bold bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-colors"
                                    >
                                        Xóa vai trò
                                    </button>
                                )}
                                <button 
                                    onClick={saveRole}
                                    disabled={selectedRole.isSystem}
                                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-opacity ${selectedRole.isSystem ? 'bg-neutral-400 cursor-not-allowed text-white/50' : 'bg-primary-500 hover:opacity-90 text-white'}`}
                                >
                                    Cập nhật Quyền
                                </button>
                            </div>
                        </>
                        ) : (
                            <div className="text-center py-20 text-foreground-muted">Vui lòng chọn vai trò để xem phân quyền</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

