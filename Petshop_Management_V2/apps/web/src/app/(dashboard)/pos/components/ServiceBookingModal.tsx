'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, PawPrint, User, X } from 'lucide-react';
import { groomingApi } from '@/lib/api/grooming.api';
import { hotelApi } from '@/lib/api/hotel.api';
import { useCustomerPets } from '../_hooks/use-pos-queries';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value) + 'd';

const toHotelIsoString = (value: string, hour: number) => {
  const date = new Date(`${value}T${String(hour).padStart(2, '0')}:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const normalizeText = (value?: string) =>
  value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase() ?? '';

const inferSpaPackageCode = (service: any) => {
  const text = normalizeText(`${service?.name ?? ''} ${service?.sku ?? ''}`);
  const hasBath = text.includes('tam');
  const hasClip = text.includes('cao') || text.includes('cat');
  const hasHygiene = text.includes('ve sinh');

  if (text.includes('spa')) return 'SPA';
  if (hasBath && hasClip && hasHygiene) return 'BATH_CLIP_HYGIENE';
  if (hasBath && hasHygiene) return 'BATH_HYGIENE';
  if (hasClip) return 'CLIP';
  if (hasBath) return 'BATH';
  if (hasHygiene) return 'HYGIENE';
  return undefined;
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
  const [startTime, setStartTime] = useState<string>('');
  const [performerId, setPerformerId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    setSelectedPet(initialPetId ?? '');
    setCheckIn('');
    setCheckOut('');
    setStartTime('');
    setPerformerId('');
    setNotes('');
  }, [initialPetId, isOpen, service?.id]);

  const serviceSearchText = normalizeText(`${service?.name ?? ''} ${service?.sku ?? ''}`);
  const isHotel =
    service?.type === 'hotel' ||
    serviceSearchText.includes('luu chuong') ||
    serviceSearchText.includes('hotel');
  const isGrooming =
    service?.type === 'grooming' ||
    service?.suggestionKind === 'SPA' ||
    serviceSearchText.includes('spa') ||
    serviceSearchText.includes('tam') ||
    serviceSearchText.includes('cao') ||
    serviceSearchText.includes('cat') ||
    serviceSearchText.includes('long') ||
    serviceSearchText.includes('ve sinh');

  const selectedPetProfile = (pets as any[]).find((pet) => pet.id === selectedPet);
  const isPetLocked = Boolean(initialPetId);
  const spaPackageCode = inferSpaPackageCode(service);
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
    enabled: isOpen && Boolean(service) && isHotel && Boolean(selectedPet) && hasHotelProfile && hasValidRange,
    staleTime: 30_000,
  });

  const spaPreviewQuery = useQuery({
    queryKey: ['pos', 'spa-preview', selectedPet, spaPackageCode],
    queryFn: () =>
      groomingApi.calculatePrice({
        petId: selectedPet,
        packageCode: String(spaPackageCode),
      }),
    enabled: isOpen && Boolean(service) && isGrooming && Boolean(selectedPet) && Boolean(spaPackageCode),
    retry: false,
    staleTime: 30_000,
  });

  if (!isOpen || !service) return null;

  const handleConfirm = () => {
    if (!selectedPet) {
      alert('Vui long chon thu cung');
      return;
    }

    if (isHotel) {
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
      return;
    }

    onConfirm({
      type: 'grooming',
      details: {
        petId: selectedPet,
        startTime: startTime || undefined,
        performerId: performerId || undefined,
        notes: notes || undefined,
        packageCode: spaPackageCode,
        weightAtBooking: spaPreviewQuery.data?.weight,
        weightBandId: spaPreviewQuery.data?.weightBand.id,
        weightBandLabel: spaPreviewQuery.data?.weightBand.label,
        pricingPrice: spaPreviewQuery.data?.price,
        pricingSnapshot: spaPreviewQuery.data?.pricingSnapshot,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="animate-slide-in flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background-secondary shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            {isHotel ? (
              <Calendar size={18} className="text-primary-500" />
            ) : (
              <ScissorsIcon size={18} className="text-primary-500" />
            )}
            Dat lich: {service.name}
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

          {isHotel ? (
            <>
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
            </>
          ) : null}

          {isGrooming ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-foreground-muted">
                    Bat dau luc
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1 text-sm font-semibold text-foreground-muted">
                    <User size={14} /> Nhan vien
                  </label>
                  <select
                    className="form-input"
                    value={performerId}
                    onChange={(event) => setPerformerId(event.target.value)}
                  >
                    <option value="">-- Chon --</option>
                    <option value="STAFF-1">Nhan vien Grooming 1</option>
                    <option value="STAFF-2">Nhan vien Grooming 2</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground-muted">
                  Ghi chu (tuy chon)
                </label>
                <textarea
                  className="form-input max-h-24"
                  rows={2}
                  placeholder="Ghi chu them ve yeu cau cua khach..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              {selectedPet && spaPackageCode && spaPreviewQuery.isLoading ? (
                <div className="rounded-xl border border-border bg-background-base p-4 text-sm text-foreground-muted">
                  Dang tinh gia SPA theo can nang...
                </div>
              ) : null}

              {spaPreviewQuery.data ? (
                <div className="rounded-xl border border-primary-100 bg-primary-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Gia SPA tu dong</p>
                      <p className="mt-1 text-xs text-foreground-muted">
                        Hang can:{' '}
                        <strong className="text-foreground">
                          {spaPreviewQuery.data.weightBand.label}
                        </strong>
                        {' Â· '}
                        Goi:{' '}
                        <strong className="text-foreground">
                          {spaPreviewQuery.data.packageCode}
                        </strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-foreground-muted">Gia</p>
                      <p className="text-lg font-bold text-primary-700">
                        {formatCurrency(spaPreviewQuery.data.price)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedPet && spaPackageCode && spaPreviewQuery.isError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  Chua co bang gia SPA phu hop, tam dung gia tren danh muc dich vu.
                </div>
              ) : null}
            </>
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
  );
}
