'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import { customToast as toast } from '@/components/ui/toast-with-copy';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  onSaved: (customer: any) => void;
}

export function AddCustomerModal({ isOpen, onClose, initialData, onSaved }: AddCustomerModalProps) {
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({ 
    fullName: '', phone: '', email: '', address: '',
    taxCode: '', companyName: '', companyAddress: '', representativeName: '', representativePhone: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setForm({
          fullName: initialData.fullName || '',
          phone: initialData.phone || '',
          email: initialData.email || '',
          address: initialData.address || '',
          taxCode: initialData.taxCode || '',
          companyName: initialData.companyName || '',
          companyAddress: initialData.companyAddress || '',
          representativeName: initialData.representativeName || '',
          representativePhone: initialData.representativePhone || ''
        });
      } else {
        setForm({ fullName: '', phone: '', email: '', address: '', taxCode: '', companyName: '', companyAddress: '', representativeName: '', representativePhone: '' });
      }
      setShowAdvanced(false);
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="text-primary-500" size={20} />
            {initialData?.id ? 'Cập nhật khách hàng' : 'Thêm khách hàng nhanh'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 space-y-4 overflow-y-auto no-scrollbar">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Tên khách hàng <span className="text-red-500">*</span></label>
            <input 
              className="w-full form-input text-sm px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none shadow-sm" 
              value={form.fullName} 
              onChange={e => setForm({...form, fullName: e.target.value})} 
              placeholder="Nguyễn Văn A" 
              autoFocus 
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Số điện thoại <span className="text-red-500">*</span></label>
            <input 
              className="w-full form-input text-sm px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none shadow-sm" 
              value={form.phone} 
              onChange={e => setForm({...form, phone: e.target.value})} 
              placeholder="09xxxxxxxxx" 
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
              <input 
                type="email" 
                className="w-full form-input text-sm px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none shadow-sm" 
                value={form.email} 
                onChange={e => setForm({...form, email: e.target.value})} 
                placeholder="email@mail.com" 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Địa chỉ</label>
              <input 
                className="w-full form-input text-sm px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none shadow-sm" 
                value={form.address} 
                onChange={e => setForm({...form, address: e.target.value})} 
                placeholder="Quận / Thành phố" 
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[13px] font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1.5 transition-colors"
            >
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Thông tin nâng cao (Công ty / Xuất HĐ)
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Mã số thuế (MST)</label>
                  <input 
                    className="w-full form-input text-sm px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none shadow-sm" 
                    value={form.taxCode} 
                    onChange={e => setForm({...form, taxCode: e.target.value})} 
                    placeholder="Mã số thuế" 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Tên công ty</label>
                  <input 
                    className="w-full form-input text-sm px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none shadow-sm" 
                    value={form.companyName} 
                    onChange={e => setForm({...form, companyName: e.target.value})} 
                    placeholder="Tên công ty" 
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Địa chỉ công ty</label>
                <input 
                  className="w-full form-input text-sm px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none shadow-sm" 
                  value={form.companyAddress} 
                  onChange={e => setForm({...form, companyAddress: e.target.value})} 
                  placeholder="Địa chỉ công ty" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Người đại diện</label>
                  <input 
                    className="w-full form-input text-sm px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none shadow-sm" 
                    value={form.representativeName} 
                    onChange={e => setForm({...form, representativeName: e.target.value})} 
                    placeholder="Tên người đại diện" 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Số đại diện</label>
                  <input 
                    className="w-full form-input text-sm px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none shadow-sm" 
                    value={form.representativePhone} 
                    onChange={e => setForm({...form, representativePhone: e.target.value})} 
                    placeholder="SĐT người đại diện" 
                  />
                </div>
              </div>
            </div>
          )}
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
