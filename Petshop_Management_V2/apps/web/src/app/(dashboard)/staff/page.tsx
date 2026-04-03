'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { StaffGrid } from './components/StaffGrid'
import { StaffFormModal } from './components/StaffFormModal'
import { staffApi, Staff, CreateStaffDto, UpdateStaffDto } from '@/lib/api/staff.api'
import { rolesApi } from '@/lib/api'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useRouter } from 'next/navigation'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { Users, Plus, Search } from 'lucide-react'

export default function StaffManagementPage() {
  const router = useRouter()
  const { hasRole, isLoading } = useAuthorization() as any // bypass type check if isLoading is missing
  const [isAuthorized, setIsAuthorized] = useState(false)

  const [staff, setStaff] = useState<Staff[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [roleFilter, setRoleFilter] = useState('ALL')

  useEffect(() => {
    // wait for auth to init
    const checkAuth = setTimeout(() => {
      if (!hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])) {
        router.push('/dashboard')
      } else {
        setIsAuthorized(true)
        fetchStaff()
      }
    }, 100)
    return () => clearTimeout(checkAuth)
  }, [hasRole, router])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const data = await staffApi.getAll()
      const rolesData = await rolesApi.list()
      setStaff(data)
      setRoles(rolesData)
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách nhân viên')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrUpdate = async (data: any) => {
    if (selectedStaff) {
      await staffApi.update(selectedStaff.id, data as UpdateStaffDto)
    } else {
      await staffApi.create(data as CreateStaffDto)
    }
    await fetchStaff()
  }

  const handleDeactivate = async (id: string, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn cho nhân viên ${name} nghỉ việc?Hành động này không xóa dữ liệu hóa đơn cũ của nhân viên.`)) {
      try {
        await staffApi.deactivate(id)
        await fetchStaff()
      } catch (err: any) {
        alert(err?.response?.data?.message || 'Có lỗi xảy ra')
      }
    }
  }

  // Filtering logic
  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const matchSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.staffCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.phone?.includes(searchQuery)
      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter
      const matchRole = roleFilter === 'ALL' || s.role?.id === roleFilter
      return matchSearch && matchStatus && matchRole
    })
  }, [staff, searchQuery, statusFilter, roleFilter])

  if (!isAuthorized) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Đang kiểm tra quyền truy cập...</div>
  }

  return (
    <PageContainer maxWidth="2xl">
      <PageHeader 
        title="Quản lý Nhân sự"
        description="Quản lý danh sách nhân viên, hợp đồng và phân quyền truy cập"
        icon={Users}
        actions={
          hasRole(['SUPER_ADMIN', 'ADMIN']) && (
            <button 
              onClick={() => {
                setSelectedStaff(null)
                setIsModalOpen(true)
              }}
              className="flex items-center gap-2 rounded-xl bg-primary-500 hover:bg-primary-600 px-6 py-2.5 font-bold text-white shadow-md shadow-primary-500/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Plus size={20} />
              <span>Thêm nhân viên</span>
            </button>
          )
        }
      />

      {/* Toolbar */}
      <div className="mb-8 mt-2 flex flex-col md:flex-row gap-4 bg-background-secondary p-4 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="Tìm theo tên, mã NV, SĐT..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border/60 bg-background-base px-4 py-3 pl-11 text-sm text-foreground-base placeholder-foreground-muted outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
          />
          <Search size={20} className="absolute left-4 top-3 h-5 w-5 text-foreground-muted" />
        </div>

        <select 
          className="rounded-xl border border-border/60 bg-background-base px-4 py-3 text-sm text-foreground-base outline-none focus:border-primary-500 min-w-[180px] appearance-none"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="ALL">Tất cả chức vụ</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        <select 
          className="rounded-xl border border-border/60 bg-background-base px-4 py-3 text-sm text-foreground-base outline-none focus:border-primary-500 min-w-[180px] appearance-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="WORKING">Đang làm việc</option>
          <option value="PROBATION">Thử việc</option>
          <option value="LEAVE">Nghỉ phép</option>
          <option value="RESIGNED">Đã nghỉ việc</option>
        </select>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-500">
          {error}
          <button onClick={fetchStaff} className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm font-semibold hover:bg-red-500/20 transition-colors">
            Thử lại
          </button>
        </div>
      ) : loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2A2D3C] border-t-[#00E5B5]" />
            <p className="text-gray-400">Đang tải danh sách nhân viên...</p>
          </div>
        </div>
      ) : (
        <StaffGrid 
          staffList={filteredStaff} 
          onEdit={(s) => { setSelectedStaff(s); setIsModalOpen(true); }} 
          onDeactivate={handleDeactivate} 
        />
      )}

      <StaffFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedStaff}
        roles={roles}
        onSave={handleCreateOrUpdate}
      />
    </PageContainer>
  )
}
