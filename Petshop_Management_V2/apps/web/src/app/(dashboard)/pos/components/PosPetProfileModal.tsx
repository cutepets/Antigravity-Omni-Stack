'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Clock3,
  Hotel,
  Info,
  PawPrint,
  Scale,
  Scissors,
  Sparkles,
  Syringe,
  User,
  X,
} from 'lucide-react';
import { petApi } from '@/lib/api/pet.api';
import { usePosServices } from '../_hooks/use-pos-queries';

type PetProfileTab = 'suggestions' | 'vaccines' | 'services' | 'updates';

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'd';

const fmtDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'Chua co';

const normalizeText = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const getAgeLabel = (dateOfBirth?: string | null) => {
  if (!dateOfBirth) return null;
  const now = new Date();
  const dob = new Date(dateOfBirth);
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years > 0) return `${years}t ${months}th`;
  return `${Math.max(months, 0)} thang`;
};

const classifyService = (service: any) => {
  const normalized = normalizeText(service?.name);
  if (
    normalized.includes('hotel') ||
    normalized.includes('luu chuong') ||
    normalized.includes('luu tru')
  ) {
    return 'HOTEL';
  }
  if (
    normalized.includes('spa') ||
    normalized.includes('groom') ||
    normalized.includes('tam') ||
    normalized.includes('ve sinh') ||
    normalized.includes('cat tia') ||
    normalized.includes('cao')
  ) {
    return 'SPA';
  }
  return 'SERVICE';
};

const matchesSpecies = (service: any, species?: string | null) => {
  const normalizedService = normalizeText(service?.name);
  const normalizedSpecies = normalizeText(species);

  if (!normalizedSpecies) return true;
  if (normalizedSpecies.includes('cho')) return !normalizedService.includes('meo');
  if (normalizedSpecies.includes('meo')) return !normalizedService.includes('cho');
  return true;
};

const getSuggestionReason = (service: any, pet: any, hasWeight: boolean) => {
  const kind = classifyService(service);
  if (kind === 'HOTEL') {
    return hasWeight
      ? 'Co the tinh gia hotel ngay theo hang can va ngay le.'
      : 'Nen cap nhat can nang de preview hotel chinh xac.';
  }
  if (kind === 'SPA') {
    return hasWeight
      ? 'Phu hop de tu van goi tam, ve sinh, cat tia theo can nang.'
      : 'Cap nhat can nang de goi y goi spa sat hon.';
  }
  if (pet?.species) {
    return `Dich vu phu hop voi ${pet.species.toLowerCase()}.`;
  }
  return 'Dich vu co the ap dung cho pet nay.';
};

const buildSuggestedServices = (services: any[], pet: any) => {
  const hasWeight = Number.isFinite(Number(pet?.weight));
  const normalizedSpecies = normalizeText(pet?.species);

  return services
    .filter((service) => matchesSpecies(service, pet?.species))
    .map((service) => {
      const kind = classifyService(service);
      let score = 0;

      if (kind === 'SPA') score += 50;
      if (kind === 'HOTEL') score += 45;
      if (hasWeight) score += 20;
      if (normalizedSpecies && normalizeText(service?.name).includes(normalizedSpecies)) {
        score += 15;
      }
      if (service?.duration) score += 5;

      return {
        ...service,
        suggestionKind: kind,
        suggestionScore: score,
        reason: getSuggestionReason(service, pet, hasWeight),
      };
    })
    .sort((left, right) => right.suggestionScore - left.suggestionScore)
    .slice(0, 6);
};

function PetStatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string | null;
  tone: 'blue' | 'amber' | 'green';
}) {
  const toneClass =
    tone === 'blue'
      ? 'bg-cyan-500/12 text-cyan-300'
      : tone === 'green'
        ? 'bg-emerald-500/12 text-emerald-300'
        : 'bg-amber-500/12 text-amber-300';

  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="mt-1 truncate text-lg font-semibold text-white">{value}</p>
          {sub ? <p className="mt-1 text-sm text-slate-400">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}

export interface PosPetProfileModalProps {
  isOpen: boolean;
  petId?: string | null;
  ownerName?: string;
  onClose: () => void;
  onSelectService: (service: any, petId: string) => void;
}

export function PosPetProfileModal({
  isOpen,
  petId,
  ownerName,
  onClose,
  onSelectService,
}: PosPetProfileModalProps) {
  const [activeTab, setActiveTab] = useState<PetProfileTab>('suggestions');
  const { data: services = [] } = usePosServices('');

  const petQuery = useQuery({
    queryKey: ['pos', 'pet-profile', petId],
    queryFn: () => petApi.getPet(petId!),
    enabled: isOpen && Boolean(petId),
    staleTime: 30_000,
  });

  const pet = petQuery.data as any;
  const avatarUrl =
    pet?.avatar && !String(pet.avatar).startsWith('data:')
      ? String(pet.avatar).startsWith('http')
        ? String(pet.avatar)
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${pet.avatar}`
      : pet?.avatar;
  const hasWeight = Number.isFinite(Number(pet?.weight));
  const ageLabel = getAgeLabel(pet?.dateOfBirth);
  const lastVaccination = pet?.vaccinations?.[0];
  const weightLogs = pet?.weightLogs ?? [];
  const serviceHistory = useMemo(() => {
    const history: Array<{
      id: string;
      label: string;
      type: 'SPA' | 'HOTEL';
      date: string;
      status?: string;
      note?: string;
    }> = [];

    for (const session of pet?.groomingSessions ?? []) {
      history.push({
        id: session.id,
        label: session.sessionCode ?? 'Grooming',
        type: 'SPA',
        date: session.startTime ?? session.createdAt,
        status: session.status,
        note: session.notes ?? null,
      });
    }

    for (const stay of pet?.hotelStays ?? []) {
      history.push({
        id: stay.id,
        label: stay.stayCode ?? 'Hotel',
        type: 'HOTEL',
        date: stay.checkIn,
        status: stay.status,
        note: stay.lineType,
      });
    }

    return history.sort(
      (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
    );
  }, [pet]);

  const suggestedServices = useMemo(
    () => (pet ? buildSuggestedServices(services as any[], pet) : []),
    [pet, services],
  );

  if (!isOpen || !petId) return null;

  const tabs = [
    { id: 'suggestions' as const, label: 'Goi y', count: suggestedServices.length, icon: Sparkles },
    { id: 'vaccines' as const, label: 'Tiem phong', count: pet?.vaccinations?.length ?? 0, icon: Syringe },
    { id: 'services' as const, label: 'Dich vu', count: serviceHistory.length, icon: Clock3 },
    { id: 'updates' as const, label: 'Lich su cap nhat', count: weightLogs.length + (pet?.updatedAt ? 1 : 0), icon: Info },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#171b23] shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-white/8 px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/12 text-cyan-300">
              <PawPrint size={19} />
            </div>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Ho so Thu cung
              </p>
              <p className="text-sm text-slate-400">
                {ownerName || pet?.customer?.fullName || 'Khach hang hien tai'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/pets/${petId}`}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-400/40 hover:text-white"
            >
              Mo ho so day du
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {petQuery.isLoading ? (
          <div className="flex min-h-[520px] items-center justify-center text-slate-400">
            Dang tai ho so pet...
          </div>
        ) : petQuery.isError || !pet ? (
          <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 text-slate-400">
            <PawPrint size={30} className="opacity-50" />
            <p>Khong tai duoc ho so pet.</p>
          </div>
        ) : (
          <>
            <div className="px-7 py-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
                <div className="flex items-start gap-5">
                  <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,#232834_0%,#1d2230_100%)] text-6xl font-black uppercase text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    {pet?.avatar ? (
                      <img src={avatarUrl} alt={pet.name} className="h-full w-full object-cover" />
                    ) : (
                      pet.name?.charAt(0)
                    )}
                  </div>

                  <div className="min-w-0 pt-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-5xl font-black tracking-tight text-white">
                        {pet.name}
                      </h2>
                      {pet.temperament ? (
                        <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-400">
                          {pet.temperament}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">
                        {pet.species || 'PET'}
                      </span>
                      {pet.breed ? (
                        <span className="text-lg text-slate-300">{pet.breed}</span>
                      ) : null}
                      <span className="text-lg text-slate-500">
                        {pet.gender === 'MALE' ? 'Duc' : pet.gender === 'FEMALE' ? 'Cai' : 'Khong ro'}
                      </span>
                      {ageLabel ? <span className="text-lg font-semibold text-white">{ageLabel}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="grid flex-1 gap-3 md:grid-cols-3">
                  <PetStatCard
                    icon={User}
                    label="Chu so huu"
                    value={pet.customer?.fullName || ownerName || 'Khach hang'}
                    sub={pet.customer?.phone || 'Chua co so dien thoai'}
                    tone="blue"
                  />
                  <PetStatCard
                    icon={Scale}
                    label="Can nang"
                    value={hasWeight ? `${pet.weight} kg` : 'Chua can lan nao'}
                    sub={
                      weightLogs[0]?.date
                        ? `Cap nhat ${fmtDate(weightLogs[0].date)}`
                        : 'Can de goi y dich vu sat hon'
                    }
                    tone="amber"
                  />
                  <PetStatCard
                    icon={Syringe}
                    label="Mui tiem gan nhat"
                    value={lastVaccination?.vaccineName || 'Chua co'}
                    sub={
                      lastVaccination?.date
                        ? fmtDate(lastVaccination.date)
                        : 'Nen bo sung lich tiem cho pet'
                    }
                    tone="green"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-b border-white/8 px-7">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 border-b-2 px-4 py-4 text-sm font-semibold transition ${
                      active
                        ? 'border-cyan-400 text-cyan-300'
                        : 'border-transparent text-slate-500 hover:text-slate-200'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label} ({tab.count})
                  </button>
                );
              })}
            </div>

            <div className="min-h-[360px] overflow-y-auto px-7 py-6">
              {activeTab === 'suggestions' ? (
                <div className="space-y-5">
                  {!hasWeight ? (
                    <div className="rounded-[28px] border border-amber-400/18 bg-[radial-gradient(circle_at_top,#2b2417_0%,#1d1b19_65%)] px-6 py-8 text-center">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/14 text-amber-300">
                        <Scale size={30} />
                      </div>
                      <p className="mt-5 text-3xl font-bold text-white">Chua can lan nao</p>
                      <p className="mx-auto mt-3 max-w-xl text-lg text-slate-400">
                        Can pet de he thong goi y goi spa va bang gia hotel chinh xac theo hang can.
                      </p>
                      <Link
                        href={`/pets/${petId}`}
                        className="mt-6 inline-flex rounded-full border border-amber-400/30 px-5 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/10"
                      >
                        Mo ho so pet de cap nhat can nang
                      </Link>
                    </div>
                  ) : null}

                  <div className="grid gap-4 xl:grid-cols-2">
                    {suggestedServices.map((service) => (
                      <div
                        key={service.id}
                        className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                  service.suggestionKind === 'HOTEL'
                                    ? 'bg-cyan-500/14 text-cyan-300'
                                    : service.suggestionKind === 'SPA'
                                      ? 'bg-pink-500/14 text-pink-300'
                                      : 'bg-amber-500/14 text-amber-300'
                                }`}
                              >
                                {service.suggestionKind}
                              </span>
                              {hasWeight ? (
                                <span className="text-xs font-medium text-emerald-300">
                                  Da co can nang
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-amber-300">
                                  Can cap nhat can nang
                                </span>
                              )}
                            </div>
                            <h3 className="mt-3 text-2xl font-bold text-white">{service.name}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-400">{service.reason}</p>
                          </div>

                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Don gia
                            </p>
                            <p className="mt-2 text-2xl font-black text-white">
                              {money(service.sellingPrice ?? service.price ?? 0)}
                            </p>
                            {service.duration ? (
                              <p className="mt-1 text-xs text-slate-500">{service.duration} phut</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Goi y cho {pet.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => onSelectService(service, pet.id)}
                            className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                          >
                            Chon dich vu
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === 'vaccines' ? (
                pet.vaccinations?.length ? (
                  <div className="space-y-3">
                    {pet.vaccinations.map((vaccine: any, index: number) => (
                      <div
                        key={vaccine.id}
                        className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/4 p-4"
                      >
                        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-300">
                          <Syringe size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold text-white">
                              {vaccine.vaccineName}
                            </p>
                            {index === 0 ? (
                              <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                                Moi nhat
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-400">
                            Tiem: {fmtDate(vaccine.date)}
                            {vaccine.nextDueDate ? ` · Hen tiep: ${fmtDate(vaccine.nextDueDate)}` : ''}
                          </p>
                          {vaccine.notes ? (
                            <p className="mt-2 text-sm text-slate-500">{vaccine.notes}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 text-slate-500">
                    <Syringe size={28} className="opacity-40" />
                    <p>Chua co lich su tiem phong.</p>
                  </div>
                )
              ) : null}

              {activeTab === 'services' ? (
                serviceHistory.length ? (
                  <div className="space-y-3">
                    {serviceHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/4 p-4"
                      >
                        <div
                          className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                            entry.type === 'HOTEL'
                              ? 'bg-cyan-500/12 text-cyan-300'
                              : 'bg-pink-500/12 text-pink-300'
                          }`}
                        >
                          {entry.type === 'HOTEL' ? <Hotel size={16} /> : <Scissors size={16} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold text-white">{entry.label}</p>
                            <span className="rounded-full border border-white/8 px-2.5 py-1 text-xs font-semibold text-slate-300">
                              {entry.type}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-400">
                            {fmtDate(entry.date)}
                            {entry.status ? ` · ${entry.status}` : ''}
                          </p>
                          {entry.note ? (
                            <p className="mt-2 text-sm text-slate-500">{entry.note}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 text-slate-500">
                    <Clock3 size={28} className="opacity-40" />
                    <p>Pet nay chua co lich su dich vu.</p>
                  </div>
                )
              ) : null}

              {activeTab === 'updates' ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                    <p className="text-lg font-semibold text-white">Tao ho so</p>
                    <p className="mt-1 text-sm text-slate-400">{fmtDate(pet.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                    <p className="text-lg font-semibold text-white">Cap nhat gan nhat</p>
                    <p className="mt-1 text-sm text-slate-400">{fmtDate(pet.updatedAt)}</p>
                  </div>
                  {weightLogs.slice(0, 3).map((log: any) => (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-white/8 bg-white/4 p-4"
                    >
                      <p className="text-lg font-semibold text-white">
                        Can nang {log.weight} kg
                      </p>
                      <p className="mt-1 text-sm text-slate-400">{fmtDate(log.date)}</p>
                      {log.notes ? (
                        <p className="mt-2 text-sm text-slate-500">{log.notes}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
