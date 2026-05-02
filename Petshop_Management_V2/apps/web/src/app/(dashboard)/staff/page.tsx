'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ShieldAlert, Users } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageLayout'
import { useAuthorization } from '@/hooks/useAuthorization'
import { rolesApi, settingsApi } from '@/lib/api'
import { BulkUpdateStaffDto, CreateStaffDto, Staff, staffApi, UpdateStaffDto } from '@/lib/api/staff.api'
import { cn } from '@/lib/utils'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { confirmDialog } from '@/components/ui/confirmation-provider'
import { StaffFormModal } from './components/StaffFormModal'
import { StaffList } from './components/StaffList'
import { TabRolesPermissions } from './components/TabRolesPermissions'

type StaffTab = 'staff' | 'roles'
const STAFF_ASSIGNABLE_EXCLUDED_ROLE_CODES = new Set(['SUPER_ADMIN'])

const STAFF_TABS: { id: StaffTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'staff', label: 'Danh sách nhân viên', icon: Users },
  { id: 'roles', label: 'Phân quyền', icon: ShieldAlert },
]

export default function StaffManagementPage() {
  const router = useRouter()
  const { hasPermission, hasAnyPermission, isLoading: isAuthLoading, isSuperAdmin } = useAuthorization()

  const canViewStaff = hasPermission('staff.read')
  const canReadRoles = hasPermission('role.read')
  const canCreateStaff = hasPermission('staff.create') && canReadRoles
  const canEditStaff = hasPermission('staff.update') && canReadRoles
  const canDeactivateStaff = hasPermission('staff.deactivate')
  const canImportStaffExcel = hasAnyPermission(['staff.create', 'staff.update'])
  const canViewRoles = hasAnyPermission(['role.read', 'staff.read'])

  const [activeTab, setActiveTab] = useState<StaffTab>('staff')
  const [staff, setStaff] = useState<Staff[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true)
      const [staffData, rolesData, branchData] = await Promise.all([
        staffApi.getAll(),
        canReadRoles ? rolesApi.list() : Promise.resolve([]),
        settingsApi.getBranches().catch(() => []),
      ])
      setStaff(staffData)
      setRoles(Array.isArray(rolesData) ? rolesData : [])
      setBranches(Array.isArray(branchData) ? branchData : [])
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
    const confirmed = await confirmDialog({
      title: 'Xóa vĩnh viễn nhân viên?',
      description: `Nhân viên "${name}" sẽ bị xóa khỏi DB. Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa vĩnh viễn',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      await staffApi.deactivate(id)
      await fetchStaff()
      toast.success('Đã xóa nhân viên')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const handleBulkDeactivate = async (ids: string[]) => {
    const confirmed = await confirmDialog({
      title: `Xóa vĩnh viễn ${ids.length} nhân viên đã chọn?`,
      description: 'Các nhân viên đã chọn sẽ bị xóa khỏi DB. Hành động này không thể hoàn tác.',
      confirmText: 'Xóa vĩnh viễn',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      const result = await staffApi.bulkDeactivate(ids)
      await fetchStaff()
      if (result.deletedIds?.length > 0) {
        toast.success(`Đã xóa ${result.deletedIds.length} nhân viên`)
      }
      if (result.blocked.length > 0) {
        toast.warning(`${result.blocked.length} nhân viên không thể cập nhật`)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }
  const handleBulkUpdate = async (ids: string[], updates: BulkUpdateStaffDto) => {
    try {
      await staffApi.bulkUpdate(ids, updates)
      await fetchStaff()
      toast.success('Đã cập nhật nhân viên')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }


  // Compute visible tabs based on permissions
  const visibleTabs = useMemo(() => {
    return STAFF_TABS.filter((tab) => {
      if (tab.id === 'roles') return canViewRoles
      return true
    })
  }, [canViewRoles])

  const assignableStaffRoles = useMemo(
    () => roles.filter((role) => !STAFF_ASSIGNABLE_EXCLUDED_ROLE_CODES.has(role.code)),
    [roles],
  )

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Đang kiểm tra quyền truy cập...</div>
  }

  if (!canViewStaff) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Đang chuyển hướng...</div>
  }

  return (
    <PageContainer maxWidth="full" variant="data-list">

      {/* Tab Navigation */}
      {visibleTabs.length > 1 ? (
        <div className="relative flex w-fit items-center gap-2">
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
          className="min-h-0 flex-1 overflow-hidden"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'staff' ? (
            <>
              {error ? (
                <div className="rounded-xl border border-error/20 bg-error/10 p-6 text-center text-error">
                  {error}
                  <button
                    onClick={() => void fetchStaff()}
                    className="mt-4 rounded-lg border border-error/20 bg-error/10 px-4 py-2 text-sm font-semibold transition-colors hover:bg-error/20"
                  >
                    Thử lại
                  </button>
                </div>
              ) : loading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="flex items-center gap-3 text-foreground-muted text-sm">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary-500" />
                    Đang tải danh sách nhân viên...
                  </div>
                </div>
              ) : (
                <StaffList
                  staffList={staff}
                  roles={assignableStaffRoles}
                  branches={branches}
                  canEdit={canEditStaff}
                  canDeactivate={canDeactivateStaff}
                  canBulkDeactivate={canDeactivateStaff && isSuperAdmin()}
                  canCreate={canCreateStaff}
                  canImportExcel={canImportStaffExcel}
                  onImported={fetchStaff}
                  onCreate={() => {
                    setSelectedStaff(null)
                    setIsModalOpen(true)
                  }}
                  onEdit={(member) => {
                    setSelectedStaff(member)
                    setIsModalOpen(true)
                  }}
                  onDeactivate={handleDeactivate}
                  onBulkDeactivate={handleBulkDeactivate}
                  onBulkUpdate={handleBulkUpdate}
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
        roles={assignableStaffRoles}
        branches={branches}
        onSave={handleCreateOrUpdate}
      />
    </PageContainer>
  )
}
