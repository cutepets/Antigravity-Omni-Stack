'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Save, AlertCircle, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { groomingApi } from '@/lib/api/grooming.api'
import { petApi } from '@/lib/api/pet.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { api } from '@/lib/api'

const groomingSchema = z.object({
  petId: z.string().min(1, 'Vui lòng chọn thú cưng'),
  staffId: z.string().optional(),
  serviceId: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  price: z.number({ invalid_type_error: 'Vui lòng nhập số hợp lệ' }).optional(),
})

type FormData = z.infer<typeof groomingSchema>

interface Props {
  isOpen: boolean
  onClose: () => void
  initialData?: any
}

export function GroomingModal({ isOpen, onClose, initialData }: Props) {
  const isEditing = !!initialData
  const queryClient = useQueryClient()
  
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { data: petsData, isLoading: isLoadingPets } = useQuery({
    queryKey: ['pets', 'all'],
    // fetch without pagination for simplicity
    queryFn: () => petApi.getPets({ limit: 500 }),
  })

  // We fetch a standard list of Groomer users if exists (role STAFF or MANAGER), but for now we just try API or skip
  const { data: staffData } = useQuery({
    queryKey: ['staff', 'all'],
    queryFn: async () => {
      try {
        const res = await api.get('/staff')
        return res.data?.data || []
      } catch (e) {
        return []
      }
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(groomingSchema),
    defaultValues: {
      petId: initialData?.petId || '',
      staffId: initialData?.staffId || '',
      serviceId: initialData?.serviceId || '',
      notes: initialData?.notes || '',
      status: initialData?.status || 'PENDING',
      price: initialData?.price || undefined,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => 
      isEditing 
        ? groomingApi.updateSession({ id: initialData.id, ...data })
        : groomingApi.createSession(data),
    onSuccess: () => {
      toast.success(isEditing ? 'Đã cập nhật phiên' : 'Đã tạo lịch Grooming')
      queryClient.invalidateQueries({ queryKey: ['grooming-sessions'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: groomingApi.deleteSession,
    onSuccess: () => {
      toast.success('Đã xóa phiên Grooming')
      queryClient.invalidateQueries({ queryKey: ['grooming-sessions'] })
      onClose()
    },
  })

  if (!isOpen || !mounted) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div 
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }} 
        onClick={onClose}
      />
      <div 
        style={{ position: 'relative', background: 'white', width: '100%', maxWidth: 500, borderRadius: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #f8fafc, #ffffff)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {isEditing ? 'Cập nhật Grooming' : 'Thêm lịch Grooming'}
          </h2>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '32px' }}>
          <form id="grooming-form" onSubmit={handleSubmit(d => mutation.mutate(d))} style={{ display: 'grid', gap: 20 }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Thú cưng *</label>
              <select 
                {...register('petId')}
                disabled={isEditing}
                style={{ padding: '12px 16px', borderRadius: 12, border: errors.petId ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0', outline: 'none', fontSize: 14, background: isEditing ? '#f8fafc' : 'white' }}
              >
                <option value="">-- Chọn bé cần Grooming --</option>
                {!isLoadingPets && Array.isArray(petsData) ? petsData.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} - {p.species}</option>
                )) : !isLoadingPets && petsData?.data?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} - {p.species}</option>
                ))}
              </select>
              {errors.petId && <span style={{ color: '#ef4444', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={14} /> {errors.petId.message}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Groomer (Nhân viên)</label>
              <select 
                {...register('staffId')}
                style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', outline: 'none', fontSize: 14, background: 'white' }}
              >
                <option value="">-- Chưa phân công --</option>
                {staffData?.length > 0 && staffData.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            </div>

            {isEditing && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Trạng thái</label>
                  <select 
                    {...register('status')}
                    style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', outline: 'none', fontSize: 14, background: 'white' }}
                  >
                    <option value="PENDING">Chờ tiếp nhận</option>
                    <option value="IN_PROGRESS">Đang tắm/tỉa</option>
                    <option value="COMPLETED">Đã hoàn thành</option>
                    <option value="CANCELLED">Đã hủy</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Giá dịch vụ (VND)</label>
                  <input 
                    type="number"
                    {...register('price', { valueAsNumber: true })} placeholder="150000"
                    style={{ padding: '12px 16px', borderRadius: 12, border: errors.price ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0', outline: 'none', fontSize: 14 }}
                  />
                  {errors.price && <span style={{ color: '#ef4444', fontSize: 13 }}>{errors.price.message}</span>}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Lưu ý</label>
              <textarea 
                {...register('notes')} placeholder="Dị ứng xà phòng, cạo gọn tai..." rows={3}
                style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', outline: 'none', fontSize: 14, resize: 'vertical' }}
              />
            </div>
          </form>
        </div>

        <div style={{ padding: '20px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          {isEditing ? (
            <button 
              type="button" onClick={() => {
                if (window.confirm('Hủy lịch groom này?')) deleteMutation.mutate(initialData.id)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              <Trash2 size={16} /> Hủy lịch
            </button>
          ) : <div></div>}
          
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              type="button" onClick={onClose}
              style={{ padding: '12px 24px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Đóng
            </button>
            <button 
              type="submit" form="grooming-form" disabled={mutation.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: mutation.isPending ? 'not-allowed' : 'pointer', opacity: mutation.isPending ? 0.8 : 1 }}
            >
              {mutation.isPending ? 'Đang lưu...' : <><Save size={18} /> Lưu phiên</>}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

