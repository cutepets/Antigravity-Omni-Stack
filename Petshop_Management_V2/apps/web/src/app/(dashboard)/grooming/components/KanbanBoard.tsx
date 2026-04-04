'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { format } from 'date-fns';
import { customToast as toast } from '@/components/ui/toast-with-copy';
import { usePosStore } from '../../../../stores/pos.store';

export default function KanbanBoard() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const posStore = usePosStore();

  const columns = [
    { id: 'PENDING', title: 'Đợi tiếp nhận', color: 'border-slate-200 bg-slate-50' },
    { id: 'IN_PROGRESS', title: 'Đang tắm/cắt tỉa', color: 'border-blue-200 bg-blue-50' },
    { id: 'COMPLETED', title: 'Hoàn thành', color: 'border-emerald-200 bg-emerald-50' },
    { id: 'CANCELLED', title: 'Đã hủy', color: 'border-red-200 bg-red-50' }
  ];

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:3001/grooming', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('sessionId', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // allow drop
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const sessionId = e.dataTransfer.getData('sessionId');
    if (!sessionId) return;

    // Optimistic update
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: newStatus } : s));

    try {
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:3001/grooming/${sessionId}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (newStatus === 'COMPLETED') {
        toast.success('Đã hoàn thành! Đã có thể thanh toán bên POS.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi cập nhật trạng thái');
      fetchSessions(); // revert
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium animate-pulse">Đang tải bảng công việc...</div>;

  return (
    <div className="flex gap-4 h-[calc(100vh-140px)] overflow-x-auto pb-4">
      {columns.map(col => (
        <div 
          key={col.id} 
          className={`flex-1 min-w-[300px] flex flex-col rounded-xl border-2 ${col.color}`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, col.id)}
        >
          <div className="p-3 border-b-2 border-inherit flex justify-between items-center bg-white/50 rounded-t-xl">
            <h3 className="font-bold text-slate-700">{col.title}</h3>
            <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
              {sessions.filter(s => s.status === col.id).length}
            </span>
          </div>

          <div className="flex-1 p-2 gap-2 flex flex-col overflow-y-auto">
            {sessions.filter(s => s.status === col.id).map(s => (
              <div 
                key={s.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, s.id)}
                className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    {s.pet?.name || s.petName} 
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono uppercase">Id: {s.id.slice(-4)}</span>
                  </h4>
                </div>
                
                <p className="text-xs text-slate-600 mb-2 truncate">Khách: {s.pet?.customer?.fullName || 'Khách vãng lai'}</p>
                
                <div className="pt-2 border-t border-dashed flex justify-between items-center">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {format(new Date(s.createdAt), 'HH:mm')}
                  </div>
                  
                  {s.staff && (
                    <div className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-[10px] font-bold" title={s.staff.fullName}>
                      {s.staff.fullName.charAt(0)}
                    </div>
                  )}
                </div>

                {col.id === 'COMPLETED' && !s.orderId && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      posStore.addItem({
                        id: s.id,
                        description: `💅 Spa: ${s.pet?.name || s.petName}`,
                        unitPrice: s.price || 0,
                        type: 'grooming'
                      });
                      if (s.pet?.customer) {
                        posStore.setCustomer(s.customerId || undefined, s.pet.customer.fullName || 'Khách lẻ');
                      }
                      toast.success('Đã thêm vào hóa đơn POS!');
                      router.push('/pos');
                    }}
                    className="w-full mt-3 bg-amber-500 hover:bg-amber-600 text-white py-1.5 rounded text-xs font-bold shadow-sm transition-colors opacity-0 group-hover:opacity-100"
                  >
                    💰 Thu tiền ngay
                  </button>
                )}
                {col.id === 'COMPLETED' && s.orderId && (
                  <div className="w-full mt-3 bg-emerald-100 text-emerald-700 py-1.5 rounded text-xs font-bold text-center">
                    ✅ Đã thanh toán
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

