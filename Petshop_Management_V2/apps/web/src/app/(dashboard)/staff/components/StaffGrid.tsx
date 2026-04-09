'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Edit2, Lock, MapPin, Phone, UserX, X } from 'lucide-react'
import { Staff } from '@/lib/api/staff.api'

interface StaffGridProps {
  staffList: Staff[]
  canEdit: boolean
  canDeactivate: boolean
  onEdit: (staff: Staff) => void
  onDeactivate: (id: string, name: string) => void
}

const STATUS_CONFIG: Record<string, { label: string; classes: string; dot: string }> = {
  WORKING: { label: 'Đang làm', classes: 'text-[#00E5B5]', dot: 'bg-[#00E5B5]' },
  PROBATION: { label: 'Thử việc', classes: 'text-[#3B82F6]', dot: 'bg-[#3B82F6]' },
  LEAVE: { label: 'Nghỉ phép', classes: 'text-indigo-400', dot: 'bg-indigo-400' },
  OFFICIAL: { label: 'Chính thức', classes: 'text-[#00E5B5]', dot: 'bg-[#00E5B5]' },
  RESIGNED: { label: 'Đã nghỉ', classes: 'text-gray-500', dot: 'bg-gray-500' },
  QUIT: { label: 'Đã nghỉ', classes: 'text-gray-500', dot: 'bg-gray-500' },
}

export function StaffGrid({
  staffList,
  canEdit,
  canDeactivate,
  onEdit,
  onDeactivate,
}: StaffGridProps) {
  const router = useRouter()
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  if (staffList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-background-secondary py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background-elevated text-foreground-muted">
          <UserX size={32} />
        </div>
        <p className="mt-4 text-foreground-secondary">Không tìm thấy nhân viên nào</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {staffList.map((staff) => {
          const statusConfig = STATUS_CONFIG[staff.status] || STATUS_CONFIG.WORKING
          const canShowDeactivate = canDeactivate && staff.status !== 'RESIGNED' && staff.status !== 'QUIT'

          return (
            <div
              key={staff.id}
              className="group relative flex cursor-pointer overflow-hidden rounded-2xl border border-border/30 bg-background-secondary shadow-sm transition-all hover:border-border/60 hover:bg-background-elevated hover:shadow-md"
              onClick={() => router.push(`/staff/${staff.username}`)}
            >
              <div className="relative w-28 shrink-0 bg-[#2A2B3D] sm:w-32">
                <div className="h-full w-full">
                  {staff.avatar ? (
                    <img
                      src={staff.avatar}
                      alt={staff.fullName}
                      className="min-h-[150px] h-full w-full cursor-zoom-in object-cover"
                      onClick={(event) => {
                        event.stopPropagation()
                        setPreviewImage(staff.avatar!)
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500/20 to-purple-600/20 text-xl font-bold uppercase text-purple-400">
                      {staff.fullName
                        .split(' ')
                        .map((part) => part[0])
                        .slice(-2)
                        .join('')}
                    </div>
                  )}
                </div>

                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#facc15] shadow-sm ring-2 ring-background-secondary">
                  <Lock size={10} className="text-black" />
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-center p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 hover:underline">
                    <h3 className="line-clamp-1 text-[15px] font-bold text-foreground-base">{staff.fullName}</h3>
                  </div>
                  <span className="shrink-0 rounded-md border border-border/40 bg-background-base/50 px-2 py-0.5 text-[10px] font-bold uppercase text-foreground-muted">
                    {staff.role?.name || 'Nhân viên'}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-[13px] text-foreground-secondary">@{staff.username}</span>
                  <div
                    className={`flex items-center gap-1.5 rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-[11px] font-medium ${statusConfig.classes}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                    {statusConfig.label}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-[13px] text-foreground-secondary">
                    <Phone size={13} />
                    <span>{staff.phone || 'Chưa cập nhật'}</span>
                  </div>

                  <span className="rounded-md bg-[#6366f1]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#818cf8]">
                    {staff.employmentType === 'PART_TIME' ? 'PART-TIME' : 'FULL-TIME'}
                  </span>

                  {staff.branch ? (
                    <span className="flex items-center gap-1 rounded-md bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-bold text-teal-400">
                      <MapPin size={10} />
                      {staff.branch.name}
                    </span>
                  ) : null}
                </div>
              </div>

              {canEdit || canShowDeactivate ? (
                <div className="absolute right-3 top-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onEdit(staff)
                      }}
                      className="rounded-lg border border-border/50 bg-background-base/90 p-2 text-foreground-secondary transition-colors hover:border-primary-500 hover:text-primary-500"
                      aria-label={`Sửa nhân viên ${staff.fullName}`}
                    >
                      <Edit2 size={14} />
                    </button>
                  ) : null}

                  {canShowDeactivate ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDeactivate(staff.id, staff.fullName)
                      }}
                      className="rounded-lg border border-border/50 bg-background-base/90 p-2 text-foreground-secondary transition-colors hover:border-red-500 hover:text-red-500"
                      aria-label={`Cho nghỉ việc ${staff.fullName}`}
                    >
                      <UserX size={14} />
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="absolute bottom-3 right-3 text-foreground-secondary opacity-50 transition-opacity group-hover:opacity-100">
                <ChevronRight size={16} />
              </div>
            </div>
          )
        })}
      </div>

      {previewImage ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
          <button
            className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-white/20"
            onClick={() => setPreviewImage(null)}
          >
            <X size={24} />
          </button>
        </div>
      ) : null}
    </>
  )
}
