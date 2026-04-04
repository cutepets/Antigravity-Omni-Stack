'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Clock, Scissors, CheckCircle, XCircle } from 'lucide-react'
import { groomingApi, GroomingSession } from '@/lib/api/grooming.api'
import { GroomingModal } from './grooming-modal'
import { customToast as toast } from '@/components/ui/toast-with-copy'

const COLUMNS = [
  { id: 'PENDING', title: 'Chờ tiếp nhận', icon: <Clock size={16} />, color: '#eab308', bg: '#fefce8' },
  { id: 'IN_PROGRESS', title: 'Đang tắm/tỉa', icon: <Scissors size={16} />, color: '#3b82f6', bg: '#eff6ff' },
  { id: 'COMPLETED', title: 'Đã hoàn thành', icon: <CheckCircle size={16} />, color: '#10b981', bg: '#ecfdf5' },
  { id: 'CANCELLED', title: 'Đã hủy', icon: <XCircle size={16} />, color: '#ef4444', bg: '#fef2f2' },
]

export function GroomingBoard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<GroomingSession | null>(null)
  const queryClient = useQueryClient()

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['grooming-sessions'],
    queryFn: groomingApi.getSessions,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: any }) => 
      groomingApi.updateSession({ id, status }),
    onSuccess: () => {
      toast.success('Đã cập nhật trạng thái')
      queryClient.invalidateQueries({ queryKey: ['grooming-sessions'] })
    },
    onError: () => toast.error('Lỗi khi cập nhật trạng thái')
  })

  // Format data into columns
  const columnsData = COLUMNS.map(col => ({
    ...col,
    items: (sessions || []).filter(s => s.status === col.id)
  }))

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('sessionId', id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, status: any) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('sessionId')
    if (id) {
      updateStatusMutation.mutate({ id, status })
    }
  }

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Đang tải Kanban...</div>

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          onClick={() => { setEditingSession(null); setIsModalOpen(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          <Plus size={18} /> Thêm phiên Grooming
        </button>
      </div>

      {/* Board */}
      <div style={{ flex: 1, display: 'flex', gap: 24, overflowX: 'auto', paddingBottom: 16 }}>
        {columnsData.map(col => (
          <div 
            key={col.id}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, col.id)}
            style={{ 
              width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16,
              background: '#f8fafc', borderRadius: 16, padding: 16, border: '1px dashed #e2e8f0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: col.bg, color: col.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {col.icon}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: 0 }}>{col.title}</h3>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', background: '#e2e8f0', padding: '2px 8px', borderRadius: 12 }}>
                {col.items.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
              {col.items.map(item => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={e => handleDragStart(e, item.id)}
                  onClick={() => { setEditingSession(item); setIsModalOpen(true) }}
                  style={{
                    background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'grab', transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  className="grooming-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{item.petName}</h4>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span>Chủ: {item.pet?.customer?.fullName || '---'} {item.pet?.customer?.phone ? `(${item.pet.customer.phone})` : ''}</span>
                    {item.notes && <span style={{ color: '#ef4444', fontSize: 12, background: '#fef2f2', padding: '2px 6px', borderRadius: 4, display: 'inline-block', width: 'fit-content' }}>Lưu ý: {item.notes}</span>}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px dotted #e2e8f0', paddingTop: 12 }}>
                    {item.staff?.avatar ? (
                      <img src={item.staff.avatar} alt="nhân viên" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                    ) : (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#64748b' }}>
                        {item.staff ? item.staff.fullName[0] : '?'}
                      </div>
                    )}
                    <span style={{ fontSize: 12, color: '#475569' }}>
                      {item.staff?.fullName || 'Chưa phân công'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <GroomingModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialData={editingSession}
        />
      )}

      <style>{`
        .grooming-card:hover { border-color: #cbd5e1 !important; transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important; }
        .grooming-card:active { cursor: grabbing !important; }
      `}</style>
    </div>
  )
}

