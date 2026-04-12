'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, DollarSign, Hotel, PawPrint, X } from 'lucide-react';
import { hotelApi } from '@/lib/api/hotel.api';
import { useCustomerPets } from '../_hooks/use-pos-queries';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value) + 'd';

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

export interface HotelCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  onConfirm: (checkoutDetails: any) => void;
}

export function HotelCheckoutModal({
  isOpen,
  onClose,
  customerId,
  onConfirm,
}: HotelCheckoutModalProps) {
  const [selectedPet, setSelectedPet] = useState<string>('');
  const [checkoutAt, setCheckoutAt] = useState(() => new Date().toISOString());
  const { data: pets = [] } = useCustomerPets(customerId);

  useEffect(() => {
    if (!isOpen) return;
    setCheckoutAt(new Date().toISOString());
  }, [isOpen, selectedPet]);

  const selectedPetProfile = (pets as any[]).find((pet) => pet.id === selectedPet);
  const petWeight = Number(selectedPetProfile?.weight ?? Number.NaN);
  const canPriceCheckout =
    Boolean(selectedPetProfile?.species) && Number.isFinite(petWeight);

  const activeStaysQuery = useQuery({
    queryKey: ['hotel', 'active-stays', customerId],
    queryFn: () =>
      hotelApi.getStayList({
        customerId,
        status: 'CHECKED_IN',
        limit: 100,
      }),
    enabled: isOpen && Boolean(customerId),
    staleTime: 15_000,
  });

  const activeStay = activeStaysQuery.data?.items.find(
    (stay) => stay.petId === selectedPet && stay.status === 'CHECKED_IN',
  );

  const checkoutPreviewQuery = useQuery({
    queryKey: [
      'hotel',
      'checkout-preview',
      activeStay?.id,
      selectedPet,
      checkoutAt,
      selectedPetProfile?.species,
      petWeight,
    ],
    queryFn: () =>
      hotelApi.calculatePrice({
        checkIn: activeStay!.checkIn,
        checkOut: checkoutAt,
        species: String(selectedPetProfile?.species ?? ''),
        weight: petWeight,
      }),
    enabled: Boolean(activeStay) && canPriceCheckout,
    staleTime: 10_000,
  });

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!activeStay) return;

    onConfirm({
      id: `HOTEL-CHECKOUT-${activeStay.id}`,
      description: `Thanh toan tra chuong (${activeStay.cage?.name ?? activeStay.stayCode ?? 'Hotel'})`,
      unitPrice: checkoutPreviewQuery.data?.totalPrice ?? activeStay.totalPrice,
      type: 'hotel',
      unit: 'lan',
      hotelDetails: {
        petId: activeStay.petId,
        stayId: activeStay.id,
        checkIn: activeStay.checkIn,
        checkOut: checkoutAt,
        lineType: checkoutPreviewQuery.data?.lineType ?? activeStay.lineType,
        pricingPreview: checkoutPreviewQuery.data,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="animate-slide-in flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background-secondary shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Hotel size={18} className="text-primary-500" />
            Tra thu cung (Checkout)
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-foreground-muted hover:bg-background-tertiary"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-sm font-semibold text-foreground-muted">
              <PawPrint size={14} /> Tra cuu theo thu cung
            </label>
            {!customerId ? (
              <div className="rounded-lg bg-warning/10 p-3 text-sm text-warning">
                Vui long chon khach hang o man hinh chinh truoc khi checkout.
              </div>
            ) : pets.length === 0 ? (
              <div className="rounded-lg bg-background-tertiary p-3 text-sm text-foreground-muted">
                Khach hang nay chua co thu cung tren he thong.
              </div>
            ) : (
              <select
                className="form-input"
                value={selectedPet}
                onChange={(event) => setSelectedPet(event.target.value)}
              >
                <option value="">-- Chon thu cung dang gui --</option>
                {(pets as any[]).map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name} ({pet.species || 'Khong ro'} - {pet.weight ?? '?'}kg)
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedPet && activeStaysQuery.isLoading ? (
            <div className="py-6 text-center text-foreground-muted">
              Dang tra cuu stay dang o...
            </div>
          ) : null}

          {selectedPet && !canPriceCheckout && selectedPetProfile ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Thu cung nay dang thieu species hoac can nang, khong the preview gia checkout.
            </div>
          ) : null}

          {selectedPet && !activeStaysQuery.isLoading && !activeStay ? (
            <div className="mt-2 rounded-lg bg-background-tertiary p-3 text-center text-sm text-foreground-muted">
              Khong tim thay thong tin luu chuong cho thu cung nay.
            </div>
          ) : null}

          {activeStay ? (
            <div className="mt-2 flex flex-col gap-3 rounded-xl border border-border bg-background-base p-4">
              <h3 className="border-b border-border pb-2 text-sm font-semibold text-foreground">
                Thong tin luu chuong
              </h3>

              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1 text-foreground-muted">
                    <Calendar size={12} /> Nhan luc
                  </span>
                  <span className="font-medium text-foreground">
                    {formatDateTime(activeStay.checkIn)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1 text-foreground-muted">
                    <Clock size={12} /> Tra luc
                  </span>
                  <span className="font-medium text-foreground">
                    {formatDateTime(checkoutAt)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1 text-foreground-muted">
                    <Hotel size={12} /> Chuong
                  </span>
                  <span className="font-medium text-foreground">
                    {activeStay.cage?.name ?? '---'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-foreground-muted">Hang can</span>
                  <span className="font-medium text-foreground">
                    {checkoutPreviewQuery.data?.weightBand?.label ??
                      activeStay.weightBand?.label ??
                      'Chua xac dinh'}
                  </span>
                </div>
              </div>

              {checkoutPreviewQuery.isLoading ? (
                <div className="rounded-lg bg-white/70 px-3 py-2 text-sm text-foreground-muted">
                  Dang tinh preview checkout...
                </div>
              ) : null}

              {checkoutPreviewQuery.data ? (
                <div className="space-y-2">
                  {checkoutPreviewQuery.data.chargeLines.map((line, index) => (
                    <div
                      key={`${line.label}-${index}`}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-foreground">{line.label}</p>
                        <p className="text-xs text-foreground-muted">
                          {line.quantityDays} ngay x {formatCurrency(line.unitPrice)}
                        </p>
                      </div>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(line.subtotal)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
                <span className="flex items-center gap-1 text-sm text-foreground-muted">
                  <DollarSign size={14} /> Thanh tien
                </span>
                <span className="text-xl font-bold text-accent">
                  {formatCurrency(
                    checkoutPreviewQuery.data?.totalPrice ?? activeStay.totalPrice,
                  )}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-border bg-background-tertiary p-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 font-medium text-foreground transition-colors hover:bg-background-base"
          >
            Dong
          </button>
          <button
            disabled={!activeStay}
            onClick={handleConfirm}
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-6 py-2 font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Them vao gio
          </button>
        </div>
      </div>
    </div>
  );
}
