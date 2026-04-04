'use client';

import { useState } from 'react';
import { X, Calendar, User, PawPrint } from 'lucide-react';
import { useCustomerPets } from '../_hooks/use-pos-queries';

export interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (bookingDetails: any) => void;
  service: any; // The selected service
  customerId?: string;
}

export function ServiceBookingModal({ isOpen, onClose, onConfirm, service, customerId }: BookingModalProps) {
  const { data: pets = [] } = useCustomerPets(customerId);
  const [selectedPet, setSelectedPet] = useState<string>('');
  
  // Hotel specific
  const [checkIn, setCheckIn] = useState<string>('');
  const [checkOut, setCheckOut] = useState<string>('');

  // Grooming specific
  const [startTime, setStartTime] = useState<string>('');
  const [performerId, setPerformerId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  if (!isOpen || !service) return null;

  // Assume 'type' exists on service to distinguish, or fallback based on name
  const isHotel = service.type === 'hotel' || service.name?.toLowerCase().includes('lưu chuồng') || service.name?.toLowerCase().includes('hotel');
  const isGrooming = service.type === 'grooming' || service.name?.toLowerCase().includes('tắm') || service.name?.toLowerCase().includes('cắt tỉa');

  const handleConfirm = () => {
    if (!selectedPet) {
      alert('Vui lòng chọn thú cưng');
      return;
    }

    if (isHotel) {
      if (!checkIn || !checkOut) {
        alert('Vui lòng chọn ngày nhận và trả thú cưng');
        return;
      }
      onConfirm({
        type: 'hotel',
        details: {
          petId: selectedPet,
          checkIn,
          checkOut,
          lineType: 'REGULAR', // Default
        }
      });
    } else {
      // Grooming or generic service
      onConfirm({
        type: 'grooming',
        details: {
          petId: selectedPet,
          startTime: startTime || undefined,
          performerId: performerId || undefined,
          notes: notes || undefined,
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background-secondary border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col animate-slide-in">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            {isHotel ? <Calendar size={18} className="text-primary-500" /> : <ScissorsIcon size={18} className="text-primary-500" />}
            Đặt lịch: {service.name}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-background-tertiary rounded-lg text-foreground-muted">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Pet Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-foreground-muted flex items-center gap-1.5">
              <PawPrint size={14} /> Thú cưng
            </label>
            {!customerId ? (
              <div className="text-sm text-warning p-3 bg-warning/10 rounded-lg">
                Vui lòng chọn khách hàng ở màn hình chính trước khi chọn thú cưng.
              </div>
            ) : pets.length === 0 ? (
              <div className="text-sm text-foreground-muted p-3 bg-background-tertiary rounded-lg">
                Khách hàng này chưa có thú cưng trên hệ thống.
              </div>
            ) : (
              <select 
                className="form-input" 
                value={selectedPet} 
                onChange={e => setSelectedPet(e.target.value)}
              >
                <option value="">-- Chọn thú cưng --</option>
                {(pets as any[]).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.species})</option>
                ))}
              </select>
            )}
          </div>

          {/* Hotel Fields */}
          {isHotel && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground-muted">Nhận phòng</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={checkIn}
                  onChange={e => setCheckIn(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground-muted">Trả phòng</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={checkOut}
                  onChange={e => setCheckOut(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Grooming Fields */}
          {isGrooming && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-foreground-muted">Bắt đầu lúc</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-foreground-muted flex items-center gap-1">
                    <User size={14} /> Nhân viên
                  </label>
                  <select 
                    className="form-input" 
                    value={performerId}
                    onChange={e => setPerformerId(e.target.value)}
                  >
                    <option value="">-- Chọn --</option>
                    {/* Hardcode for now, should pull from staffs */}
                    <option value="STAFF-1">Nhân viên Grooming 1</option>
                    <option value="STAFF-2">Nhân viên Grooming 2</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground-muted">Ghi chú (tuỳ chọn)</label>
                <textarea 
                  className="form-input max-h-24" 
                  rows={2} 
                  placeholder="Ghi chú thêm về yêu cầu của khách..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </>
          )}

        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 bg-background-tertiary">
          <button onClick={onClose} className="px-4 py-2 font-medium text-foreground rounded-lg hover:bg-background-base transition-colors">
            Huỷ
          </button>
          <button 
            onClick={handleConfirm}
            className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            Thêm vào giỏ
          </button>
        </div>
      </div>
    </div>
  );
}

function ScissorsIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  )
}
