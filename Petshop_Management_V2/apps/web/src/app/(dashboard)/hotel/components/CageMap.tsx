'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { format, differenceInCalendarDays } from 'date-fns';
import { customToast as toast } from '@/components/ui/toast-with-copy';
import { usePosStore } from '../../../../stores/pos.store';

export default function CageMap() {
  const [cages, setCages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const posStore = usePosStore();

  const fetchCages = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:3001/hotel/cages', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCages(res.data.data || res.data); // handles both formats
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải sơ đồ chuồng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCages();
  }, []);

  if (loading) {
    return <div className="p-8 text-center animate-pulse text-slate-500">Đang tải sơ đồ khách sạn...</div>;
  }

  // Filter regular vs VIP, etc if we want, but for now just group all.
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-4">
      {cages.map((cage) => {
        // active stay is one where status is BOOKED or CHECKED_IN
        const activeStay = cage.hotelStays?.find((s: any) => s.status === 'BOOKED' || s.status === 'CHECKED_IN');
        const isOccupied = !!activeStay;

        return (
          <div 
            key={cage.id} 
            className={`relative rounded-2xl border-2 transition-all p-4 flex flex-col items-center justify-center min-h-[140px] cursor-pointer hover:-translate-y-1 hover:shadow-lg ${
              isOccupied 
                ? 'bg-indigo-50 border-indigo-200' 
                : 'bg-emerald-50 border-emerald-200 border-dashed'
            }`}
            onClick={() => {
              if (isOccupied) {
                toast(`Chuồng ${cage.name} đang được dùng bởi ${activeStay.pet?.name || 'Pet'}`);
              } else {
                toast(`Chuồng ${cage.name} trống, có thể xếp khách.`);
              }
            }}
          >
            <div className={`absolute top-3 left-3 px-2 py-0.5 rounded text-xs font-bold ${isOccupied ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {cage.name}
            </div>
            
            <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${isOccupied ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />

            {isOccupied ? (
              <div className="mt-4 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-indigo-200 mb-2 flex items-center justify-center text-2xl shadow-inner">
                  {activeStay.pet?.species === 'Cat' ? '🐱' : '🐶'}
                </div>
                <h4 className="font-bold text-slate-800 text-sm">{activeStay.pet?.name || activeStay.petName}</h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                  Đến: {format(new Date(activeStay.checkIn), 'dd/MM/yyyy')}
                </p>
                {activeStay.status === 'CHECKED_IN' && (
                  <>
                    <span className="mt-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">ĐANG Ở</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const nights = Math.max(1, differenceInCalendarDays(new Date(), new Date(activeStay.checkIn)));
                        const pricePerNight = activeStay.price || 150000;
                        const totalPrice = nights * pricePerNight;
                        
                        posStore.addItem({
                          id: activeStay.id,
                          description: `🏨 Lưu trú ${nights} đêm: ${activeStay.pet?.name || activeStay.petName}`,
                          unitPrice: totalPrice,
                          type: 'hotel'
                        });
                        if (activeStay.pet?.customer) {
                          posStore.setCustomer(activeStay.customerId || undefined, activeStay.pet.customer.fullName || 'Khách lẻ');
                        }
                        toast.success(`Đã thêm ${nights} đêm lưu trú vào hóa đơn POS!`);
                        router.push('/pos');
                      }}
                      className="mt-2 w-full bg-amber-500 hover:bg-amber-600 text-white py-1.5 rounded text-[10px] font-bold shadow-sm transition-colors"
                    >
                      💰 Trả phòng & Thanh toán
                    </button>
                  </>
                )}
                {activeStay.status === 'BOOKED' && (
                  <span className="mt-2 text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">SẮP ĐẾN</span>
                )}
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center text-center opacity-60">
                <div className="w-12 h-12 rounded-full border-2 border-emerald-300 border-dashed mb-2 flex items-center justify-center text-emerald-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                </div>
                <span className="text-xs font-bold text-emerald-600">Trống</span>
              </div>
            )}
          </div>
        );
      })}
      
      {cages.length === 0 && !loading && (
        <div className="col-span-full p-12 text-center text-slate-400 border-2 border-dashed rounded-xl">
          Chưa có lồng kính/phòng nào. Vui lòng tạo phòng trước.
        </div>
      )}
    </div>
  );
}

