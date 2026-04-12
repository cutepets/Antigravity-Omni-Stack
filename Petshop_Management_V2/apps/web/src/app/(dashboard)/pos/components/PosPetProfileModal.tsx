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
  Pencil,
} from 'lucide-react';
import { petApi } from '@/lib/api/pet.api';
import { usePetPricingSuggestions } from '../_hooks/use-pos-queries';
import { PosAddPetModal } from './PosAddPetModal';

type PetProfileTab = 'suggestions' | 'vaccines' | 'services' | 'updates';

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'd';

const fmtDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'Chưa có';

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
  return `${Math.max(months, 0)} tháng`;
};

function PetStatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  actionText,
  actionUrl,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string | null;
  tone: 'blue' | 'amber' | 'green';
  actionText?: string;
  actionUrl?: string;
}) {
  const toneClass =
    tone === 'blue'
      ? 'bg-primary-500/10 text-primary-500'
      : tone === 'green'
        ? 'bg-success/10 text-success'
        : 'bg-warning/10 text-warning';

  return (
    <div className="group relative rounded-xl bg-background-secondary p-4 transition-colors hover:bg-background-tertiary">
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneClass}`}>
          <Icon size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-foreground-muted/70">
            {label}
          </p>
          <p className="mt-[2px] truncate text-sm font-bold text-foreground">{value}</p>
          {sub ? <p className="mt-[2px] text-[11px] text-foreground-muted/50">{sub}</p> : null}
        </div>
      </div>
      {actionUrl ? (
        <Link
          href={actionUrl}
          target="_blank"
          title={actionText}
          className="absolute right-3 top-3 rounded bg-background-base p-1 text-foreground-muted opacity-0 transition-opacity hover:bg-primary-500 hover:text-white group-hover:opacity-100"
        >
          <Pencil size={12} />
        </Link>
      ) : null}
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
  const [editModalOpen, setEditModalOpen] = useState(false);

  const petQuery = useQuery({
    queryKey: ['pos', 'pet-profile', petId],
    queryFn: () => petApi.getPet(petId!),
    enabled: isOpen && Boolean(petId),
    staleTime: 30_000,
  });

  const pet = petQuery.data as any;
  const pricingSuggestionsQuery = usePetPricingSuggestions(pet);
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

  const suggestedServices = pricingSuggestionsQuery.data.slice(0, 6);

  if (!isOpen || !petId) return null;

  const tabs = [
    { id: 'suggestions' as const, label: 'Gợi ý', count: suggestedServices.length, icon: Sparkles },
    { id: 'vaccines' as const, label: 'Tiêm phòng', count: pet?.vaccinations?.length ?? 0, icon: Syringe },
    { id: 'services' as const, label: 'Dịch vụ', count: serviceHistory.length, icon: Clock3 },
    { id: 'updates' as const, label: 'Lịch sử cập nhật', count: weightLogs.length + (pet?.updatedAt ? 1 : 0), icon: Info },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background-tertiary shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 text-foreground">
            <div className="flex h-8 w-8 items-center justify-center text-primary-500">
              <PawPrint size={20} />
            </div>
            <h2 className="text-lg font-bold">
              Hồ sơ Thú cưng <span className="font-normal text-foreground-muted">— {ownerName || pet?.customer?.fullName || 'Khách hàng hiện tại'}</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
            >
              <Pencil size={14} /> Sửa
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {petQuery.isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center text-foreground-muted">
            Đang tải hồ sơ pet...
          </div>
        ) : petQuery.isError || !pet ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-foreground-muted">
            <PawPrint size={30} className="opacity-50" />
            <p>Không tải được hồ sơ pet.</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-5">
              <div className="flex flex-col gap-5">
                <div className="flex items-start gap-5">
                  <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-2xl bg-background-secondary text-5xl font-black uppercase text-foreground-muted">
                    {pet?.avatar ? (
                      <img src={avatarUrl} alt={pet.name} className="h-full w-full rounded-2xl object-cover" />
                    ) : (
                      pet.name?.charAt(0)
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pt-1">
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-3xl font-bold tracking-tight text-foreground">
                          {pet.name}
                        </h2>
                        {pet.temperament ? (
                          <div className="flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                            <span>{pet.temperament}</span>
                            <button
                              type="button"
                              onClick={() => setEditModalOpen(true)}
                              className="text-violet-500 transition-colors hover:text-violet-700 dark:hover:text-violet-300"
                              title="Cập nhật tính cách"
                            >
                              <Pencil size={10} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditModalOpen(true)}
                            className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1 text-[11px] text-foreground-muted transition-colors hover:border-primary-500 hover:text-primary-500"
                            title="Thêm tính cách"
                          >
                            <span>Tính cách?</span>
                            <Pencil size={10} />
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                          {pet.species || 'PET'}
                        </span>
                        {pet.breed ? (
                          <span className="ml-1 text-[13px] font-bold text-foreground">{pet.breed}</span>
                        ) : null}
                        <span className="mx-1 text-[13px] text-foreground-muted">•</span>
                        <span className="text-[13px] text-foreground-muted">{pet.gender === 'MALE' ? '♂ Cái' : pet.gender === 'FEMALE' ? '♀ Cái' : 'Không rõ'}</span>
                        {ageLabel ? (
                          <>
                            <span className="mx-1 text-[13px] text-foreground-muted">•</span>
                            <span className="text-[13px] text-foreground-muted">{ageLabel}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 grid flex-1 gap-3 md:grid-cols-3">
                      <PetStatCard
                        icon={User}
                        label="Chủ sở hữu"
                        value={pet.customer?.fullName || ownerName || 'Khách hàng'}
                        sub={pet.customer?.phone || 'Chưa có số điện thoại'}
                        tone="blue"
                      />
                      <PetStatCard
                        icon={Scale}
                        label="Cân nặng"
                        value={hasWeight ? `${pet.weight} kg` : 'Chưa cân lần nào'}
                        sub={
                          weightLogs[0]?.date
                            ? `Cập nhật ${fmtDate(weightLogs[0].date)}`
                            : null
                        }
                        actionText="Cập nhật nhanh"
                        actionUrl={`/pets/${petId}?tab=medical`}
                        tone="amber"
                      />
                      <PetStatCard
                        icon={Syringe}
                        label="Mũi tiêm gần nhất"
                        value={lastVaccination?.vaccineName || 'Chưa có'}
                        sub={
                          lastVaccination?.date
                            ? fmtDate(lastVaccination.date)
                            : null
                        }
                        actionText="Cập nhật nhanh"
                        actionUrl={`/pets/${petId}?tab=medical`}
                        tone="green"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-y border-border px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                      active
                        ? 'border-primary-500 text-primary-500'
                        : 'border-transparent text-foreground-muted hover:text-foreground'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label} ({tab.count})
                  </button>
                );
              })}
            </div>

            <div className="min-h-[300px] overflow-y-auto px-6 py-5">
              {activeTab === 'suggestions' ? (
                <div className="space-y-4">
                  {!hasWeight ? (
                    <div className="rounded-xl border border-warning/20 bg-warning/5 px-6 py-6 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
                        <Scale size={24} />
                      </div>
                      <p className="mt-3 text-lg font-bold text-foreground">Chưa cân lần nào</p>
                      <p className="mx-auto mt-2 max-w-lg text-sm text-foreground-muted">
                        Cân pet để hệ thống gợi ý gói spa và bảng giá hotel chính xác theo hạng cân.
                      </p>
                      <Link
                        href={`/pets/${petId}`}
                        className="mt-4 inline-flex rounded-lg bg-warning/10 px-4 py-2 text-sm font-medium text-warning transition hover:bg-warning/20"
                      >
                        Cập nhật cân nặng ngay
                      </Link>
                    </div>
                  ) : null}

                  {pricingSuggestionsQuery.isLoading ? (
                    <div className="rounded-xl border border-border bg-background-secondary px-6 py-8 text-center text-sm text-foreground-muted">
                      Đang tải bảng giá phù hợp với thú cưng...
                    </div>
                  ) : null}

                  {pricingSuggestionsQuery.isError ? (
                    <div className="rounded-xl border border-error/20 bg-error/5 px-6 py-6 text-center text-sm text-error">
                      Không tải được bảng giá. Kiểm tra lại cấu hình bảng giá hoặc kết nối API.
                    </div>
                  ) : null}

                  {!pricingSuggestionsQuery.isLoading && pricingSuggestionsQuery.hasPricingProfile && suggestedServices.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-foreground-muted">
                      Chưa có dòng bảng giá phù hợp với loài và hạng cân hiện tại của thú cưng.
                    </div>
                  ) : null}

                  <div className="grid gap-3 xl:grid-cols-2">
                    {suggestedServices.map((service) => (
                      <div
                        key={service.id}
                        onClick={() => onSelectService(service, pet.id)}
                        className="group flex cursor-pointer flex-col justify-between rounded-xl bg-background-secondary p-4 transition-colors hover:bg-background-tertiary"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-h-[50px] flex-col justify-between">
                            <span
                              className={`inline-flex w-fit rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                service.suggestionKind === 'HOTEL'
                                  ? 'bg-primary-500/10 text-primary-500'
                                  : service.suggestionKind === 'SPA'
                                    ? 'bg-pink-500/10 text-pink-500'
                                    : 'bg-warning/10 text-warning'
                              }`}
                            >
                              {service.suggestionKind}
                            </span>
                            
                            <div className="mt-4 flex flex-wrap items-center gap-1.5">
                              <h3 className="truncate text-[15px] font-bold text-foreground group-hover:text-primary-500 transition-colors">
                                {service.name}
                              </h3>
                              {service.weightBandLabel ? (
                                <span className="text-[12px] font-normal text-foreground-muted">
                                  · {service.weightBandLabel}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-[17px] font-bold text-foreground group-hover:text-primary-500 transition-colors">
                              {money(service.sellingPrice ?? service.price ?? 0)}
                            </p>
                            {service.duration ? (
                              <p className="mt-0.5 text-[11px] text-foreground-muted">{service.duration} phút</p>
                            ) : null}
                          </div>
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
                        className="flex items-start gap-4 rounded-xl border border-border bg-background-secondary p-4"
                      >
                        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                          <Syringe size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-foreground">
                              {vaccine.vaccineName}
                            </p>
                            {index === 0 ? (
                              <span className="rounded-md bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success uppercase">
                                Mới nhất
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-foreground-muted">
                            Tiêm: {fmtDate(vaccine.date)}
                            {vaccine.nextDueDate ? ` · Hẹn tiếp: ${fmtDate(vaccine.nextDueDate)}` : ''}
                          </p>
                          {vaccine.notes ? (
                            <p className="mt-2 text-sm text-foreground-muted/70">{vaccine.notes}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-foreground-muted">
                    <Syringe size={28} className="opacity-40" />
                    <p>Chưa có lịch sử tiêm phòng.</p>
                  </div>
                )
              ) : null}

              {activeTab === 'services' ? (
                serviceHistory.length ? (
                  <div className="space-y-3">
                    {serviceHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-4 rounded-xl border border-border bg-background-secondary p-4"
                      >
                        <div
                          className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            entry.type === 'HOTEL'
                              ? 'bg-primary-500/10 text-primary-500'
                              : 'bg-pink-500/10 text-pink-500'
                          }`}
                        >
                          {entry.type === 'HOTEL' ? <Hotel size={16} /> : <Scissors size={16} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-foreground">{entry.label}</p>
                            <span className="rounded-md border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-foreground-muted">
                              {entry.type}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-foreground-muted">
                            {fmtDate(entry.date)}
                            {entry.status ? ` · ${entry.status}` : ''}
                          </p>
                          {entry.note ? (
                            <p className="mt-2 text-sm text-foreground-muted/70">{entry.note}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-foreground-muted">
                    <Clock3 size={28} className="opacity-40" />
                    <p>Pet này chưa có lịch sử dịch vụ.</p>
                  </div>
                )
              ) : null}

              {activeTab === 'updates' ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-background-secondary p-4">
                    <p className="text-base font-semibold text-foreground">Tạo hồ sơ</p>
                    <p className="mt-1 text-sm text-foreground-muted">{fmtDate(pet.createdAt)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background-secondary p-4">
                    <p className="text-base font-semibold text-foreground">Cập nhật gần nhất</p>
                    <p className="mt-1 text-sm text-foreground-muted">{fmtDate(pet.updatedAt)}</p>
                  </div>
                  {weightLogs.slice(0, 3).map((log: any) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-border bg-background-secondary p-4"
                    >
                      <p className="text-base font-semibold text-foreground">
                        Cân nặng {log.weight} kg
                      </p>
                      <p className="mt-1 text-sm text-foreground-muted">{fmtDate(log.date)}</p>
                      {log.notes ? (
                        <p className="mt-2 text-sm text-foreground-muted/70">{log.notes}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {editModalOpen && (
        <PosAddPetModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          customerId={pet?.customerId || pet?.customer?.id}
          customerName={ownerName || pet?.customer?.fullName || 'Khách hàng'}
          customerPhone={pet?.customer?.phone}
          initialPet={pet}
          onSaved={() => {
            setEditModalOpen(false);
            petQuery.refetch();
          }}
        />
      )}
    </div>
  );
}
