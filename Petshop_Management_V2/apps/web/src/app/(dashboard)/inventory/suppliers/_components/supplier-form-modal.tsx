'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Plus, X, Building2, Phone, Mail, MapPin, AlignLeft
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { stockApi } from '@/lib/api/stock.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'

const supplierSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên nhà cung cấp'),
  phone: z.string().optional(),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
})

type SupplierFormValues = z.infer<typeof supplierSchema>

interface Props {
  isOpen: boolean
  onClose: () => void
  initialData?: any | null
}

export function SupplierFormModal({ isOpen, onClose, initialData }: Props) {
  const queryClient = useQueryClient()
  const isEditing = !!initialData

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '', phone: '', email: '', address: '', notes: '',
    },
  })

  useEffect(() => {
    if (isOpen) {
      reset({
        name: initialData?.name || '',
        phone: initialData?.phone || '',
        email: initialData?.email || '',
        address: initialData?.address || '',
        notes: initialData?.notes || '',
      })
    }
  }, [isOpen, initialData, reset])

  const createMutation = useMutation({
    mutationFn: stockApi.createSupplier,
    onSuccess: () => {
      toast.success('Thêm nhà cung cấp thành công')
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi tạo nhà cung cấp')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: SupplierFormValues) => stockApi.updateSupplier(initialData!.id, data),
    onSuccess: () => {
      toast.success('Cập nhật nhà cung cấp thành công')
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật')
    },
  })

  const onSubmit = (data: SupplierFormValues) => {
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
              {isEditing ? 'Cập nhật Nhà cung cấp' : 'Thêm Nhà cung cấp mới'}
            </h2>
            <p className="text-sm text-foreground-muted mt-1">
              {isEditing ? 'Sửa thông tin đối tác' : 'Điền thông tin để thêm nhà cung cấp vào hệ thống'}
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
        <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Tên NCC */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">Tên nhà cung cấp <span className="text-error">*</span></label>
              <div className="relative">
                <div className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground-muted"><Building2 size={18} /></div>
                <input
                  {...register('name')}
                  placeholder="Vd: Công ty TNHH Vina"
                  className={`form-input pl-10 ${errors.name ? 'border-error focus:ring-error/20' : ''}`}
                />
              </div>
              {errors.name && <p className="text-error text-xs mt-1.5">{errors.name.message}</p>}
            </div>

            {/* SĐT */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Số điện thoại</label>
              <div className="relative">
                <div className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground-muted"><Phone size={18} /></div>
                <input 
                  {...register('phone')} 
                  placeholder="0987654321"
                  className="form-input pl-10"
                />
              </div>
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
                  placeholder="Ghi chú về nhà cung cấp..." 
                  rows={3}
                  className="form-input pl-10 py-3 block w-full resize-none"
                />
              </div>
            </div>

          </div>
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
            form="supplier-form"
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

