'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, PawPrint, X } from 'lucide-react';
import { toast } from 'sonner';
import { hotelApi } from '@/lib/api/hotel.api';
import { useAuthStore } from '@/stores/auth.store';
import { useCustomerPets } from '@/app/(dashboard)/_shared/customer/use-customer-pets';
import type { PetProfile } from '@petshop/shared';

const DAYCARE_PACKAGE_DAYS = 10;

const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'd';

const toHotelIsoString = (value: string, hour: number) => {
  const date = new Date(`${value}T${String(hour).padStart(2, '0')}:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const addDaysToDateInput = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const [selectedPet, setSelectedPet] = useState<string>('');
  const [checkIn, setCheckIn] = useState<string>('');
  const [checkOut, setCheckOut] = useState<string>('');
  const isDaycare = service?.careMode === 'DAYCARE' || service?.pricingSnapshot?.careMode === 'DAYCARE';

  useEffect(() => {
    if (!isOpen) return;
    setSelectedPet(initialPetId ?? service?.initialPetId ?? '');
    setCheckIn('');
    setCheckOut('');
  }, [initialPetId, isOpen, service?.id, service?.initialPetId]);

  const selectedPetProfile =
    (pets as PetProfile[]).find((pet) => pet.id === selectedPet) ??
    (service?.petSnapshot?.id === selectedPet ? service.petSnapshot : null);
  const isPetLocked = Boolean(initialPetId);
  const hotelCheckInIso = checkIn ? toHotelIsoString(checkIn, 9) : '';
  const derivedCheckOut = isDaycare && checkIn ? addDaysToDateInput(checkIn, DAYCARE_PACKAGE_DAYS - 1) : '';
  const effectiveCheckOut = isDaycare ? derivedCheckOut : checkOut;
  const hotelCheckOutIso = effectiveCheckOut ? toHotelIsoString(effectiveCheckOut, 21) : '';
  const petWeight = Number(selectedPetProfile?.weight ?? Number.NaN);
  const hasHotelProfile = Boolean(selectedPetProfile?.species) && Number.isFinite(petWeight);
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
      activeBranchId,
    ],
    queryFn: () =>
      hotelApi.calculatePrice({
        checkIn: hotelCheckInIso,
        checkOut: hotelCheckOutIso,
        species: String(selectedPetProfile?.species ?? ''),
        weight: petWeight,
        branchId: activeBranchId ?? undefined,
      }),
    enabled: isOpen && !isDaycare && Boolean(service) && Boolean(selectedPet) && hasHotelProfile && hasValidRange,
    staleTime: 30_000,
  });

  if (!isOpen || !service) return null;

  const handleConfirm = () => {
    if (!selectedPet) {
      toast.error('Vui long chon thu cung');
      return;
    }
    if (!checkIn || (!isDaycare && !checkOut)) {
      toast.error(isDaycare ? 'Vui long chon ngay bat dau goi nha tre' : 'Vui long chon ngay nhan va tra thu cung');
      return;
    }
    if (!hasHotelProfile) {
      toast.error('Thu cung can co species va can nang de tinh gia');
      return;
    }
    if (!hasValidRange) {
      toast.error('Ngay tra phai lon hon ngay nhan');
      return;
    }

    const daycarePrice = Number(service?.sellingPrice ?? service?.price ?? 0);
    onConfirm({
      type: 'hotel',
      details: {
        petId: selectedPet,
        checkIn: hotelCheckInIso,
        checkOut: hotelCheckOutIso,
        lineType: hotelPreviewQuery.data?.lineType ?? 'REGULAR',
        careMode: isDaycare ? 'DAYCARE' : 'BOARDING',
        packageKind: isDaycare ? 'COMBO_10_DAYS' : 'NONE',
        packageTotalDays: isDaycare ? DAYCARE_PACKAGE_DAYS : undefined,
        packageStartDate: isDaycare ? hotelCheckInIso : undefined,
        packageEndDate: isDaycare ? hotelCheckOutIso : undefined,
        autoCompleteAt: isDaycare ? hotelCheckOutIso : undefined,
        weightBandId: isDaycare ? service?.weightBandId ?? null : hotelPreviewQuery.data?.weightBand?.id ?? null,
        weightBandLabel: isDaycare ? service?.weightBandLabel ?? null : hotelPreviewQuery.data?.weightBand?.label ?? null,
        pricingPreview: isDaycare
          ? {
              source: 'DAYCARE_COMBO_10',
              totalDays: DAYCARE_PACKAGE_DAYS,
              totalPrice: daycarePrice,
              averageDailyRate: daycarePrice,
              weightBand: service?.weightBandLabel
                ? {
                    id: service?.weightBandId ?? null,
                    label: service.weightBandLabel,
                  }
                : undefined,
            }
          : hotelPreviewQuery.data,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="animate-slide-in flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background-secondary shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Calendar size={18} className="text-primary-500" />
            {isDaycare ? 'Dat goi nha tre' : 'Dat lich hotel'}: {service.name}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-foreground-muted hover:bg-background-tertiary">
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
                  Vui long chon khach hang truoc khi chon thu cung.
                </div>
              ) : pets.length === 0 ? (
                <div className="rounded-lg bg-background-tertiary p-3 text-sm text-foreground-muted">
                  Khach hang nay chua co thu cung tren he thong.
                </div>
              ) : (
                <select className="form-input" value={selectedPet} onChange={(event) => setSelectedPet(event.target.value)}>
                  <option value="">-- Chon thu cung --</option>
                  {(pets as PetProfile[]).map((pet) => (
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
                {isDaycare ? 'Bat dau goi' : 'Nhan phong'}
              </label>
              <input type="date" className="form-input" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground-muted">
                {isDaycare ? 'Ket thuc goi' : 'Tra phong'}
              </label>
              <input
                type="date"
                className="form-input"
                value={effectiveCheckOut}
                onChange={(event) => setCheckOut(event.target.value)}
                disabled={isDaycare}
              />
            </div>
          </div>

          {selectedPetProfile && !hasHotelProfile ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Thu cung nay dang thieu species hoac can nang, chua the preview gia.
            </div>
          ) : null}

          {selectedPetProfile && hasValidRange && hotelPreviewQuery.isLoading ? (
            <div className="rounded-xl border border-border bg-background-base p-4 text-sm text-foreground-muted">
              Dang tinh bang gia hotel...
            </div>
          ) : null}

          {selectedPetProfile && !hasValidRange && checkIn && effectiveCheckOut ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
              Ngay tra phai lon hon ngay nhan.
            </div>
          ) : null}

          {isDaycare && selectedPetProfile && hasValidRange ? (
            <div className="rounded-xl border border-primary-100 bg-primary-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Preview nha tre</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Hang can: <strong className="text-foreground">{service?.weightBandLabel ?? 'Chua xac dinh'}</strong>
                    {' · '}
                    Combo <strong className="text-foreground">{DAYCARE_PACKAGE_DAYS} ngay</strong>
                  </p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Tu {checkIn || '--'} den {effectiveCheckOut || '--'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-foreground-muted">Tam tinh</p>
                  <p className="text-lg font-bold text-primary-700">
                    {formatCurrency(Number(service?.sellingPrice ?? service?.price ?? 0))}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {!isDaycare && hotelPreviewQuery.data ? (
            <div className="rounded-xl border border-primary-100 bg-primary-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Preview hotel</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Hang can:{' '}
                    <strong className="text-foreground">{hotelPreviewQuery.data.weightBand?.label ?? 'Chua xac dinh'}</strong>
                    {' · '}
                    Tong ngay tinh tien:{' '}
                    <strong className="text-foreground">{hotelPreviewQuery.data.totalDays}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-foreground-muted">Tam tinh</p>
                  <p className="text-lg font-bold text-primary-700">{formatCurrency(hotelPreviewQuery.data.totalPrice)}</p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {hotelPreviewQuery.data.chargeLines.map((line, index) => (
                  <div key={`${line.label}-${index}`} className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{line.label}</p>
                      <p className="text-xs text-foreground-muted">
                        {line.quantityDays} ngay x {formatCurrency(line.unitPrice)}
                      </p>
                    </div>
                    <p className="font-semibold text-foreground">{formatCurrency(line.subtotal)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-border bg-background-tertiary p-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 font-medium text-foreground transition-colors hover:bg-background-base">
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
