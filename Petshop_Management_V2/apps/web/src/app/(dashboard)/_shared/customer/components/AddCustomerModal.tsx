'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronUp,
  Mail,
  MapPin,
  Phone,
  Receipt,
  User,
  UserPlus,
  X,
} from 'lucide-react';
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
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    taxCode: '',
    companyName: '',
    companyAddress: '',
    representativeName: '',
    representativePhone: '',
  });

  useEffect(() => {
    if (!isOpen) return;

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
        representativePhone: initialData.representativePhone || '',
      });
    } else {
      setForm({
        fullName: '',
        phone: '',
        email: '',
        address: '',
        taxCode: '',
        companyName: '',
        companyAddress: '',
        representativeName: '',
        representativePhone: '',
      });
    }

    setError('');
    setShowAdvanced(false);
  }, [isOpen, initialData]);

  if (!isOpen || typeof document === 'undefined') return null;

  const inputClass =
    'h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-primary-500 placeholder:text-foreground-muted';
  const iconInputClass = `${inputClass} pl-11`;

  const handleSave = async () => {
    if (!form.fullName || !form.phone) {
      const message = 'Vui lòng nhập tên và số điện thoại';
      setError(message);
      toast.error(message);
      return;
    }

    try {
      setLoading(true);
      setError('');

      if (initialData?.id) {
        const res = await api.put(`/customers/${initialData.id}`, { ...form });
        toast.success('Cập nhật khách hàng thành công');
        onSaved(res.data.data ?? res.data);
      } else {
        const res = await api.post('/customers', { ...form, isActive: true });
        toast.success('Thêm khách hàng thành công');
        onSaved(res.data.data ?? res.data);
      }
    } catch (e: any) {
      const message = e.response?.data?.message || 'Có lỗi xảy ra khi lưu khách hàng';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-background-base/80 backdrop-blur-sm" onClick={onClose} />

      <div className="card relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-background-tertiary px-6 py-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <UserPlus className="text-primary-500" size={20} />
              {initialData?.id ? 'Cập nhật khách hàng' : 'Thêm khách hàng nhanh'}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {initialData?.id
                ? 'Chỉnh sửa nhanh thông tin khách hàng ngay trên đơn hàng'
                : 'Tạo khách hàng mới và gán trực tiếp vào đơn hàng'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background-secondary text-foreground-muted transition-colors hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Họ và tên <span className="text-error">*</span>
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
                <input
                  className={iconInputClass}
                  value={form.fullName}
                  onChange={e => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Số điện thoại <span className="text-error">*</span>
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
                <input
                  className={iconInputClass}
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="09xxxxxxxx"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
                <input
                  type="email"
                  className={iconInputClass}
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="example@mail.com"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">Địa chỉ</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
                <input
                  className={iconInputClass}
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Số nhà, đường, phường..."
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background-secondary/40">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div>
                <div className="text-sm font-semibold text-foreground">Thông tin nâng cao</div>
                <div className="text-xs text-foreground-muted">Công ty, MST và thông tin xuất hóa đơn</div>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-foreground-muted">
                {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </span>
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 gap-4 border-t border-border px-4 py-4 md:grid-cols-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Mã số thuế</label>
                  <div className="relative">
                    <Receipt className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
                    <input
                      className={iconInputClass}
                      value={form.taxCode}
                      onChange={e => setForm({ ...form, taxCode: e.target.value })}
                      placeholder="MST"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Tên công ty</label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
                    <input
                      className={iconInputClass}
                      value={form.companyName}
                      onChange={e => setForm({ ...form, companyName: e.target.value })}
                      placeholder="Tên công ty"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Địa chỉ công ty</label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
                    <input
                      className={iconInputClass}
                      value={form.companyAddress}
                      onChange={e => setForm({ ...form, companyAddress: e.target.value })}
                      placeholder="Địa chỉ công ty"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Người đại diện</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
                    <input
                      className={iconInputClass}
                      value={form.representativeName}
                      onChange={e => setForm({ ...form, representativeName: e.target.value })}
                      placeholder="Tên người đại diện"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Số đại diện</label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
                    <input
                      className={iconInputClass}
                      value={form.representativePhone}
                      onChange={e => setForm({ ...form, representativePhone: e.target.value })}
                      placeholder="SĐT người đại diện"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-background-tertiary px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary-500/30 hover:text-primary-500"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserPlus size={18} />
            {loading ? 'Đang lưu...' : 'Lưu & chọn'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
