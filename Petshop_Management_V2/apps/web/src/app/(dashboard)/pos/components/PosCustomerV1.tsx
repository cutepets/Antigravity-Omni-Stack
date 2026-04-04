'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, UserPlus, X, User, Plus, Pencil, PawPrint, Medal } from 'lucide-react';
import { usePosStore, useActiveTab } from '@/stores/pos.store';
import { useCustomerSearch } from '../_hooks/use-pos-queries';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { PosAddCustomerModal } from './PosAddCustomerModal';
import { PosAddPetModal } from './PosAddPetModal';

export function PosCustomerV1() {
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalData, setCustomerModalData] = useState<any>(null);
  const [showPetModal, setShowPetModal] = useState(false);
  
  const store = usePosStore();
  const activeTab = useActiveTab();
  
  const { data: customers = [], refetch: refetchCustomers } = useCustomerSearch(customerQuery);

  const { data: customerDetail, refetch: refetchCustomerDetail } = useQuery({
    queryKey: ['pos', 'customer', activeTab?.customerId],
    queryFn: async () => {
      if (!activeTab?.customerId) return null;
      const res = await api.get(`/customers/${activeTab.customerId}`);
      return res.data?.data || res.data;
    },
    enabled: !!activeTab?.customerId,
  });

  const handleQuickAddClick = () => {
    const isPhone = /^[0-9\-\+\s]+$/.test(customerQuery);
    setCustomerModalData({
      fullName: isPhone ? '' : customerQuery,
      phone: isPhone ? customerQuery.replace(/[^0-9]/g, '') : '',
      address: ''
    });
    setShowCustomerSearch(false);
    setShowCustomerModal(true);
  };

  const handleEditCustomerClick = () => {
    if (!customerDetail) return;
    setCustomerModalData(customerDetail);
    setShowCustomerModal(true);
  };

  const handleCustomerSaved = (savedCustomer: any) => {
    store.setCustomer(savedCustomer.id, savedCustomer.fullName);
    refetchCustomerDetail();
    setShowCustomerModal(false);
    setCustomerQuery('');
  };

  const handlePetSaved = (savedPet: any) => {
    refetchCustomerDetail();
    setShowPetModal(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F4 is often used for customer search
      if (e.key === 'F4') {
        e.preventDefault();
        const input = containerRef.current?.querySelector('input');
        input?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowCustomerSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!activeTab) return null;

  const handleSelectCustomer = (customer: any) => {
    store.setCustomer(customer.id, customer.fullName);
    setShowCustomerSearch(false);
    setCustomerQuery('');
  };

  const handleRemoveCustomer = () => {
    store.setCustomer(undefined, 'Khách lẻ');
  };

  const hasCustomer = !!activeTab.customerId;

  return (
    <div className="w-full relative" ref={containerRef}>
      {hasCustomer ? (
        <div className="bg-[#f4f6f9] border-b border-gray-200">
           {/* Section top: Customer details */}
           <div className="p-4 relative">
             <button 
                onClick={handleRemoveCustomer}
                className="absolute top-4 right-4 p-1 text-gray-400 hover:text-red-500 rounded-full transition-colors bg-white hover:bg-red-50 shadow-sm"
                title="Xoá khách hàng"
             >
                <X size={16} />
             </button>
             <div className="flex gap-4 items-start">
               {/* Avatar */}
               <div className="w-14 h-14 rounded-full bg-cyan-500 text-white flex items-center justify-center text-2xl font-bold shrink-0 uppercase shadow-sm">
                 {activeTab.customerName?.charAt(0) || 'U'}
               </div>
               
               {/* Details */}
               <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-2">
                   <span className="text-[17px] font-bold text-[#2a3042]">{activeTab.customerName}</span>
                   <button onClick={handleEditCustomerClick} className="text-gray-400 hover:text-primary-600" title="Chỉnh sửa"><Pencil size={14} /></button>
                 </div>
                 {customerDetail && (
                   <>
                     {customerDetail.phone && <div className="text-[15px] text-[#555b6d]">{customerDetail.phone}</div>}
                     {customerDetail.address && <div className="text-[15px] text-[#555b6d]">{customerDetail.address}</div>}
                   </>
                 )}
               </div>

               {/* Points */}
               <div className="ml-auto mt-1 flex items-center gap-1 font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                 <Medal size={16} className="text-orange-500" /> {customerDetail?.points || 0} điểm
               </div>
             </div>
           </div>

           {/* Section bottom: Pets */}
           <div className="p-4 pt-3 border-t border-white shadow-[0_-1px_2px_rgba(0,0,0,0.02)]">
             <div className="text-[12px] font-bold text-[#6a7280] flex items-center gap-1.5 mb-3 uppercase tracking-wider">
               <PawPrint size={14}/> Thú cưng khách hàng
             </div>
             <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar pr-4">
               {customerDetail?.pets?.map((pet: any) => (
                 <div key={pet.id} className="flex flex-col items-center gap-1.5 min-w-[60px]">
                    <div className="w-14 h-14 rounded-full bg-[#eef1f6] text-[#4d5e7a] font-bold text-xl flex items-center justify-center border border-white shadow-sm ring-1 ring-gray-200">
                      {pet.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="font-bold text-[#2a3042] text-[13px] whitespace-nowrap">{pet.name}</span>
                    {pet.weight && (
                      <span className="bg-orange-100 text-orange-600 font-bold text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                        {pet.weight} kg
                      </span>
                    )}
                 </div>
               ))}
               
               {/* Add Pet block */}
               <div className="flex flex-col items-center gap-1.5 min-w-[60px] cursor-pointer group" onClick={() => setShowPetModal(true)}>
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 text-gray-400 flex items-center justify-center group-hover:bg-white group-hover:text-primary-500 group-hover:border-primary-400 transition-colors">
                    <Plus size={24} />
                  </div>
                  <span className="text-[#6a7280] text-[13px] group-hover:text-primary-600 font-medium whitespace-nowrap">Thêm Pet</span>
               </div>
             </div>
           </div>
        </div>
      ) : (
        <div className="flex items-center border-b border-gray-200">
          <div className="flex-1 flex items-center px-3 py-2.5 relative">
            <Search size={16} className="text-gray-400" />
            <input
              className="w-full pl-2 bg-transparent border-none outline-none text-sm text-gray-800 placeholder:text-gray-400"
              placeholder="Tìm khách hàng (F4)"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setShowCustomerSearch(true);
              }}
              onFocus={() => setShowCustomerSearch(true)}
            />
          </div>
        </div>
      )}

      {showCustomerSearch && !hasCustomer && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl overflow-hidden z-50 flex flex-col">
          <div className="overflow-y-auto max-h-[300px]">
            <button
              className="flex items-center gap-3 w-full p-3 hover:bg-primary-50 text-left transition-colors border-b border-gray-100"
              onClick={() => { store.setCustomer(undefined, 'Khách lẻ'); setShowCustomerSearch(false); }}
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                <User size={16} />
              </div>
              <span className="font-medium text-sm text-gray-700">Khách lẻ</span>
            </button>
            
            {(customers as any[]).map((c: any) => (
              <button
                key={c.id}
                className="flex items-center gap-3 w-full p-3 hover:bg-primary-50 text-left transition-colors border-b border-gray-100 last:border-0"
                onClick={() => handleSelectCustomer(c)}
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-medium text-sm text-gray-800 truncate">{c.fullName}</span>
                  <span className="text-xs text-gray-500">{c.phone}</span>
                </div>
              </button>
            ))}

            {customerQuery.length > 0 && customers.length === 0 && (
              <div className="p-4 flex flex-col gap-3 items-start border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  Không tìm thấy
                </div>
                <button 
                  className="text-[15px] font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1.5 bg-primary-50 px-3 py-1.5 rounded-lg w-full justify-center transition-colors hover:bg-primary-100 border border-primary-100"
                  onClick={handleQuickAddClick}
                >
                  <Plus size={18} /> Thêm nhanh "{customerQuery}"
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Render Modals securely */}
      <PosAddCustomerModal 
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        initialData={customerModalData}
        onSaved={handleCustomerSaved}
      />

      {hasCustomer && customerDetail && (
        <PosAddPetModal 
          isOpen={showPetModal}
          onClose={() => setShowPetModal(false)}
          customerId={customerDetail.id}
          customerName={customerDetail.fullName}
          customerPhone={customerDetail.phone}
          onSaved={handlePetSaved}
        />
      )}
    </div>
  );
}
