'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Save, Search, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthorization } from '@/hooks/useAuthorization'
import { rolesApi } from '@/lib/api'

type PermissionDefinition = {
  code: string
  label: string
  description?: string
}

type PermissionGroup = {
  key: string
  label: string
  description?: string
  permissions: PermissionDefinition[]
}

type PermissionCatalog = {
  groups: PermissionGroup[]
  legacyAliases: Record<string, string[]>
}

type RoleRecord = {
  id?: string
  code: string
  name: string
  description?: string | null
  permissions: string[]
  isSystem: boolean
  _count?: {
    users: number
  }
  isNew?: boolean
}

function createEmptyRole(): RoleRecord {
  return {
    code: '',
    name: '',
    description: '',
    permissions: [],
    isSystem: false,
    isNew: true,
    _count: { users: 0 },
  }
}

function expandPermissions(
  permissions: string[] | undefined,
  legacyAliases: Record<string, string[]>,
): string[] {
  const resolved = new Set<string>()

  const visit = (code: string) => {
    if (!code || resolved.has(code)) return
    resolved.add(code)
    for (const child of legacyAliases[code] ?? []) {
      visit(child)
    }
  }

  for (const permission of permissions ?? []) {
    visit(permission)
  }

  return [...resolved]
}

function normalizeRole(role: any, legacyAliases: Record<string, string[]>): RoleRecord {
  return {
    ...role,
    permissions: expandPermissions(role.permissions, legacyAliases),
    description: role.description ?? '',
  }
}

function summarizeGroup(role: RoleRecord, group: PermissionGroup): string {
  const activeLabels = group.permissions
    .filter((permission) => role.permissions.includes(permission.code))
    .map((permission) => permission.label)

  return activeLabels.length > 0 ? activeLabels.join(', ') : 'Chưa chọn quyền nào'
}

function matchesSearch(group: PermissionGroup, query: string): boolean {
  if (!query) return true
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  if (group.label.toLowerCase().includes(normalizedQuery)) return true
  return group.permissions.some((permission) => permission.label.toLowerCase().includes(normalizedQuery))
}

