import React, { useState } from 'react'
import { Staff } from '@/lib/api/staff.api'
import { RoleGate } from '@/components/auth/RoleGate'
import { MoreVertical, Mail, Phone, Calendar, Clock, Edit2, UserX, Lock, ChevronRight, MapPin, X } from 'lucide-react'
import Link from 'next/link'

interface StaffGridProps {
  staffList: Staff[]
  onEdit: (staff: Staff) => void
  onDeactivate: (id: string, name: string) => void
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  ADMIN: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  MANAGER: 'text-[#00E5B5] bg-[#00E5B5]/10 border-[#00E5B5]/20',
  STAFF: 'text-[#00D4FF] bg-[#00D4FF]/10 border-[#00D4FF]/20',
  VIEWER: 'text-gray-400 bg-gray-400/10 border-gray-400/20'
}

const STATUS_CONFIG: Record<string, { label: string, classes: string, dot: string }> = {
  WORKING: { label: 'Đang làm', classes: 'text-[#00E5B5]', dot: 'bg-[#00E5B5]' },
  PROBATION: { label: 'Thử việc', classes: 'text-[#3B82F6]', dot: 'bg-[#3B82F6]' },
  LEAVE: { label: 'Nghỉ phép', classes: 'text-indigo-400', dot: 'bg-indigo-400' },
  OFFICIAL: { label: 'Chính thức', classes: 'text-[#00E5B5]', dot: 'bg-[#00E5B5]' },
  RESIGNED: { label: 'Đã nghỉ', classes: 'text-gray-500', dot: 'bg-gray-500' },
  QUIT: { label: 'Đã nghỉ', classes: 'text-gray-500', dot: 'bg-gray-500' }
}

export function StaffGrid({ staffList, onEdit, onDeactivate }: StaffGridProps) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {staffList.map((staff) => {
        const statusConfig = STATUS_CONFIG[staff.status] || STATUS_CONFIG.WORKING

        return (
          <div key={staff.id} className="group relative flex flex-row rounded-2xl border border-border/30 bg-background-secondary shadow-sm transition-all hover:border-border/60 hover:shadow-md hover:bg-background-elevated overflow-hidden cursor-pointer" onClick={() => window.location.href = `/staff/${staff.username}`}>
            
            {/* Avatar Section */}
            <div className="relative shrink-0 w-28 sm:w-32 bg-[#2A2B3D]">
              <div className="h-full w-full">
                {staff.avatar ? (
                  <img 
                    src={staff.avatar} 
                    alt={staff.fullName} 
                    className="h-full w-full object-cover cursor-zoom-in min-h-[150px]" 
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreviewImage(staff.avatar!)
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500/20 to-purple-600/20 text-xl font-bold text-purple-400 uppercase">
                    {staff.fullName.split(' ').map(n => n[0]).slice(-2).join('')}
                  </div>
                )}
              </div>
              <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#facc15] shadow-sm ring-2 ring-background-secondary">
                <Lock size={10} className="text-black" />
              </div>
            </div>

            {/* Info Section */}
            <div className="flex flex-1 flex-col justify-center p-5">
              
              <div className="flex items-start justify-between">
                <div className="hover:underline transition-colors block">
                  <h3 className="text-[15px] font-bold text-foreground-base line-clamp-1">{staff.fullName}</h3>
                </div>
                <span className="shrink-0 rounded-md border border-border/40 px-2 py-0.5 text-[10px] font-bold uppercase text-foreground-muted bg-background-base/50">
                  {staff.role?.name || 'Nhân viên'}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <span className="text-[13px] text-foreground-secondary">@{staff.username}</span>
                <div className={`flex items-center gap-1.5 rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-medium ${statusConfig.classes} bg-current/10`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                  {statusConfig.label}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[13px] text-foreground-secondary">
                  <Phone size={13} />
                  <span>{staff.phone || 'Chưa cập nhật'}</span>
                </div>
                <span className="rounded-md bg-[#6366f1]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#818cf8]">
                  {staff.employmentType === 'PART_TIME' ? 'PART-TIME' : 'FULL-TIME'}
                </span>
                {staff.branch && (
                   <span className="rounded-md bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-bold text-teal-400 flex items-center gap-1">
                     <MapPin size={10} /> {staff.branch.name}
                   </span>
                )}
              </div>
            </div>
            
            <div className="absolute bottom-3 right-3 text-foreground-secondary opacity-50 group-hover:opacity-100 transition-opacity">
              <ChevronRight size={16} />
            </div>
          </div>
        )
      })}

      {/* Full Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
          />
          <button 
            className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full hover:bg-white/20 transition-colors"
            onClick={() => setPreviewImage(null)}
          >
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  )
}
