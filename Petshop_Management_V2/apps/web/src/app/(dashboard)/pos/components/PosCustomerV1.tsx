'use client';
import Image from 'next/image';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Plus, Pencil, PawPrint, Medal } from 'lucide-react';
import { usePosStore, useActiveTab } from '@/stores/pos.store';
import { CustomerSearchResults } from '@/components/search/customer-search-results';
import { useCustomerSearch } from '@/components/search/use-commerce-search';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { AddCustomerModal as PosAddCustomerModal } from '@/app/(dashboard)/_shared/customer/components/AddCustomerModal';
import { PetFormModal } from '../../pets/_components/pet-form-modal';
import { UnifiedPetProfile } from '@/components/pet/UnifiedPetProfile';


// ── Callback interface (dùng khi override store) ─────────────────────────────
export type CustomerCallbacks = {
  customerId?: string;
  customerName?: string;
  onSelectCustomer: (id: string, name: string) => void;
  onRemoveCustomer: () => void;
};

export interface PosCustomerV1Props {
  onSelectSuggestedService?: (service: any, petId: string, petName?: string) => void;
  // Optional — khi có callbacks, bypass usePosStore (dùng cho OrderWorkspace)
  callbacks?: CustomerCallbacks;
  // Theme override ('pos' = light-mode hex colors, 'system' = CSS vars)
  theme?: 'pos' | 'system';
}