export function TabRoles() {
  const { hasPermission } = useAuthorization()
  const canCreateRole = hasPermission('role.create')
  const canUpdateRole = hasPermission('role.update')
  const canDeleteRole = hasPermission('role.delete')

  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [selectedRole, setSelectedRole] = useState<RoleRecord | null>(null)
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  const canEditRole = (role: RoleRecord | null | undefined) => {
    if (!role || role.isSystem) return false
    return role.isNew ? canCreateRole : canUpdateRole
  }

  const loadData = async (selectedRoleId?: string) => {
    setLoading(true)
    try {
      const [rolesData, catalogData] = await Promise.all([rolesApi.list(), rolesApi.catalog()])
      const normalizedRoles = (rolesData as any[]).map((role) => normalizeRole(role, catalogData.legacyAliases))

      setRoles(normalizedRoles)
      setCatalog(catalogData)
      setExpandedGroups(catalogData.groups.map((group: PermissionGroup) => group.key))

      if (selectedRoleId) {
        const matchedRole = normalizedRoles.find((role) => role.id === selectedRoleId)
        setSelectedRole(matchedRole ? { ...matchedRole } : normalizedRoles[0] ? { ...normalizedRoles[0] } : null)
        return
      }

      setSelectedRole((current) => {
        if (current?.isNew) return current
        if (current?.id) {
          const matchedRole = normalizedRoles.find((role) => role.id === current.id)
          if (matchedRole) return { ...matchedRole }
        }
        return normalizedRoles[0] ? { ...normalizedRoles[0] } : null
      })
    } catch (error) {
      console.error(error)
      toast.error('Lỗi tải danh sách vai trò và catalog quyền')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredGroups = useMemo(
    () => (catalog?.groups ?? []).filter((group) => matchesSearch(group, searchQuery)),
    [catalog?.groups, searchQuery],
  )

  const selectRole = (role: RoleRecord) => {
    setSelectedRole({ ...role, permissions: [...role.permissions] })
  }

  const createRoleDraft = () => {
    if (!canCreateRole) {
      toast.error('Bạn không có quyền tạo vai trò')
      return
    }
    setSelectedRole(createEmptyRole())
  }

  const updateSelectedRole = (patch: Partial<RoleRecord>) => {
    setSelectedRole((current) => {
      if (!current || !canEditRole(current)) return current
      return { ...current, ...patch }
    })
  }

  const togglePermission = (permissionCode: string) => {
    if (!selectedRole || !canEditRole(selectedRole)) return

    const hasCurrentPermission = selectedRole.permissions.includes(permissionCode)
    const nextPermissions = hasCurrentPermission
      ? selectedRole.permissions.filter((permission) => permission !== permissionCode)
      : [...selectedRole.permissions, permissionCode]

    updateSelectedRole({ permissions: nextPermissions })
  }

  const toggleGroupPermissions = (group: PermissionGroup) => {
    if (!selectedRole || !canEditRole(selectedRole)) return

    const groupCodes = group.permissions.map((permission) => permission.code)
    const hasFullGroup = groupCodes.every((code) => selectedRole.permissions.includes(code))

    if (hasFullGroup) {
      updateSelectedRole({
        permissions: selectedRole.permissions.filter((permission) => !groupCodes.includes(permission)),
      })
      return
    }

    updateSelectedRole({
      permissions: [...new Set([...selectedRole.permissions, ...groupCodes])],
    })
  }

  const toggleGroupExpand = (groupKey: string) => {
    setExpandedGroups((current) =>
      current.includes(groupKey) ? current.filter((key) => key !== groupKey) : [...current, groupKey],
    )
  }

  const saveRole = async () => {
    if (!selectedRole || !canEditRole(selectedRole)) return

    const code = selectedRole.code.trim().toUpperCase()
    const name = selectedRole.name.trim()

    if (!code) {
      toast.error('Mã vai trò là bắt buộc')
      return
    }

    if (!name) {
      toast.error('Tên vai trò là bắt buộc')
      return
    }

    setSaving(true)

    try {
      const payload = {
        code,
        name,
        description: selectedRole.description?.trim() || undefined,
        permissions: selectedRole.permissions,
      }

      const savedRole = selectedRole.isNew
        ? await rolesApi.create(payload)
        : await rolesApi.update(selectedRole.id!, payload)

      toast.success(selectedRole.isNew ? 'Đã tạo vai trò mới' : 'Đã cập nhật vai trò')
      await loadData(savedRole.id)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Lỗi lưu vai trò')
    } finally {
      setSaving(false)
    }
  }

  const deleteRole = async () => {
    if (!selectedRole || selectedRole.isSystem || selectedRole.isNew) return
    if (!canDeleteRole) {
      toast.error('Bạn không có quyền xóa vai trò')
      return
    }
    if (!confirm(`Bạn có chắc muốn xóa vai trò "${selectedRole.name}"?`)) return

    try {
      await rolesApi.delete(selectedRole.id!)
      toast.success('Đã xóa vai trò thành công')
      await loadData()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi xóa vai trò')
    }
  }

  if (loading) {
    return <div className="animate-pulse p-10 text-center text-foreground-muted">Đang tải cấu hình phân quyền...</div>
  }

  const selectedRoleReadOnly = selectedRole ? !canEditRole(selectedRole) : true
  const canShowDelete = !!selectedRole && !selectedRole.isSystem && !selectedRole.isNew && canDeleteRole

  return (
    <div className="flex min-h-[640px] w-full flex-col overflow-hidden rounded-3xl border border-border/60 bg-background-secondary shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border/50 p-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-lg font-bold text-foreground-base">
            <ShieldAlert className="text-primary-500" size={24} />
            Vai trò & Phân quyền
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Chuẩn hóa quyền theo nhóm nghiệp vụ để dùng chung cho API, giao diện và ma trận vai trò.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[260px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm nhóm quyền hoặc quyền con..."
              className="w-full rounded-xl border border-border/60 bg-background-elevated py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary-500"
            />
          </div>

          {canCreateRole ? (
            <button
              onClick={createRoleDraft}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600"
            >
              <Plus size={16} />
              Thêm vai trò
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          {roles.map((role) => {
            const isSelected = selectedRole?.id === role.id && !selectedRole?.isNew

            return (
              <button
                key={role.id}
                onClick={() => selectRole(role)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-border/50 bg-background-elevated hover:border-primary-500/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold text-foreground-base">
                      {role.name}
                      {role.isSystem ? (
                        <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] uppercase text-white">Hệ thống</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-foreground-muted">{role.code}</p>
                  </div>

                  <span className="rounded-full bg-background-secondary px-2 py-1 text-xs font-medium text-foreground-muted">
                    {role._count?.users || 0} NV
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 text-xs text-foreground-muted">
                  {role.description || 'Chưa có mô tả'}
                </p>
              </button>
            )
          })}

          {selectedRole?.isNew ? (
            <div className="rounded-2xl border border-dashed border-primary-500/50 bg-primary-500/5 p-4">
              <p className="text-sm font-bold text-foreground-base">Vai trò mới</p>
              <p className="mt-1 text-xs text-foreground-muted">Bản nháp chưa lưu. Chọn quyền và nhấn lưu để tạo vai trò.</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-border/50 bg-background-elevated p-6">
          {selectedRole && catalog ? (
            <>
              <div className="flex flex-col gap-5 border-b border-border/40 pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                      <ShieldCheck className="text-primary-500" size={20} />
                      {selectedRole.isNew ? 'Tạo vai trò mới' : selectedRole.name}
                    </h3>
                    <p className="mt-1 text-sm text-foreground-muted">
                      {selectedRole.isSystem
                        ? 'Vai trò hệ thống chỉ xem, không cho sửa trực tiếp.'
                        : selectedRoleReadOnly
                          ? 'Bạn đang ở chế độ chỉ xem cho vai trò này.'
                          : `Đã chọn ${selectedRole.permissions.length} quyền chi tiết.`}
                    </p>
                  </div>

                  {canShowDelete ? (
                    <button
                      onClick={deleteRole}
                      className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-500 transition-colors hover:bg-red-500/20"
                    >
                      <Trash2 size={15} />
                      Xóa vai trò
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground-base">Mã vai trò</span>
                    <input
                      value={selectedRole.code}
                      disabled={selectedRoleReadOnly}
                      onChange={(event) => updateSelectedRole({ code: event.target.value.toUpperCase() })}
                      placeholder="VD: SALES_MANAGER"
                      className="w-full rounded-xl border border-border/60 bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground-base">Tên vai trò</span>
                    <input
                      value={selectedRole.name}
                      disabled={selectedRoleReadOnly}
                      onChange={(event) => updateSelectedRole({ name: event.target.value })}
                      placeholder="VD: Quản lý bán hàng"
                      className="w-full rounded-xl border border-border/60 bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-foreground-base">Ghi chú</span>
                    <textarea
                      rows={3}
                      value={selectedRole.description ?? ''}
                      disabled={selectedRoleReadOnly}
                      onChange={(event) => updateSelectedRole({ description: event.target.value })}
                      placeholder="Mô tả ngắn về phạm vi sử dụng của vai trò này"
                      className="w-full resize-none rounded-xl border border-border/60 bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {filteredGroups.map((group) => {
                  const selectedCount = group.permissions.filter((permission) =>
                    selectedRole.permissions.includes(permission.code),
                  ).length
                  const allChecked = selectedCount === group.permissions.length && group.permissions.length > 0
                  const indeterminate = selectedCount > 0 && selectedCount < group.permissions.length
                  const isExpanded = expandedGroups.includes(group.key)

                  return (
                    <div key={group.key} className="overflow-hidden rounded-2xl border border-border/50">
                      <div className="bg-background-secondary/70 px-4 py-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            disabled={selectedRoleReadOnly}
                            ref={(node) => {
                              if (node) node.indeterminate = indeterminate
                            }}
                            onChange={() => toggleGroupPermissions(group)}
                            className="mt-1 h-4 w-4 rounded accent-primary-500"
                          />

                          <button
                            type="button"
                            onClick={() => toggleGroupExpand(group.key)}
                            className="flex flex-1 items-start justify-between gap-4 text-left"
                          >
                            <div>
                              <p className="font-semibold text-foreground-base">{group.label}</p>
                              <p className="mt-1 text-xs text-foreground-muted">
                                {selectedCount}/{group.permissions.length} quyền
                              </p>
                            </div>

                            {isExpanded ? (
                              <ChevronDown size={18} className="mt-0.5 shrink-0 text-foreground-muted" />
                            ) : (
                              <ChevronRight size={18} className="mt-0.5 shrink-0 text-foreground-muted" />
                            )}
                          </button>
                        </div>

                        <p className="mt-3 pl-7 text-sm italic text-foreground-muted">
                          Có quyền: {summarizeGroup(selectedRole, group)}
                        </p>
                      </div>

                      {isExpanded ? (
                        <div className="border-t border-border/40 bg-background-elevated px-4 py-4">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                            {group.permissions.map((permission) => {
                              const isChecked = selectedRole.permissions.includes(permission.code)

                              return (
                                <label
                                  key={permission.code}
                                  className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                                    selectedRoleReadOnly
                                      ? 'border-border/40 bg-background-secondary/50 opacity-70'
                                      : isChecked
                                        ? 'border-primary-500/40 bg-primary-500/5'
                                        : 'border-border/40 hover:border-primary-500/30'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={selectedRoleReadOnly}
                                    onChange={() => togglePermission(permission.code)}
                                    className="mt-1 h-4 w-4 rounded accent-primary-500"
                                  />

                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground-base">{permission.label}</p>
                                    <p className="mt-1 break-all text-[11px] text-foreground-muted">{permission.code}</p>
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}

                {filteredGroups.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center text-foreground-muted">
                    Không tìm thấy nhóm quyền phù hợp với từ khóa hiện tại.
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex justify-end border-t border-border/40 pt-5">
                <button
                  onClick={saveRole}
                  disabled={selectedRoleReadOnly || saving}
                  className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-colors ${
                    selectedRoleReadOnly || saving
                      ? 'cursor-not-allowed bg-neutral-400 text-white/60'
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  }`}
                >
                  <Save size={16} />
                  {saving ? 'Đang lưu...' : selectedRole.isNew ? 'Tạo vai trò' : 'Cập nhật vai trò'}
                </button>
              </div>
            </>
          ) : (
            <div className="py-24 text-center text-foreground-muted">Vui lòng chọn vai trò để xem phân quyền</div>
          )}
        </div>
      </div>
    </div>
  )
}
