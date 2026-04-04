'use client'

import { useEffect, useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Save, AlertCircle } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { petApi } from '@/lib/api/pet.api'
import { customerApi } from '@/lib/api/customer.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { loadBreedsFromDB, loadTempsFromDB, BreedEntry } from './pet-settings-modal'

const petSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên thú cưng'),
  species: z.string().min(1, 'Vui lòng nhập giống/loài'),
  breed: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'UNKNOWN']).optional(),
  weight: z.number({ invalid_type_error: 'Vui lòng nhập số' }).optional(),
  dateOfBirth: z.string().optional(),
  microchipId: z.string().optional(),
  notes: z.string().optional(),
  customerId: z.string().min(1, 'Vui lòng chọn khách hàng sở hữu'),
  color: z.string().optional(),
  allergies: z.string().optional(),
  temperament: z.string().optional(),
  isActive: z.boolean().optional(),
})

type FormData = z.infer<typeof petSchema>

interface Props {
  isOpen: boolean
  onClose: () => void
  initialData?: any
  fixedCustomerId?: string
}

const SPECIES_LIST = ['Chó', 'Mèo', 'Khác']

export function PetFormModal({ isOpen, onClose, initialData, fixedCustomerId }: Props) {
  const isEditing = !!initialData
  const queryClient = useQueryClient()
  
  const [mounted, setMounted] = useState(false)
  const [breeds, setBreeds] = useState<BreedEntry[]>([])
  const [tempers, setTempers] = useState<string[]>([])
  
  useEffect(() => {
    setMounted(true)
    if (isOpen) {
      loadBreedsFromDB().then(setBreeds).catch(() => {})
      loadTempsFromDB().then(setTempers).catch(() => {})
    }
  }, [isOpen])

  const { data: customerData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: () => customerApi.getCustomers({ limit: 100 }),
    enabled: !fixedCustomerId,
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(petSchema),
    defaultValues: {
      name: initialData?.name || '',
      species: initialData?.species || 'Chó',
      breed: initialData?.breed || '',
      gender: initialData?.gender || 'UNKNOWN',
      weight: initialData?.weight || undefined,
      dateOfBirth: initialData?.dateOfBirth ? new Date(initialData.dateOfBirth).toISOString().split('T')[0] : '',
      microchipId: initialData?.microchipId || '',
      notes: initialData?.notes || '',
      customerId: initialData?.customerId || fixedCustomerId || '',
      color: initialData?.color || '',
      allergies: initialData?.allergies || '',
      temperament: initialData?.temperament || '',
      isActive: initialData ? initialData.isActive : true,
    },
  })

  const currentSpecies = watch('species')
  
  const availableBreeds = useMemo(() => {
    return breeds.filter(b => b.species === currentSpecies)
  }, [breeds, currentSpecies])

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload: any = { ...data, dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined }
      return isEditing 
        ? petApi.updatePet({ id: initialData.id, ...payload })
        : petApi.createPet(payload)
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Lưu thú cưng thành công' : 'Thêm thú cưng thành công')
      queryClient.invalidateQueries({ queryKey: ['pets'] })
      queryClient.invalidateQueries({ queryKey: ['customer', fixedCustomerId] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại')
    }
  })

  // Whenever fixedCustomerId changes, update the form value
  useEffect(() => {
    if (fixedCustomerId && !initialData) {
      setValue('customerId', fixedCustomerId)
    }
  }, [fixedCustomerId, initialData, setValue])

  if (!isOpen || !mounted) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-background-base/80 backdrop-blur-sm" onClick={onClose} />

      <div className="card p-0 relative w-full flex flex-col max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-background-tertiary flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {isEditing ? 'Cập nhật thú cưng' : 'Thêm thú cưng mới'}
            </h2>
            <p className="text-sm text-foreground-muted mt-1">
              Đảm bảo điền đầy đủ thông tin để dễ dàng quản lý
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
        <div className="p-6 overflow-y-auto flex-1">
          <form id="pet-form" onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-6">
            
            {!fixedCustomerId && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Khách hàng (Chủ sở hữu) <span className="text-error">*</span></label>
                <select 
                  {...register('customerId')}
                  className={`form-input w-full ${errors.customerId ? 'border-error focus:ring-error/20' : ''}`}
                >
                  <option value="">-- Chọn khách hàng --</option>
                  {!isLoadingCustomers && customerData?.data?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.fullName} - {c.phone}</option>
                  ))}
                </select>
                {errors.customerId && (
                  <p className="text-error text-xs flex items-center gap-1 mt-1.5">
                    <AlertCircle size={12} /> {errors.customerId.message}
                  </p>
                )}
              </div>
            )}

            {isEditing && (
              <div className="flex items-center gap-2 p-4 bg-background-tertiary rounded-xl border border-border mt-2">
                <input 
                  type="checkbox" 
                  id="isActive" 
                  {...register('isActive')} 
                  className="w-4 h-4 rounded border-border text-primary-500 focus:ring-primary-500" 
                />
                <label htmlFor="isActive" className="text-sm font-medium text-foreground cursor-pointer">
                  Đang hoạt động
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Tên bé <span className="text-error">*</span></label>
                <input 
                  {...register('name')} 
                  placeholder="Nhập tên..."
                  className={`form-input w-full ${errors.name ? 'border-error focus:ring-error/20' : ''}`}
                />
                {errors.name && <p className="text-error text-xs mt-1.5">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Loài <span className="text-error">*</span></label>
                <select 
                  {...register('species')}
                  className={`form-input w-full ${errors.species ? 'border-error focus:ring-error/20' : ''}`}
                >
                  {SPECIES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.species && <p className="text-error text-xs mt-1.5">{errors.species.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Giống</label>
                <select 
                  {...register('breed')}
                  className="form-input w-full"
                >
                  <option value="">-- Bỏ qua --</option>
                  {availableBreeds.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                  {currentSpecies === 'Khác' && <option value="Khác">Khác</option>}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Giới tính</label>
                <select 
                  {...register('gender')}
                  className="form-input w-full"
                >
                  <option value="UNKNOWN">Không rõ</option>
                  <option value="MALE">Đực</option>
                  <option value="FEMALE">Cái</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Cân nặng (kg)</label>
                <input 
                  type="number" step="0.1"
                  {...register('weight', { valueAsNumber: true })} 
                  placeholder="1.5"
                  className={`form-input w-full ${errors.weight ? 'border-error focus:ring-error/20' : ''}`}
                />
                {errors.weight && <p className="text-error text-xs mt-1.5">{errors.weight.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Ngày sinh</label>
                <input 
                  type="date"
                  {...register('dateOfBirth')}
                  className="form-input w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Màu sắc</label>
                <input 
                  {...register('color')} 
                  placeholder="Ví dụ: Vàng, Trắng..."
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Tính cách</label>
                <select 
                  {...register('temperament')}
                  className="form-input w-full"
                >
                  <option value="">-- Bỏ qua --</option>
                  {tempers.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Dị ứng / Phản ứng với thuốc</label>
                <input 
                  {...register('allergies')} 
                  placeholder="Có dị ứng với..."
                  className="form-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Mã Microchip</label>
              <input 
                {...register('microchipId')} 
                placeholder="Nhập mã chip nếu có..."
                className="form-input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Mô tả / Ghi chú ngoại hình</label>
              <textarea 
                {...register('notes')} 
                placeholder="Ví dụ: Bé ngoan, hơi nhát người..." 
                rows={3}
                className="form-input py-3 w-full bg-background-base resize-y"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-background-tertiary flex justify-end gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="btn-outline px-6 rounded-xl"
          >
            Hủy bỏ
          </button>
          <button 
            type="submit" 
            form="pet-form" 
            disabled={mutation.isPending}
            className="btn-primary liquid-button flex items-center gap-2 px-6 rounded-xl"
          >
            {mutation.isPending ? 'Đang lưu...' : <><Save size={16} /> Lưu thông tin</>}
          </button>
        </div>
      </div>
    </div>
  )
}

