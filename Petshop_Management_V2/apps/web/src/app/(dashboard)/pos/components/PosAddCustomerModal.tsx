'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { customToast as toast } from '@/components/ui/toast-with-copy';

interface PosAddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  onSaved: (customer: any) => void;
}

export function PosAddCustomerModal({ isOpen, onClose, initialData, onSaved }: PosAddCustomerModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', address: '' });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setForm({
          fullName: initialData.fullName || '',
          phone: initialData.phone || '',
          email: initialData.email || '',
          address: initialData.address || ''
        });
      } else {
        setForm({ fullName: '', phone: '', email: '', address: '' });
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!form.fullName || !form.phone) {
      alert("Vui lòng nhập Tên và Số điện thoại!");
      return;
    }
    try {
      setLoading(true);
      if (initialData?.id) {
        const res = await api.put(`/customers/${initialData.id}`, { ...form });
        onSaved(res.data.data ?? res.data);
      } else {
        const res = await api.post('/customers', { ...form, isActive: true });
        onSaved(res.data.data ?? res.data);
      }
    } catch (e: any) {
      alert(e.response?.data?.message || "Có lỗi xảy ra khi lưu khách hàng");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="text-primary-500" size={20} />
            {initialData?.id ? 'Cập nhật khách hàng' : 'Thêm khách hàng nhanh'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Tên khách hàng <span className="text-red-500">*</span></label>
            <input 
              className="w-full form-input text-sm px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary-500 focus:bg-white transition-colors outline-none" 
              value={form.fullName} 
              onChange={e => setForm({...form, fullName: e.target.value})} 
              placeholder="Nguyễn Văn A" 
              autoFocus 
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Số điện thoại <span className="text-red-500">*</span></label>
            <input 
              className="w-full form-input text-sm px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary-500 focus:bg-white transition-colors outline-none" 
              value={form.phone} 
              onChange={e => setForm({...form, phone: e.target.value})} 
              placeholder="09xxxxxxxxx" 
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
            <input 
              type="email" 
              className="w-full form-input text-sm px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary-500 focus:bg-white transition-colors outline-none" 
              value={form.email} 
              onChange={e => setForm({...form, email: e.target.value})} 
              placeholder="email@mail.com" 
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Địa chỉ</label>
            <input 
              className="w-full form-input text-sm px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary-500 focus:bg-white transition-colors outline-none" 
              value={form.address} 
              onChange={e => setForm({...form, address: e.target.value})} 
              placeholder="Quận / Thành phố" 
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-between gap-2">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors"
          >
            Huỷ
          </button>
          <button 
            onClick={handleSave} 
            disabled={loading} 
            className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <UserPlus size={18} /> {loading ? 'Đang lưu...' : 'Lưu & chọn'}
          </button>
        </div>
      </div>
    </div>
  );
}
