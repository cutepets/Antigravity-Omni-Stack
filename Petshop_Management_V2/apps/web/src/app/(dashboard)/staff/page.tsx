'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Briefcase, Plus, Search, ShieldAlert, Users } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { useAuthorization } from '@/hooks/useAuthorization'
import { rolesApi } from '@/lib/api'
import { CreateStaffDto, Staff, staffApi, UpdateStaffDto } from '@/lib/api/staff.api'
import { cn } from '@/lib/utils'
import { StaffFormModal } from './components/StaffFormModal'
import { StaffGrid } from './components/StaffGrid'
import { TabRolesPermissions } from './components/TabRolesPermissions'

type StaffTab = 'staff' | 'roles'

const STAFF_TABS: { id: StaffTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'staff', label: 'Danh sách nhân viên', icon: Users },
  { id: 'roles', label: 'Phân quyền', icon: ShieldAlert },
]

export default function StaffManagementPage() {
  const router = useRouter()
  const { hasPermission, hasAnyPermission, isLoading: isAuthLoading } = useAuthorization()

  const canViewStaff = hasPermission('staff.read')
  const canReadRoles = hasPermission('role.read')
  const canCreateStaff = hasPermission('staff.create') && canReadRoles
  const canEditStaff = hasPermission('staff.update') && canReadRoles
  const canDeactivateStaff = hasPermission('staff.deactivate')
  const canViewRoles = hasAnyPermission(['role.read', 'staff.read'])

  const [activeTab, setActiveTab] = useState<StaffTab>('staff')
  const [staff, setStaff] = useState<Staff[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [roleFilter, setRoleFilter] = useState('ALL')

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true)
      const [staffData, rolesData] = await Promise.all([
        staffApi.getAll(),
        canReadRoles ? rolesApi.list() : Promise.resolve([]),
      ])
      setStaff(staffData)
      setRoles(Array.isArray(rolesData) ? rolesData : [])
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách nhân viên')
    } finally {
      setLoading(false)
    }
  }, [canReadRoles])

  useEffect(() => {
    if (isAuthLoading) return

    if (!canViewStaff) {
      router.replace('/dashboard')
      return
    }

    void fetchStaff()
  }, [canViewStaff, isAuthLoading, router, fetchStaff])

  const handleCreateOrUpdate = async (data: CreateStaffDto | UpdateStaffDto) => {
    if (selectedStaff) {
      await staffApi.update(selectedStaff.id, data as UpdateStaffDto)
    } else {
      await staffApi.create(data as CreateStaffDto)
    }
    await fetchStaff()
  }

  const handleDeactivate = async (id: string, name: string) => {
    const confirmed = confirm(
      `Bạn có chắc muốn chuyển nhân viên ${name} sang trạng thái nghỉ việc? Hành động này không xóa dữ liệu cũ của nhân viên.`,
    )
    if (!confirmed) return

    try {
      await staffApi.deactivate(id)
      await fetchStaff()
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const filteredStaff = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return staff.filter((member) => {
      const matchesSearch =
        !normalizedQuery ||
        member.fullName.toLowerCase().includes(normalizedQuery) ||
        member.staffCode.toLowerCase().includes(normalizedQuery) ||
        member.phone?.includes(searchQuery)

      const matchesStatus = statusFilter === 'ALL' || member.status === statusFilter
      const matchesRole = roleFilter === 'ALL' || member.role?.id === roleFilter

      return matchesSearch && matchesStatus && matchesRole
    })
  }, [roleFilter, searchQuery, staff, statusFilter])

  // Compute visible tabs based on permissions
  const visibleTabs = useMemo(() => {
    return STAFF_TABS.filter((tab) => {
      if (tab.id === 'roles') return canViewRoles
      return true
    })
  }, [canViewRoles])

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Đang kiểm tra quyền truy cập...</div>
  }

  if (!canViewStaff) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Đang chuyển hướng...</div>
  }

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title="Quản lý nhân sự"
        description="Quản lý danh sách nhân viên, hợp đồng và phân quyền truy cập"
        icon={Briefcase}
        actions={
          activeTab === 'staff' && canCreateStaff ? (
            <button
              onClick={() => {
                setSelectedStaff(null)
                setIsModalOpen(true)
              }}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 font-bold text-white shadow-md shadow-primary-500/20 transition-all hover:scale-[1.02] hover:bg-primary-600 active:scale-95"
            >
              <Plus size={20} />
              <span>Thêm nhân viên</span>
            </button>
          ) : null
        }
      />

      {/* Tab Navigation */}
      {visibleTabs.length > 1 ? (
        <div className="relative flex items-center gap-1 rounded-xl border border-border/50 bg-background-secondary p-1">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all',
                  isActive
                    ? 'text-white'
                    : 'text-foreground-muted hover:text-foreground-base',
                )}
              >
                {isActive ? (
                  <motion.div
                    layoutId="staff-tab-bg"
                    className="absolute inset-0 rounded-lg bg-primary-500 shadow-sm shadow-primary-500/20"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                ) : null}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon size={16} />
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      {/* Tab Content */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'staff' ? (
            <>
              <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border/50 bg-background-secondary p-4 shadow-sm md:flex-row">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Tìm theo tên, mã NV, SĐT..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full rounded-xl border border-border/60 bg-background-base px-4 py-3 pl-11 text-sm text-foreground-base outline-none transition-all placeholder:text-foreground-muted focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                  <Search size={20} className="absolute left-4 top-3 h-5 w-5 text-foreground-muted" />
                </div>

                {roles.length > 0 ? (
                  <select
                    className="min-w-[180px] appearance-none rounded-xl border border-border/60 bg-background-base px-4 py-3 text-sm text-foreground-base outline-none focus:border-primary-500"
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                  >
                    <option value="ALL">Tất cả chức vụ</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                ) : null}

                <select
                  className="min-w-[180px] appearance-none rounded-xl border border-border/60 bg-background-base px-4 py-3 text-sm text-foreground-base outline-none focus:border-primary-500"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
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
                  <button
                    onClick={() => void fetchStaff()}
                    className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold transition-colors hover:bg-red-500/20"
                  >
                    Thử lại
                  </button>
                </div>
              ) : loading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2A2D3C] border-t-primary-500" />
                    <p className="text-foreground-muted">Đang tải danh sách nhân viên...</p>
                  </div>
                </div>
              ) : (
                <StaffGrid
                  staffList={filteredStaff}
                  canEdit={canEditStaff}
                  canDeactivate={canDeactivateStaff}
                  onEdit={(member) => {
                    setSelectedStaff(member)
                    setIsModalOpen(true)
                  }}
                  onDeactivate={handleDeactivate}
                />
              )}
            </>
          ) : (
            <TabRolesPermissions />
          )}
        </motion.div>
      </AnimatePresence>

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
