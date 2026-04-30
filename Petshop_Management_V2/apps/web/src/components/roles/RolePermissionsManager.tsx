'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import {
  getReadScopeCodes,
  getSelectedReadScope,
  READ_SCOPE_LABELS,
  READ_SCOPE_LEVELS,
  type ReadScopeLevel,
} from '@petshop/auth'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthorization } from '@/hooks/useAuthorization'
import { rolesApi } from '@/lib/api'
import { cn } from '@/lib/utils'

type PermissionDefinition = {
  code: string
  label: string
  description?: string
  kind?: 'read' | 'action' | 'settings' | 'sensitive'
  scopeGroup?: string
  defaultScope?: ReadScopeLevel
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

const HIDDEN_ROLE_CODES = new Set(['SUPER_ADMIN'])

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

function isReadScopePermission(permission: PermissionDefinition): boolean {
  return Boolean(permission.scopeGroup && permission.code.includes('.read.scope.'))
}

function getPrimaryReadPermission(group: PermissionGroup): PermissionDefinition | undefined {
  return group.permissions.find(
    (permission) =>
      permission.kind === 'read' &&
      !isReadScopePermission(permission) &&
      (permission.code === `${group.key}.read` || permission.code.endsWith('.read')),
  )
}

function getSelectablePermissions(group: PermissionGroup, includeSettings: boolean): PermissionDefinition[] {
  return group.permissions.filter((permission) => {
    if (isReadScopePermission(permission)) return false
    if (permission.kind === 'settings') return includeSettings
    return !includeSettings
  })
}

function matchesSearch(group: PermissionGroup, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  if (group.label.toLowerCase().includes(normalizedQuery)) return true
  return group.permissions.some((permission) => {
    return (
      permission.label.toLowerCase().includes(normalizedQuery) ||
      permission.code.toLowerCase().includes(normalizedQuery)
    )
  })
}

function applyReadScope(
  currentPermissions: string[],
  group: PermissionGroup,
  scope: ReadScopeLevel | 'none',
): string[] {
  const readPermission = getPrimaryReadPermission(group)
  if (!readPermission?.scopeGroup) return currentPermissions

  const scopeCodes = getReadScopeCodes(readPermission.scopeGroup)
  const next = currentPermissions.filter(
    (permission) => permission !== readPermission.code && !scopeCodes.includes(permission),
  )

  if (scope === 'none') return next
  return [...new Set([...next, readPermission.code, `${readPermission.scopeGroup}.read.scope.${scope}`])]
}

function PermissionTile({
  permission,
  checked,
  disabled,
  onToggle,
}: {
  permission: PermissionDefinition
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-all',
        disabled
          ? 'cursor-not-allowed border-border/30 opacity-60'
          : checked
            ? 'border-primary-500/40 bg-primary-500/5'
            : permission.kind === 'sensitive'
              ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50'
              : 'border-border/40 hover:border-primary-500/30',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="mt-0.5 h-3.5 w-3.5 rounded accent-primary-500"
      />

      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-tight text-foreground-base">{permission.label}</p>
        <p className="mt-0.5 break-all text-[10px] text-foreground-muted">{permission.code}</p>
      </div>
    </label>
  )
}

function getReadScopeLabel(scope: ReadScopeLevel | 'none'): string {
  return scope === 'none' ? 'Không' : READ_SCOPE_LABELS[scope]
}

export function RolePermissionsManager() {
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

  const editableRoles = useMemo(
    () => roles.filter((role) => !HIDDEN_ROLE_CODES.has(role.code)),
    [roles],
  )

  const loadData = async (selectedRoleId?: string) => {
    setLoading(true)
    try {
      const [rolesData, catalogData] = await Promise.all([rolesApi.list(), rolesApi.catalog()])
      const normalizedRoles = (rolesData as any[]).map((role) => normalizeRole(role, catalogData.legacyAliases))
      const visibleRoles = normalizedRoles.filter((role) => !HIDDEN_ROLE_CODES.has(role.code))

      setRoles(normalizedRoles)
      setCatalog(catalogData)
      setExpandedGroups([])

      if (selectedRoleId) {
        const matchedRole = visibleRoles.find((role) => role.id === selectedRoleId)
        setSelectedRole(matchedRole ? { ...matchedRole } : visibleRoles[0] ? { ...visibleRoles[0] } : null)
        return
      }

      setSelectedRole((current) => {
        if (current?.isNew) return current
        if (current?.id) {
          const matchedRole = visibleRoles.find((role) => role.id === current.id)
          if (matchedRole) return { ...matchedRole }
        }
        return visibleRoles[0] ? { ...visibleRoles[0] } : null
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

  useEffect(() => {
    if (!searchQuery.trim()) return
    setExpandedGroups(filteredGroups.map((group) => group.key))
  }, [filteredGroups, searchQuery])

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

  const setReadScope = (group: PermissionGroup, scope: ReadScopeLevel | 'none') => {
    if (!selectedRole || !canEditRole(selectedRole)) return
    updateSelectedRole({ permissions: applyReadScope(selectedRole.permissions, group, scope) })
  }

  const toggleGroupPermissions = (group: PermissionGroup) => {
    if (!selectedRole || !canEditRole(selectedRole)) return

    const groupPermissions = getSelectablePermissions(group, false)
    const groupCodes = groupPermissions.map((permission) => permission.code)
    const scopeCodes = getReadScopeCodes(group.key)
    const hasFullGroup = groupCodes.every((code) => selectedRole.permissions.includes(code))

    if (hasFullGroup) {
      updateSelectedRole({
        permissions: selectedRole.permissions.filter(
          (permission) => !groupCodes.includes(permission) && !scopeCodes.includes(permission),
        ),
      })
      return
    }

    const readPermission = getPrimaryReadPermission(group)
    const next = selectedRole.permissions.filter((permission) => !scopeCodes.includes(permission))
    const withGroup = [...next, ...groupCodes]

    if (readPermission?.scopeGroup && groupCodes.includes(readPermission.code)) {
      withGroup.push(`${readPermission.scopeGroup}.read.scope.${readPermission.defaultScope ?? 'all'}`)
    }

    updateSelectedRole({ permissions: [...new Set(withGroup)] })
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
    return <div className="animate-pulse py-16 text-center text-foreground-muted">Đang tải cấu hình phân quyền...</div>
  }

  const selectedRoleReadOnly = selectedRole ? !canEditRole(selectedRole) : true
  const canShowDelete = !!selectedRole && !selectedRole.isSystem && !selectedRole.isNew && canDeleteRole

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-primary-500/20 bg-primary-500/10 p-2.5 text-primary-500">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground-base">Vai trò & Phân quyền</h2>
            <p className="mt-0.5 text-sm text-foreground-muted">
              Nhóm quyền có thể thu gọn, chọn toàn bộ theo mục hoặc tùy chỉnh từng quyền con.
            </p>
          </div>
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
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600"
            >
              <Plus size={16} />
              Thêm vai trò
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="max-h-[calc(100vh-220px)] min-h-[320px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
          {editableRoles.map((role) => {
            const isSelected = selectedRole?.id === role.id && !selectedRole?.isNew

            return (
              <button
                key={role.id}
                onClick={() => selectRole(role)}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition-all',
                  isSelected
                    ? 'border-primary-500 bg-primary-500/10 shadow-sm shadow-primary-500/10'
                    : 'border-border/50 bg-background-secondary hover:border-primary-500/40',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold text-foreground-base">
                      <span className="truncate">{role.name}</span>
                      {role.isSystem ? (
                        <span className="shrink-0 rounded bg-red-500 px-1.5 py-0.5 text-[10px] uppercase text-white">
                          Hệ thống
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-foreground-muted">{role.code}</p>
                  </div>

                  <span className="shrink-0 rounded-full bg-background-elevated px-2 py-1 text-xs font-medium text-foreground-muted">
                    {role._count?.users || 0} NV
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-xs text-foreground-muted">
                  {role.description || 'Chưa có mô tả'}
                </p>
              </button>
            )
          })}

          {editableRoles.length === 0 && !selectedRole?.isNew ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-background-secondary p-5 text-sm text-foreground-muted">
              Không có vai trò có thể chỉnh sửa. Super Admin được ẩn khỏi màn phân quyền và mặc định có toàn quyền.
            </div>
          ) : null}

          {selectedRole?.isNew ? (
            <div className="rounded-2xl border border-dashed border-primary-500/50 bg-primary-500/5 p-4">
              <p className="text-sm font-bold text-foreground-base">Vai trò mới</p>
              <p className="mt-1 text-xs text-foreground-muted">
                Bản nháp chưa lưu. Chọn quyền và nhấn lưu để tạo vai trò.
              </p>
            </div>
          ) : null}
        </div>

        <div className="max-h-[calc(100vh-220px)] min-h-[520px] overflow-y-auto rounded-xl border border-border/50 bg-background-secondary p-4 custom-scrollbar">
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
                      className="flex shrink-0 items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-500 transition-colors hover:bg-red-500/20"
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
                      className="w-full rounded-xl border border-border/60 bg-background-elevated px-3 py-2.5 text-sm outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground-base">Tên vai trò</span>
                    <input
                      value={selectedRole.name}
                      disabled={selectedRoleReadOnly}
                      onChange={(event) => updateSelectedRole({ name: event.target.value })}
                      placeholder="VD: Quản lý bán hàng"
                      className="w-full rounded-xl border border-border/60 bg-background-elevated px-3 py-2.5 text-sm outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-foreground-base">Ghi chú</span>
                    <textarea
                      rows={2}
                      value={selectedRole.description ?? ''}
                      disabled={selectedRoleReadOnly}
                      onChange={(event) => updateSelectedRole({ description: event.target.value })}
                      placeholder="Mô tả ngắn về phạm vi sử dụng của vai trò này"
                      className="w-full resize-none rounded-xl border border-border/60 bg-background-elevated px-3 py-2.5 text-sm outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 2xl:grid-cols-2">
                {filteredGroups.map((group) => {
                  const mainPermissions = getSelectablePermissions(group, false)
                  const settingsPermissions = getSelectablePermissions(group, true)
                  const selectedMainCount = mainPermissions.filter((permission) =>
                    selectedRole.permissions.includes(permission.code),
                  ).length
                  const selectedSettingsCount = settingsPermissions.filter((permission) =>
                    selectedRole.permissions.includes(permission.code),
                  ).length
                  const selectedCount = selectedMainCount + selectedSettingsCount
                  const totalCount = mainPermissions.length + settingsPermissions.length
                  const allChecked = selectedMainCount === mainPermissions.length && mainPermissions.length > 0
                  const indeterminate = selectedMainCount > 0 && selectedMainCount < mainPermissions.length
                  const isExpanded = expandedGroups.includes(group.key)
                  const readPermission = getPrimaryReadPermission(group)
                  const readScope = readPermission?.scopeGroup
                    ? getSelectedReadScope(selectedRole.permissions, readPermission.scopeGroup)
                    : null
                  const hasBaseRead = readPermission ? selectedRole.permissions.includes(readPermission.code) : false
                  const displayedReadScope = hasBaseRead ? readScope ?? readPermission?.defaultScope ?? 'all' : 'none'

                  return (
                    <div key={group.key} className="overflow-hidden rounded-xl border border-border/50">
                      <div className="bg-background-elevated/70 px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            disabled={selectedRoleReadOnly || mainPermissions.length === 0}
                            ref={(node) => {
                              if (node) node.indeterminate = indeterminate
                            }}
                            onChange={() => toggleGroupPermissions(group)}
                            className="h-4 w-4 rounded accent-primary-500"
                          />

                          <button
                            type="button"
                            onClick={() => toggleGroupExpand(group.key)}
                            className="flex flex-1 items-center justify-between gap-4 text-left"
                          >
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="font-semibold text-foreground-base">{group.label}</p>
                              <span className="text-xs text-foreground-muted">
                                {selectedCount}/{totalCount} quyền
                              </span>
                              {readPermission?.scopeGroup ? (
                                <span className="rounded-full bg-primary-500/10 px-2 py-0.5 text-[11px] font-semibold text-primary-500">
                                  Xem: {getReadScopeLabel(displayedReadScope)}
                                </span>
                              ) : null}
                              {selectedSettingsCount > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-500">
                                  <Settings size={11} /> {selectedSettingsCount} cài đặt
                                </span>
                              ) : null}
                            </div>

                            {isExpanded ? (
                              <ChevronDown size={16} className="shrink-0 text-foreground-muted" />
                            ) : (
                              <ChevronRight size={16} className="shrink-0 text-foreground-muted" />
                            )}
                          </button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="space-y-3 border-t border-border/40 bg-background-base px-3 py-3">
                          {readPermission?.scopeGroup ? (
                            <div className="rounded-xl border border-primary-500/25 bg-primary-500/5 p-3">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-foreground-base">Quyền xem</p>
                                  <p className="mt-0.5 text-[11px] text-foreground-muted">{readPermission.code}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-3">
                                {(['none', ...READ_SCOPE_LEVELS] as Array<ReadScopeLevel | 'none'>).map((scope) => (
                                  <button
                                    key={scope}
                                    type="button"
                                    disabled={selectedRoleReadOnly}
                                    onClick={() => setReadScope(group, scope)}
                                    className={cn(
                                      'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                                      displayedReadScope === scope
                                        ? 'border-primary-500 bg-primary-500 text-white'
                                        : 'border-border/50 bg-background-elevated text-foreground-muted hover:border-primary-500/40 hover:text-foreground-base',
                                      selectedRoleReadOnly && 'cursor-not-allowed opacity-60',
                                    )}
                                  >
                                    {getReadScopeLabel(scope)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {mainPermissions
                              .filter((permission) => permission.code !== readPermission?.code)
                              .map((permission) => (
                                <PermissionTile
                                  key={permission.code}
                                  permission={permission}
                                  checked={selectedRole.permissions.includes(permission.code)}
                                  disabled={selectedRoleReadOnly}
                                  onToggle={() => togglePermission(permission.code)}
                                />
                              ))}
                          </div>

                          {settingsPermissions.length > 0 ? (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-500">
                                <Settings size={15} />
                                Cài đặt
                              </div>
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                {settingsPermissions.map((permission) => (
                                  <PermissionTile
                                    key={permission.code}
                                    permission={permission}
                                    checked={selectedRole.permissions.includes(permission.code)}
                                    disabled={selectedRoleReadOnly}
                                    onToggle={() => togglePermission(permission.code)}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}

                {filteredGroups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 px-6 py-10 text-center text-sm text-foreground-muted 2xl:col-span-2">
                    Không tìm thấy nhóm quyền phù hợp với từ khóa hiện tại.
                  </div>
                ) : null}
              </div>

              <div className="sticky bottom-0 mt-5 flex justify-end border-t border-border/40 bg-background-secondary/95 pt-4 backdrop-blur">
                <button
                  onClick={saveRole}
                  disabled={selectedRoleReadOnly || saving}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-colors',
                    selectedRoleReadOnly || saving
                      ? 'cursor-not-allowed bg-neutral-400 text-white/60'
                      : 'bg-primary-500 text-white hover:bg-primary-600',
                  )}
                >
                  <Save size={16} />
                  {saving ? 'Đang lưu...' : selectedRole.isNew ? 'Tạo vai trò' : 'Cập nhật vai trò'}
                </button>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-foreground-muted">
              Vui lòng chọn vai trò để xem phân quyền
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
