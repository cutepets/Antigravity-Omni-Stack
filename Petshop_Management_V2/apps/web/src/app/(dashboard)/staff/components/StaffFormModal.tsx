'use client'
import Image from 'next/image';

import React, { useState, useEffect, useRef } from 'react'
import { Staff, CreateStaffDto, UpdateStaffDto } from '@/lib/api/staff.api'
import { AvatarCropperModal } from './AvatarCropperModal'
import { Camera, User, Phone, Shield, Briefcase, Plus, X, Upload, Edit2, Check, MapPin, ChevronDown } from 'lucide-react'
import { settingsApi } from '@/lib/api'


// Common Dark Input Style
const inputStyle = "w-full rounded-xl border border-border bg-background-elevated px-4 py-3 text-sm text-foreground placeholder-foreground-muted outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all"
const labelStyle = "mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground-muted"

interface StaffFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
  initialData?: Staff | null
  roles: any[]
}

export function StaffFormModal({ isOpen, onClose, onSave, initialData, roles }: StaffFormModalProps) {
  const isEditing = !!initialData

  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    phone: '',
    email: '',
    role: '',
    status: 'WORKING',

    gender: 'MALE',
    employmentType: 'FULL_TIME',
    identityCode: '',
    dob: '',
    emergencyContactTitle: '',
    emergencyContactPhone: '',

    branchId: '',
    authorizedBranchIds: [] as string[],
    joinDate: '',
    baseSalary: '',
    shiftStart: '08:00',
    shiftEnd: '17:00',
    spaCommissionRate: '',
  })

  const [avatarBase64, setAvatarBase64] = useState<string | null>(null)
  const [cropImageObj, setCropImageObj] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Custom dropdown states
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const roleDropdownRef = useRef<HTMLDivElement>(null)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false)
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [branches, setBranches] = useState<any[]>([])

  useEffect(() => {
    // Fetch branches once
    settingsApi.getBranches().then(res => setBranches(res)).catch(err => console.error(err))
  }, [])

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Auto capitalize words
    const capitalized = rawVal.replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });

    setFormData(prev => {
      const next = { ...prev, fullName: capitalized };
      if (!isEditing) {
        if (!capitalized) {
          next.username = '';
        } else {
          const normalized = capitalized
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D")
            .toLowerCase()
            .trim();

          const words = normalized.split(/\s+/).filter(Boolean);
          if (words.length === 1) {
            next.username = words[0];
          } else if (words.length > 1) {
            const lastWord = words.pop();
            const initials = words.map(w => w.charAt(0)).join('');
            next.username = initials + lastWord;
          }
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (initialData && isOpen) {
      setFormData({
        username: initialData.username,
        fullName: initialData.fullName,
        phone: initialData.phone || '',
        email: initialData.email || '',
        role: initialData.role?.id || (roles.length > 0 ? roles[0].id : ''),
        status: initialData.status || 'WORKING',

        gender: initialData.gender || 'MALE',
        employmentType: initialData.employmentType || 'FULL_TIME',
        identityCode: initialData.identityCode || '',
        dob: initialData.dob ? initialData.dob.substring(0, 10) : '',
        emergencyContactTitle: initialData.emergencyContactTitle || '',
        emergencyContactPhone: initialData.emergencyContactPhone || '',

        branchId: (initialData as any).branchId || '',
        authorizedBranchIds: initialData.authorizedBranches?.map(b => b.id) || [],
        joinDate: initialData.joinDate ? initialData.joinDate.substring(0, 10) : '',
        baseSalary: initialData.baseSalary ? String(initialData.baseSalary) : '',
        shiftStart: initialData.shiftStart || '08:00',
        shiftEnd: initialData.shiftEnd || '17:00',
        spaCommissionRate: initialData.spaCommissionRate ? String(initialData.spaCommissionRate) : '',
      })
      setAvatarBase64(initialData.avatar || null)
      setError(null)
    } else if (isOpen) {
      setFormData({
        username: '',
        fullName: '',
        phone: '',
        email: '',
        role: roles.length > 0 ? roles[0].id : '',
        status: 'WORKING',

        gender: 'MALE',
        employmentType: 'FULL_TIME',
        identityCode: '',
        dob: '',
        emergencyContactTitle: '',
        emergencyContactPhone: '',

        branchId: '',
        authorizedBranchIds: [],
        joinDate: new Date().toISOString().substring(0, 10),
        baseSalary: '',
        shiftStart: '08:00',
        shiftEnd: '17:00',
        spaCommissionRate: '',
      })
      setAvatarBase64(null)
      setError(null)
    }
  }, [initialData, isOpen, roles])

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader()
      reader.addEventListener('load', () => setCropImageObj(reader.result?.toString() || null))
      reader.readAsDataURL(e.target.files[0])
    }
  }

  const toggleBranch = (branchId: string) => {
    setFormData(prev => {
      const current = prev.authorizedBranchIds
      const next = current.includes(branchId)
        ? current.filter(id => id !== branchId)
        : [...current, branchId]
      return { ...prev, authorizedBranchIds: next }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload: any = {
        fullName: formData.fullName,
        role: formData.role,
        phone: formData.phone || undefined,
        email: formData.email || undefined,

        gender: formData.gender,
        employmentType: formData.employmentType,
        identityCode: formData.identityCode || undefined,
        dob: formData.dob || undefined,
        emergencyContactTitle: formData.emergencyContactTitle || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,

        branchId: formData.branchId || undefined,
        authorizedBranchIds: formData.authorizedBranchIds,
        joinDate: formData.joinDate || undefined,
        baseSalary: formData.baseSalary ? Number(formData.baseSalary) : undefined,
        shiftStart: formData.shiftStart || undefined,
        shiftEnd: formData.shiftEnd || undefined,
        spaCommissionRate: formData.spaCommissionRate ? Number(formData.spaCommissionRate) : undefined,
        avatar: avatarBase64 || undefined,
      }

      if (isEditing) {
        payload.status = formData.status
      } else {
        payload.username = formData.username
      }

      await onSave(payload)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Có lỗi xảy ra khi lưu nhân viên')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative flex max-h-[95vh] w-full max-w-5xl flex-col rounded-2xl bg-background shadow-2xl ring-1 ring-border/50 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 bg-background px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary-500/20 to-primary-400/20 text-primary-500">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-wide">
                {isEditing ? 'Cập nhật nhân viên' : 'Thêm nhân viên mới'}
              </h2>
              <p className="text-xs text-foreground-muted">Điền đầy đủ thông tin bên dưới để tiếp tục</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-foreground-muted transition-colors hover:bg-white/5 hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-400">
              {error}
            </div>
          )}

          <form id="staff-form" onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8">

            {/* Left Column - Core Info */}
            <div className="flex flex-col gap-6 lg:w-[35%]">
              <div className="rounded-2xl border border-border/50 bg-background-secondary p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <User size={16} className="text-primary-500" />
                  <span className="text-sm font-bold text-foreground uppercase tracking-wider">Thông tin nhân viên</span>
                </div>

                <div className="mb-6 flex justify-center">
                  <div className="relative group cursor-pointer h-[144px] w-[108px] mx-auto rounded-xl ring-4 ring-background-elevated transition-transform hover:scale-105 overflow-hidden">
                    {avatarBase64 ? (
                      <Image src={avatarBase64} alt="Avatar" className="h-full w-full object-cover" width={400} height={400} unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-background-elevated to-background">
                        <Camera size={32} className="text-foreground-muted" />
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2 z-10 hidden group-hover:flex">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-white hover:text-primary-500" onClick={e => e.stopPropagation()}>
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                        <Upload size={12} /> Đổi
                      </label>
                      {avatarBase64 && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setCropImageObj(avatarBase64) }} className="flex items-center gap-1.5 text-xs font-medium text-white hover:text-primary-400">
                          <Edit2 size={12} /> Sửa
                        </button>
                      )}
                    </div>
                  </div>
                  {/* fallback click area if no avatar */}
                  {!avatarBase64 && (
                    <div className="absolute -bottom-3 -right-3 rounded-full bg-primary-500 p-2 text-primary-foreground shadow-lg z-10 border-2 border-background" onClick={() => fileInputRef.current?.click()}>
                      <Plus size={16} strokeWidth={3} />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelStyle}>Họ và tên *</label>
                    <input required type="text" value={formData.fullName} onChange={handleFullNameChange} className={inputStyle} placeholder="Nguyễn Văn A" />
                  </div>

                  {/* Username: always show, disabled when editing */}
                  <div>
                    <label className={labelStyle}>Tên đăng nhập {isEditing ? '' : '*'}</label>
                    <input
                      required={!isEditing}
                      type="text"
                      value={formData.username}
                      disabled={isEditing}
                      onChange={e => setFormData({ ...formData, username: e.target.value })}
                      className={`${inputStyle} ${isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                      placeholder="nva2025"
                    />
                    {!isEditing && (
                      <p className="mt-1.5 text-[11px] text-foreground-muted">Mật khẩu mặc định: <span className="text-foreground font-medium">Petshop@123</span></p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelStyle}>Giới tính</label>
                      <div className="flex rounded-xl bg-background-elevated p-1">
                        {['MALE', 'FEMALE'].map(g => (
                          <button
                            key={g} type="button"
                            onClick={() => setFormData({ ...formData, gender: g })}
                            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${formData.gender === g ? 'bg-primary-500 text-primary-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground'}`}
                          >
                            {g === 'MALE' ? 'Nam' : 'Nữ'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelStyle}>Loại hình</label>
                      <div className="flex rounded-xl bg-background-elevated p-1">
                        {['FULL_TIME', 'PART_TIME'].map(g => (
                          <button
                            key={g} type="button"
                            onClick={() => setFormData({ ...formData, employmentType: g })}
                            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${formData.employmentType === g ? 'bg-primary-500 text-primary-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground'}`}
                          >
                            {g === 'FULL_TIME' ? 'Full-Time' : 'Part-Time'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Secondary Data */}
            <div className="flex flex-col gap-6 lg:w-[65%]">

              {/* Box 1: Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-2xl border border-border/50 bg-background-secondary p-5 shadow-sm">
                <div className="col-span-1 md:col-span-2 mb-2 flex items-center gap-2">
                  <Phone size={16} className="text-primary-500" />
                  <span className="text-sm font-bold text-foreground uppercase tracking-wider">Thông tin liên hệ & cá nhân</span>
                </div>

                <div>
                  <label className={labelStyle}>Số điện thoại</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className={inputStyle} placeholder="0901234567" />
                </div>
                <div>
                  <label className={labelStyle}>Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={inputStyle} placeholder="email@petshop.vn" />
                </div>
                <div>
                  <label className={labelStyle}>Số CCCD</label>
                  <input type="text" value={formData.identityCode} onChange={e => setFormData({ ...formData, identityCode: e.target.value })} className={inputStyle} placeholder="001099000000" />
                </div>
                <div>
                  <label className={labelStyle}>Ngày sinh</label>
                  <input type="date" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} className={inputStyle} />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className={labelStyle}>Liên hệ khẩn cấp</label>
                  <div className="flex">
                    <select
                      value={formData.emergencyContactTitle}
                      onChange={e => setFormData({ ...formData, emergencyContactTitle: e.target.value })}
                      className="rounded-l-xl border border-border bg-background-tertiary px-4 py-3 text-sm text-foreground outline-none focus:border-primary-500 min-w-[120px] appearance-none"
                    >
                      <option value="">Chọn</option>
                      <option value="Ông">Ông</option>
                      <option value="Bà">Bà</option>
                      <option value="Bố">Bố</option>
                      <option value="Mẹ">Mẹ</option>
                      <option value="Anh">Anh</option>
                      <option value="Chị">Chị</option>
                      <option value="Em">Em</option>
                      <option value="Vợ">Vợ</option>
                      <option value="Chồng">Chồng</option>
                      <option value="Con">Con</option>
                      <option value="Khác">Khác</option>
                    </select>
                    <input
                      type="text"
                      value={formData.emergencyContactPhone}
                      onChange={e => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                      className="w-full rounded-r-xl border-y border-r border-border bg-background-tertiary px-4 py-3 text-sm text-foreground placeholder-foreground-muted outline-none focus:border-primary-500"
                      placeholder="Số điện thoại"
                    />
                  </div>
                </div>
              </div>

              {/* Box 2: Contract Info — no longer contains branch */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-2xl border border-border/50 bg-background-secondary p-5 shadow-sm">
                <div className="col-span-1 md:col-span-3 mb-2 flex items-center gap-2">
                  <Briefcase size={16} className="text-purple-400" />
                  <span className="text-sm font-bold text-foreground uppercase tracking-wider">Hợp đồng & Ca làm việc</span>
                </div>

                <div className="md:col-span-1">
                  <label className={labelStyle}>Ngày vào làm</label>
                  <input type="date" value={formData.joinDate} onChange={e => setFormData({ ...formData, joinDate: e.target.value })} className={inputStyle} />
                </div>
                <div className="md:col-span-1">
                  <label className={labelStyle}>Lương cơ bản</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.baseSalary ? Number(formData.baseSalary).toLocaleString('vi-VN') : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '')
                        setFormData({ ...formData, baseSalary: raw })
                      }}
                      className={`${inputStyle} pr-14`}
                      placeholder="5.000.000"
                    />
                    <span className="absolute right-4 top-3 text-foreground-muted text-sm pointer-events-none">VNĐ</span>
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className={labelStyle}>% Thưởng Spa</label>
                  <div className="relative">
                    <input type="number" value={formData.spaCommissionRate} onChange={e => setFormData({ ...formData, spaCommissionRate: e.target.value })} className={inputStyle} placeholder="Vd: 10" />
                    <span className="absolute right-4 top-3 text-foreground-muted text-sm">%</span>
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className={labelStyle}>Giờ vào</label>
                  <input type="time" value={formData.shiftStart} onChange={e => setFormData({ ...formData, shiftStart: e.target.value })} className={inputStyle} />
                </div>
                <div className="md:col-span-1">
                  <label className={labelStyle}>Giờ ra</label>
                  <input type="time" value={formData.shiftEnd} onChange={e => setFormData({ ...formData, shiftEnd: e.target.value })} className={inputStyle} />
                </div>
              </div>

              {/* Box 3: Roles & Branch Assignment */}
              <div className="rounded-2xl border border-border/50 bg-background-secondary p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Shield size={16} className="text-orange-400" />
                  <span className="text-sm font-bold text-foreground uppercase tracking-wider">Phân quyền & Chi nhánh thao tác</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                  <div ref={roleDropdownRef} className="relative">
                    <label className={labelStyle}>Vai trò chính</label>
                    <button
                      type="button"
                      onClick={() => setRoleDropdownOpen(prev => !prev)}
                      className={`${inputStyle} appearance-none flex items-center justify-between gap-2 text-left`}
                    >
                      <span className="truncate">
                        {roles.find(r => r.id === formData.role)?.name || 'Chọn vai trò'}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 text-foreground-muted transition-transform duration-200 ${roleDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {roleDropdownOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-100 max-h-48 overflow-y-auto rounded-xl border border-border bg-background shadow-2xl custom-scrollbar ring-1 ring-black/5">
                        {roles.map(r => {
                          const isActive = formData.role === r.id
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, role: r.id })
                                setRoleDropdownOpen(false)
                              }}
                              className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors ${isActive
                                ? 'bg-primary-500/12 text-primary-500 font-semibold'
                                : 'text-foreground hover:bg-background-tertiary'
                                }`}
                            >
                              <span className="truncate">{r.name}</span>
                              {isActive && <Check size={14} className="shrink-0 text-primary-500" />}
                            </button>
                          )
                        })}
                        {roles.length === 0 && (
                          <p className="px-4 py-3 text-xs text-foreground-muted text-center">Chưa có vai trò nào</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Multi-branch selector */}
                <div>
                  <label className={labelStyle}>
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-primary-500" />
                      <span>Chi nhánh thao tác</span>
                    </div>
                  </label>
                  <p className="mb-3 text-xs text-foreground-muted">
                    Chọn các chi nhánh mà nhân viên được phép thao tác. Khi bán hàng có thể chuyển đổi giữa các chi nhánh đã chọn.
                  </p>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {branches.map(branch => {
                      const isSelected = formData.authorizedBranchIds.includes(branch.id)
                      return (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => toggleBranch(branch.id)}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all ${isSelected
                            ? 'border-primary-500/50 bg-primary-500/10 ring-1 ring-primary-500/30'
                            : 'border-border/50 bg-background-elevated hover:border-border'
                            }`}
                        >
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-primary-500' : 'text-foreground'}`}>
                              {branch.name}
                            </p>
                            {branch.address && (
                              <p className="mt-0.5 truncate text-xs text-foreground-muted">{branch.address}</p>
                            )}
                          </div>
                          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all ${isSelected
                            ? 'bg-primary-500 text-primary-foreground'
                            : 'border border-border'
                            }`}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </button>
                      )
                    })}
                    {branches.length === 0 && (
                      <p className="col-span-2 py-4 text-center text-xs text-foreground-muted">Chưa có chi nhánh nào. Vui lòng tạo chi nhánh trước.</p>
                    )}
                  </div>

                  {formData.authorizedBranchIds.length > 0 && (
                    <p className="mt-2 text-xs text-primary-500">
                      Đã chọn {formData.authorizedBranchIds.length} chi nhánh
                    </p>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer actions */}
        <div className="border-t border-border/50 bg-background p-5 flex justify-end gap-4 sticky bottom-0 z-10">
          <button type="button" onClick={onClose} disabled={loading} className="px-6 py-3 rounded-xl bg-background-elevated text-foreground font-medium hover:bg-background-secondary transition-colors border border-border/50">
            Đóng
          </button>
          <button type="submit" form="staff-form" disabled={loading} className="px-8 py-3 rounded-xl bg-linear-to-r from-primary-500 to-primary-400 text-primary-foreground font-bold shadow-lg shadow-primary-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2">
            {loading ? <span className="animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground h-4 w-4" /> : null}
            {isEditing ? 'Lưu cập nhật' : 'Tạo mới nhân sự'}
          </button>
        </div>
      </div>

      {cropImageObj && (
        <AvatarCropperModal
          isOpen={true}
          onClose={() => setCropImageObj(null)}
          imageSrc={cropImageObj}
          onCropCompleteAction={(base64) => {
            setAvatarBase64(base64)
            setCropImageObj(null)
          }}
        />
      )}
    </div>
  )
}