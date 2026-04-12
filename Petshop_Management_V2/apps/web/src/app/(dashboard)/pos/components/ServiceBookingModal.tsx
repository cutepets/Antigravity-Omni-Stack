'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, PawPrint, X } from 'lucide-react';
import { hotelApi } from '@/lib/api/hotel.api';
import { useCustomerPets } from '../_hooks/use-pos-queries';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value) + 'd';

const toHotelIsoString = (value: string, hour: number) => {
  const date = new Date(`${value}T${String(hour).padStart(2, '0')}:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

export interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (bookingDetails: any) => void;
  service: any;
  customerId?: string;
  initialPetId?: string;
}

export function ServiceBookingModal({
  isOpen,
  onClose,
  onConfirm,
  service,
  customerId,
  initialPetId,
}: BookingModalProps) {
  const { data: pets = [] } = useCustomerPets(customerId);
  const [selectedPet, setSelectedPet] = useState<string>('');
  const [checkIn, setCheckIn] = useState<string>('');
  const [checkOut, setCheckOut] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    setSelectedPet(initialPetId ?? '');
    setCheckIn('');
    setCheckOut('');
  }, [initialPetId, isOpen, service?.id]);

  const selectedPetProfile =
    (pets as any[]).find((pet) => pet.id === selectedPet) ??
    (service?.petSnapshot?.id === selectedPet ? service.petSnapshot : null);
  const isPetLocked = Boolean(initialPetId);
  const hotelCheckInIso = checkIn ? toHotelIsoString(checkIn, 9) : '';
  const hotelCheckOutIso = checkOut ? toHotelIsoString(checkOut, 21) : '';
  const petWeight = Number(selectedPetProfile?.weight ?? Number.NaN);
  const hasHotelProfile =
    Boolean(selectedPetProfile?.species) && Number.isFinite(petWeight);
  const hasValidRange =
    Boolean(hotelCheckInIso) &&
    Boolean(hotelCheckOutIso) &&
    new Date(hotelCheckOutIso).getTime() > new Date(hotelCheckInIso).getTime();

  const hotelPreviewQuery = useQuery({
    queryKey: [
      'pos',
      'hotel-preview',
      selectedPet,
      hotelCheckInIso,
      hotelCheckOutIso,
      selectedPetProfile?.species,
      petWeight,
    ],
    queryFn: () =>
      hotelApi.calculatePrice({
        checkIn: hotelCheckInIso,
        checkOut: hotelCheckOutIso,
        species: String(selectedPetProfile?.species ?? ''),
        weight: petWeight,
      }),
    enabled: isOpen && Boolean(service) && Boolean(selectedPet) && hasHotelProfile && hasValidRange,
    staleTime: 30_000,
  });

  if (!isOpen || !service) return null;

  const handleConfirm = () => {
    if (!selectedPet) {
      alert('Vui long chon thu cung');
      return;
    }
    if (!checkIn || !checkOut) {
      alert('Vui long chon ngay nhan va tra thu cung');
      return;
    }
    if (!hasHotelProfile) {
      alert('Thu cung can co species va can nang de tinh gia hotel');
      return;
    }
    if (!hasValidRange) {
      alert('Ngay tra phai lon hon ngay nhan');
      return;
    }

    onConfirm({
      type: 'hotel',
      details: {
        petId: selectedPet,
        checkIn: hotelCheckInIso,
        checkOut: hotelCheckOutIso,
        lineType: hotelPreviewQuery.data?.lineType ?? 'REGULAR',
        pricingPreview: hotelPreviewQuery.data,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="animate-slide-in flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background-secondary shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Calendar size={18} className="text-primary-500" />
            Dat lich hotel: {service.name}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-foreground-muted hover:bg-background-tertiary"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {!isPetLocked ? (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-foreground-muted">
                <PawPrint size={14} /> Thu cung
              </label>
              {!customerId ? (
                <div className="rounded-lg bg-warning/10 p-3 text-sm text-warning">
                  Vui long chon khach hang o man hinh chinh truoc khi chon thu cung.
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
                  <option value="">-- Chon thu cung --</option>
                  {(pets as any[]).map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name} ({pet.species || 'Khong ro'} - {pet.weight ?? '?'}kg)
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground-muted">
                Nhan phong
              </label>
              <input
                type="date"
                className="form-input"
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground-muted">
                Tra phong
              </label>
              <input
                type="date"
                className="form-input"
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
              />
            </div>
          </div>

          {selectedPetProfile && !hasHotelProfile ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Thu cung nay dang thieu species hoac can nang, chua the preview gia hotel.
            </div>
          ) : null}

          {selectedPetProfile && hasValidRange && hotelPreviewQuery.isLoading ? (
            <div className="rounded-xl border border-border bg-background-base p-4 text-sm text-foreground-muted">
              Dang tinh bang gia hotel...
            </div>
          ) : null}

          {selectedPetProfile && !hasValidRange && checkIn && checkOut ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
              Ngay tra phai lon hon ngay nhan.
            </div>
          ) : null}

          {hotelPreviewQuery.data ? (
            <div className="rounded-xl border border-primary-100 bg-primary-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Preview hotel
                  </p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Hang can:{' '}
                    <strong className="text-foreground">
                      {hotelPreviewQuery.data.weightBand?.label ?? 'Chua xac dinh'}
                    </strong>
                    {' · '}
                    Tong ngay tinh tien:{' '}
                    <strong className="text-foreground">
                      {hotelPreviewQuery.data.totalDays}
                    </strong>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-foreground-muted">Tam tinh</p>
                  <p className="text-lg font-bold text-primary-700">
                    {formatCurrency(hotelPreviewQuery.data.totalPrice)}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {hotelPreviewQuery.data.chargeLines.map((line, index) => (
                  <div
                    key={`${line.label}-${index}`}
                    className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-sm"
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
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-border bg-background-tertiary p-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 font-medium text-foreground transition-colors hover:bg-background-base"
          >
            Huy
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-6 py-2 font-bold text-white transition-colors hover:bg-primary-600"
          >
            Them vao gio
          </button>
        </div>
      </div>
    </div>
  );
}
