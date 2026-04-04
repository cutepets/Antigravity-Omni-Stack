'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Plus, X, User, Phone, Mail, MapPin, AlignLeft,
  Building2, Receipt, CreditCard, ToggleLeft, ToggleRight, FileText
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customerApi } from '@/lib/api/customer.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import type { Customer } from '@petshop/shared'

const customerSchema = z.object({
  fullName: z.string().min(1, 'Vui lòng nhập tên khách hàng'),
  phone: z.string().min(1, 'Vui lòng nhập số điện thoại'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
  tier: z.string().optional(),
  // Extended fields
  taxCode: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  companyName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
})

type CustomerFormValues = z.infer<typeof customerSchema>

interface Props {
  isOpen: boolean
  onClose: () => void
  initialData?: Customer | null
}

const TIER_OPTIONS = [
  { value: 'BRONZE', label: '🥉 Đồng (Bronze)' },
  { value: 'SILVER', label: '🥈 Bạc (Silver)' },
  { value: 'GOLD', label: '🥇 Vàng (Gold)' },
  { value: 'DIAMOND', label: '💎 Kim cương' },
]

export function CustomerFormModal({ isOpen, onClose, initialData }: Props) {
  const queryClient = useQueryClient()
  const isEditing = !!initialData
  const [showAdvanced, setShowAdvanced] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      fullName: '', phone: '', email: '', address: '', notes: '',
      tier: 'BRONZE', taxCode: '', description: '', isActive: true,
      companyName: '', bankAccount: '', bankName: '',
    },
  })

  const isActive = watch('isActive')

  useEffect(() => {
    if (isOpen) {
      reset({
        fullName: initialData?.fullName || '',
        phone: initialData?.phone || '',
        email: initialData?.email || '',
        address: initialData?.address || '',
        notes: initialData?.notes || '',
        tier: initialData?.tier || 'BRONZE',
        taxCode: (initialData as any)?.taxCode || '',
        description: (initialData as any)?.description || '',
        isActive: (initialData as any)?.isActive ?? true,
        companyName: (initialData as any)?.companyName || '',
        bankAccount: (initialData as any)?.bankAccount || '',
        bankName: (initialData as any)?.bankName || '',
      })
      setShowAdvanced(false)
    }
  }, [isOpen, initialData, reset])

  const createMutation = useMutation({
    mutationFn: customerApi.createCustomer,
    onSuccess: () => {
      toast.success('Thêm khách hàng thành công')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi tạo khách hàng')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: CustomerFormValues) => customerApi.updateCustomer(initialData!.id, data),
    onSuccess: () => {
      toast.success('Cập nhật khách hàng thành công')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật')
    },
  })

  const onSubmit = (data: CustomerFormValues) => {
    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-background-base/80 backdrop-blur-sm" onClick={onClose} />

      <div className="card p-0 relative w-full flex flex-col max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-background-tertiary flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {isEditing ? 'Cập nhật Khách hàng' : 'Thêm Khách hàng mới'}
            </h2>
            <p className="text-sm text-foreground-muted mt-1">
              {isEditing ? 'Cập nhật thông tin khách hàng' : 'Điền thông tin để thêm khách hàng vào hệ thống'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body (scrollable) */}
        <form id="customer-form" onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Tên khách hàng */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">Họ và tên <span className="text-error">*</span></label>
              <div className="relative">
                <div className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground-muted"><User size={18} /></div>
                <input
                  {...register('fullName')}
                  placeholder="Vd: Nguyễn Văn A"
                  className={`form-input pl-10 ${errors.fullName ? 'border-error focus:ring-error/20' : ''}`}
                />
              </div>
              {errors.fullName && <p className="text-error text-xs mt-1.5">{errors.fullName.message}</p>}
            </div>

            {/* SĐT */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Số điện thoại <span className="text-error">*</span></label>
              <div className="relative">
                <div className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground-muted"><Phone size={18} /></div>
                <input 
                  {...register('phone')} 
                  placeholder="0987654321"
                  className={`form-input pl-10 ${errors.phone ? 'border-error focus:ring-error/20' : ''}`}
                />
              </div>
              {errors.phone && <p className="text-error text-xs mt-1.5">{errors.phone.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <div className="relative">
                <div className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground-muted"><Mail size={18} /></div>
                <input 
                  {...register('email')} 
                  placeholder="example@mail.com"
                  className="form-input pl-10"
                />
              </div>
            </div>

            {/* Địa chỉ */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">Địa chỉ</label>
              <div className="relative">
                <div className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground-muted"><MapPin size={18} /></div>
                <input 
                  {...register('address')} 
                  placeholder="Số nhà, đường, phường..."
                  className="form-input pl-10"
                />
              </div>
            </div>

            {/* Ghi chú */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">Ghi chú</label>
              <div className="relative">
                <div className="absolute top-3 left-3 text-foreground-muted"><AlignLeft size={18} /></div>
                <textarea 
                  {...register('notes')} 
                  placeholder="Ghi chú sở thích, đặc điểm..." 
                  rows={2}
                  className="form-input pl-10 py-3 block w-full resize-none"
                />
              </div>
            </div>

            {/* Hạng thành viên */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">Hạng thành viên</label>
              <select {...register('tier')} className="form-input">
                {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* isActive toggle */}
            <div className="md:col-span-2 flex items-center justify-between p-4 bg-background-tertiary rounded-xl border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Trạng thái hoạt động</p>
                <p className="text-xs text-foreground-muted mt-0.5">{isActive ? 'Khách hàng đang hoạt động' : 'Khách hàng bị vô hiệu hoá'}</p>
              </div>
              <button
                type="button"
                onClick={() => setValue('isActive', !isActive)}
                className={`transition-colors ${isActive ? 'text-primary-500' : 'text-foreground-muted'}`}
              >
                {isActive ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
              </button>
            </div>
          </div>

          {/* Advanced section toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors"
          >
            <FileText size={16} />
            {showAdvanced ? 'Ẩn thông tin nâng cao ▲' : 'Thông tin nâng cao (MST, ngân hàng) ▼'}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-background-secondary rounded-xl border border-border animate-in fade-in slide-in-from-top-2">
              
              {/* Mô tả nội bộ */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1.5">Mô tả nội bộ</label>
                <div className="relative">
                  <div className="absolute top-3 left-3 text-foreground-muted"><AlignLeft size={18} /></div>
                  <textarea 
                    {...register('description')} 
                    placeholder="Ghi chú nội bộ về khách hàng..." 
                    rows={2}
                    className="form-input pl-10 py-3 block w-full resize-none"
                  />
                </div>
              </div>

              {/* Mã số thuế */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Mã số thuế</label>
                <div className="relative">
                  <div className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground-muted"><Receipt size={18} /></div>
                  <input {...register('taxCode')} placeholder="0123456789" className="form-input pl-10" />
                </div>
              </div>

              {/* Tên công ty */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Tên công ty</label>
                <div className="relative">
                  <div className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground-muted"><Building2 size={18} /></div>
                  <input {...register('companyName')} placeholder="Công ty TNHH..." className="form-input pl-10" />
                </div>
              </div>

              {/* Số tài khoản */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Số tài khoản</label>
                <div className="relative">
                  <div className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground-muted"><CreditCard size={18} /></div>
                  <input {...register('bankAccount')} placeholder="1234 5678 9012" className="form-input pl-10" />
                </div>
              </div>

              {/* Ngân hàng */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Ngân hàng</label>
                <div className="relative">
                  <div className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground-muted"><Building2 size={18} /></div>
                  <input {...register('bankName')} placeholder="Vietcombank, BIDV..." className="form-input pl-10" />
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-background-tertiary flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline px-6 rounded-xl"
          >
            Huỷ bỏ
          </button>
          <button
            type="submit"
            form="customer-form"
            disabled={isSubmitting}
            className="btn-primary liquid-button px-6 rounded-xl flex items-center gap-2"
          >
            {isSubmitting ? (
              'Đang lưu...'
            ) : (
              <>
                {!isEditing && <Plus size={16} />}
                {isEditing ? 'Lưu thay đổi' : 'Thêm mới'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

