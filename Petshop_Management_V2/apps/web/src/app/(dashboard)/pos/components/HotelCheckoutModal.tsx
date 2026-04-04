'use client';

import { useState } from 'react';
import { X, Search, Hotel, Calendar, Clock, DollarSign } from 'lucide-react';
import { useCustomerPets } from '../_hooks/use-pos-queries';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface HotelCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  onConfirm: (checkoutDetails: any) => void;
}

export function HotelCheckoutModal({ isOpen, onClose, customerId, onConfirm }: HotelCheckoutModalProps) {
  const [selectedPet, setSelectedPet] = useState<string>('');
  
  const { data: pets = [] } = useCustomerPets(customerId);

  // In a real app we fetch active stays for the selected pet
  // Here we use a mock query that returns a sample stay
  const { data: activeStay, isLoading: loadingStay } = useQuery({
    queryKey: ['hotel', 'active-stay', selectedPet],
    queryFn: async () => {
      // Mocking an active stay since no API exists yet
      return new Promise<any>((resolve) => {
        setTimeout(() => {
          resolve({
            id: 'STAY-' + Date.now(),
            petId: selectedPet,
            checkIn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
            basePrice: 150000,
            days: 3,
            totalPrice: 450000,
            roomName: 'Chuồng VIP 01'
          });
        }, 500);
      });
    },
    enabled: !!selectedPet,
  });

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!activeStay) return;
    
    onConfirm({
      id: `HOTEL-CHECKOUT-${activeStay.id}`,
      serviceId: 'EXTERNAL', // Special ID
      description: `Thanh toán trả chuồng (${activeStay.roomName})`,
      unitPrice: activeStay.totalPrice,
      type: 'hotel',
      unit: 'lần',
      hotelDetails: {
        petId: activeStay.petId,
        stayId: activeStay.id,
        checkIn: activeStay.checkIn,
        checkOut: new Date().toISOString(),
      }
    });
  };

  const formatDate = (ds: string) => {
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ds));
  }
  const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background-secondary border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col animate-slide-in">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Hotel size={18} className="text-primary-500" />
            Trả thú cưng (Checkout)
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-background-tertiary rounded-lg text-foreground-muted">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Pet Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-foreground-muted flex items-center gap-1.5">
              Tra cứu theo thú cưng:
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
                <option value="">-- Chọn thú cưng đang gửi --</option>
                {(pets as any[]).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.species})</option>
                ))}
              </select>
            )}
          </div>

          {/* Active Stay Details */}
          {selectedPet && loadingStay && (
            <div className="flex items-center justify-center py-6 text-foreground-muted">
              Đang tra cứu phòng...
            </div>
          )}

          {selectedPet && activeStay && (
            <div className="bg-background-base border border-border rounded-xl p-4 flex flex-col gap-3 mt-2">
              <h3 className="font-semibold text-foreground text-sm border-b border-border pb-2">
                Thông tin lưu chuồng
              </h3>
              
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-foreground-muted flex items-center gap-1"><Calendar size={12}/> Nhận lúc</span>
                  <span className="font-medium text-foreground">{formatDate(activeStay.checkIn)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-foreground-muted flex items-center gap-1"><Clock size={12}/> Trả lúc</span>
                  <span className="font-medium text-foreground">{formatDate(new Date().toISOString())}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-foreground-muted flex items-center gap-1"><Hotel size={12}/> Phòng</span>
                  <span className="font-medium text-foreground">{activeStay.roomName}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-foreground-muted flex items-center gap-1"><Calendar size={12}/> Số ngày</span>
                  <span className="font-medium text-foreground">{activeStay.days} ngày</span>
                </div>
              </div>

              <div className="mt-2 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-foreground-muted text-sm flex items-center gap-1">
                  <DollarSign size={14}/> Thành tiền ({money(activeStay.basePrice)}/ngày)
                </span>
                <span className="text-xl font-bold text-accent">
                  {money(activeStay.totalPrice)}
                </span>
              </div>
            </div>
          )}

          {selectedPet && !loadingStay && !activeStay && (
             <div className="text-sm text-foreground-muted p-3 bg-background-tertiary rounded-lg text-center mt-2">
              Không tìm thấy thông tin lưu chuồng cho thú cưng này.
             </div>
          )}

        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 bg-background-tertiary">
          <button onClick={onClose} className="px-4 py-2 font-medium text-foreground rounded-lg hover:bg-background-base transition-colors">
            Đóng
          </button>
          <button 
            disabled={!activeStay}
            onClick={handleConfirm}
            className="px-6 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            Thêm vào giỏ
          </button>
        </div>
      </div>
    </div>
  );
}