export function PosCustomerV1({ onSelectSuggestedService, callbacks, theme = 'system' }: PosCustomerV1Props) {
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalData, setCustomerModalData] = useState<any>(null);
  const [showPetModal, setShowPetModal] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  // Always call hooks unconditionally (Rules of Hooks)
  // When callbacks provided, store values won't be used for customer mutations
  const setCustomer = usePosStore((state) => state.setCustomer);
  const setCustomerPricing = usePosStore((state) => state.setCustomerPricing);
  const setCustomerPoints = usePosStore((state) => state.setCustomerPoints);
  const activeTab = useActiveTab();

  // Customer ID/name resolved from callbacks (Order mode) or store (POS mode)
  const customerId = callbacks ? callbacks.customerId : activeTab?.customerId;
  const customerDisplayName = callbacks ? callbacks.customerName : activeTab?.customerName;

  const { data: customers = [] } = useCustomerSearch(customerQuery);

  const { data: customerDetail, refetch: refetchCustomerDetail } = useQuery({
    queryKey: ['customer-detail', customerId],  // neutral key — không dùng pos prefix
    queryFn: async () => {
      if (!customerId) return null;
      const res = await api.get(`/customers/${customerId}`);
      return res.data?.data || res.data;
    },
    enabled: !!customerId,
  });

  const handleQuickAddClick = () => {
    const isPhone = /^[0-9\-+\s]+$/.test(customerQuery);
    setCustomerModalData({
      fullName: isPhone ? '' : customerQuery,
      phone: isPhone ? customerQuery.replace(/[^0-9]/g, '') : '',
      address: '',
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
    if (callbacks) {
      callbacks.onSelectCustomer(savedCustomer.id, savedCustomer.fullName);
    } else {
      setCustomer(savedCustomer.id, savedCustomer.fullName, null);
    }
    refetchCustomerDetail();
    setShowCustomerModal(false);
    setCustomerQuery('');
  };

  const handlePetSaved = () => {
    refetchCustomerDetail();
    setShowPetModal(false);
  };

  const handleOpenPetProfile = (petId: string) => {
    setSelectedPetId(petId);
  };

  const handleSelectServiceFromPet = (service: any, petId: string, petName?: string) => {
    onSelectSuggestedService?.(service, petId, petName);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  useEffect(() => {
    if (callbacks) return;
    if (!customerId) {
      setCustomerPricing(null);
      setCustomerPoints(0);
      return;
    }
    if (!customerDetail) return;

    setCustomerPricing({
      groupId: customerDetail.group?.id,
      groupName: customerDetail.group?.name,
      groupColor: customerDetail.group?.color,
      priceBookId: customerDetail.group?.priceBookId,
      priceBookName: customerDetail.group?.priceBook?.name ?? customerDetail.group?.pricePolicy,
      discountRate: Number(customerDetail.group?.discount ?? 0),
    });
    setCustomerPoints(customerDetail.points || 0);
  }, [callbacks, customerDetail, customerId, setCustomerPricing, setCustomerPoints]);

  if (!callbacks && !activeTab) return null;

  const hasCustomer = !!customerId;

  const handleSelectCustomer = (customer: any) => {
    if (callbacks) {
      callbacks.onSelectCustomer(customer.id, customer.fullName || customer.name || 'Khách lẻ');
    } else {
      setCustomer(customer.id, customer.fullName, null);
    }
    setShowCustomerSearch(false);
    setCustomerQuery('');
  };

  const handleRemoveCustomer = () => {
    if (callbacks) {
      callbacks.onRemoveCustomer();
    } else {
      setCustomer(undefined, 'Khách lẻ', null);
    }
  };

  return (
    <div className="w-full relative" ref={containerRef}>
      {hasCustomer ? (
        <div className={theme === 'pos' ? 'bg-slate-50 border-b border-gray-200' : 'bg-background-secondary border-b border-border'}>
          <div className="p-4 relative">
            <button
              onClick={handleRemoveCustomer}
              className={`absolute top-4 right-4 p-1 text-gray-400 hover:text-red-500 rounded-full transition-colors shadow-sm ${theme === 'pos' ? 'bg-white hover:bg-red-50' : 'bg-background hover:bg-red-500/10'}`}
              title="Xoá khách hàng"
            >
              <X size={16} />
            </button>
            <div className="flex gap-4 items-start">
              <div className="w-14 h-14 rounded-full bg-cyan-500 text-white flex items-center justify-center text-2xl font-bold shrink-0 uppercase shadow-sm">
                {customerDisplayName?.charAt(0) || 'U'}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[17px] font-bold ${theme === 'pos' ? 'text-slate-800' : 'text-foreground'}`}>{customerDisplayName}</span>
                  {customerDisplayName?.toLowerCase() !== 'khách lẻ' && (
                    <button onClick={handleEditCustomerClick} className="text-gray-400 hover:text-primary-600" title="Chỉnh sửa">
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
                {customerDetail && (
                  <>
                    {customerDetail.phone && <div className={`text-[15px] ${theme === 'pos' ? 'text-slate-500' : 'text-foreground-muted'}`}>{customerDetail.phone}</div>}
                    {customerDetail.address && <div className={`text-[15px] ${theme === 'pos' ? 'text-slate-500' : 'text-foreground-muted'}`}>{customerDetail.address}</div>}
                  </>
                )}
              </div>

              <div className="ml-auto mt-1 flex items-center gap-1 font-bold text-[13px] text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                <Medal size={14} className="text-orange-500" /> {customerDetail?.points || 0} điểm
              </div>
            </div>
          </div>

          <div className={`p-4 pt-3 shadow-[0_-1px_2px_rgba(0,0,0,0.02)] ${theme === 'pos' ? 'border-t border-white' : 'border-t border-border'}`}>
            <div className={`text-[12px] font-bold flex items-center gap-1.5 mb-3 uppercase tracking-wider ${theme === 'pos' ? 'text-slate-500' : 'text-foreground-muted'}`}>
              <PawPrint size={14} /> Thú cưng khách hàng
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar pr-4">
              {customerDetail?.pets?.map((pet: any) => (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => handleOpenPetProfile(pet.id)}
                  className={`flex min-w-[60px] sm:min-w-[72px] flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 transition ${theme === 'pos' ? 'hover:bg-white/70' : 'hover:bg-background'}`}
                >
                  <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full overflow-hidden shadow-sm ring-1 ${theme === 'pos' ? 'bg-slate-100 border border-white ring-gray-200' : 'bg-background-tertiary border border-border ring-border/50'}`}>
                    {pet.avatar ? (
                      <Image src={String(pet.avatar).startsWith('http') ? pet.avatar : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${pet.avatar}`}
                        alt={pet.name}
                        className="w-full h-full object-cover" width={400} height={400} unoptimized />
                    ) : (
                      <span className={`font-bold text-xl flex items-center justify-center w-full h-full ${theme === 'pos' ? 'text-slate-600' : 'text-foreground-muted'}`}>
                        {pet.name?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className={`font-bold text-[13px] whitespace-nowrap ${theme === 'pos' ? 'text-slate-800' : 'text-foreground'}`}>{pet.name}</span>
                  {pet.weight && (
                    <span className="bg-orange-100 text-orange-600 font-bold text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                      {pet.weight} kg
                    </span>
                  )}
                </button>
              ))}

              <div className="flex flex-col items-center gap-1.5 min-w-[60px] cursor-pointer group" onClick={() => setShowPetModal(true)}>
                <div className={`w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${theme === 'pos' ? 'border-gray-300 text-gray-400 group-hover:bg-white group-hover:text-primary-500 group-hover:border-primary-400' : 'border-border text-foreground-muted group-hover:bg-background group-hover:text-primary-500 group-hover:border-primary-500/50'}`}>
                  <Plus size={24} />
                </div>
                <span className={`text-[13px] font-medium whitespace-nowrap group-hover:text-primary-600 ${theme === 'pos' ? 'text-slate-500' : 'text-foreground-muted'}`}>Thêm Pet</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`flex items-center border-b ${theme === 'pos' ? 'border-gray-200' : 'border-border'}`}>
          <div className="flex-1 flex items-center px-3 py-2.5 relative">
            <Search size={16} className={theme === 'pos' ? 'text-gray-400' : 'text-foreground-muted'} />
            <input
              className={`w-full pl-2 bg-transparent border-none outline-none text-sm placeholder:text-gray-400 ${theme === 'pos' ? 'text-gray-800' : 'text-foreground'}`}
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
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border shadow-xl overflow-hidden z-50 flex flex-col">
          <CustomerSearchResults
            customers={customers as any[]}
            query={customerQuery}
            variant="pos"
            showGuest={false}
            guestLabel="Khách lẻ"
            onSelectGuest={() => {
              if (callbacks) {
                callbacks.onSelectCustomer('', 'Khách lẻ');
              } else {
                setCustomer(undefined, 'Khách lẻ', null);
              }
              setShowCustomerSearch(false);
            }}
            onSelectCustomer={handleSelectCustomer}
            onQuickAdd={handleQuickAddClick}
          />
        </div>
      )}

      <PosAddCustomerModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        initialData={customerModalData}
        onSaved={handleCustomerSaved}
      />

      {hasCustomer && customerDetail && (
        <PetFormModal
          isOpen={showPetModal}
          onClose={() => setShowPetModal(false)}
          customerId={customerDetail.id}
          customerName={customerDetail.fullName}
          customerPhone={customerDetail.phone}
          onSaved={handlePetSaved}
        />
      )}

      {hasCustomer && customerDetail && selectedPetId ? createPortal(
        <UnifiedPetProfile
          isOpen
          petId={selectedPetId}
          ownerName={customerDetail.fullName}
          onClose={() => setSelectedPetId(null)}
          onSelectService={handleSelectServiceFromPet}
          mode="pos"
        />,
        document.body
      ) : null}
    </div>
  );
}
