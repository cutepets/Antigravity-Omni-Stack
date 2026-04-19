'use client';
import Image from 'next/image';

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
  Plus,
  Loader2,
  Check,
  AlertTriangle
} from 'lucide-react';
import { petApi } from '@/lib/api/pet.api';
import { usePetPricingSuggestions } from '@/app/(dashboard)/pos/_hooks/use-pos-queries';
import { PetFormModal } from '@/app/(dashboard)/pets/_components/pet-form-modal';
import { QuickVaccinationModal } from './QuickVaccinationModal';
import { usePosStore } from '@/stores/pos.store';


type PetProfileTab = 'suggestions' | 'vaccines' | 'services' | 'updates';

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';

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
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years > 0) return `${years} tuổi ${months} tháng`;
  if (months > 0) return `${months} tháng`;
  return `${Math.max(days, 0)} ngày`;
};

function PetStatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  actionText,
  onClick,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
  sub?: string | null;
  tone: 'blue' | 'amber' | 'green';
  actionText?: string;
  onClick?: () => void;
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
          <div className="mt-[2px] truncate text-sm font-bold text-foreground inline-flex items-center gap-1.5 flex-wrap min-w-0">{value}</div>
          {sub ? <p className="mt-[2px] text-[11px] text-foreground-muted/50">{sub}</p> : null}
        </div>
      </div>
      {actionText && onClick ? (
        <button
          onClick={onClick}
          title={actionText}
          className="absolute right-3 top-3 rounded bg-background-base p-1 text-foreground-muted opacity-0 shadow-sm transition-opacity hover:bg-primary-500 hover:text-white group-hover:opacity-100 flex items-center justify-center"
        >
          <Pencil size={12} />
        </button>
      ) : null}
    </div>
  );
}

export interface UnifiedPetProfileProps {
  isOpen: boolean;
  petId?: string | null;
  ownerName?: string;
  onClose: () => void;
  onSelectService?: (service: any, petId: string, petName?: string) => void;
  hideSuggestions?: boolean; // Flag to hide the suggestions tab in CRM
  mode?: 'pos' | 'crm';
}

export function UnifiedPetProfile({
  isOpen,
  petId,
  ownerName,
  onClose,
  onSelectService,
  hideSuggestions = false,
  mode = 'crm',
}: UnifiedPetProfileProps) {
  const [activeTab, setActiveTab] = useState<PetProfileTab>(hideSuggestions ? 'services' : 'suggestions');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [vacModalOpen, setVacModalOpen] = useState(false);
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [updateWeightValue, setUpdateWeightValue] = useState('');
  const [updateNote, setUpdateNote] = useState('');
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [weightValue, setWeightValue] = useState('');

  const petQuery = useQuery({
    queryKey: ['pet', petId], // Unified query key
    queryFn: () => petApi.getPet(petId!),
    enabled: isOpen && Boolean(petId),
    staleTime: 30_000,
  });

  const activeServicesQuery = useQuery({
    queryKey: ['pet', petId, 'active-services'],
    queryFn: () => petApi.getActivePetServices(petId!),
    enabled: isOpen && Boolean(petId),
  });

  const posActiveTab = usePosStore((state) => state.tabs.find((t) => t.id === state.activeTabId));
  const cartItems = mode === 'pos' ? posActiveTab?.cart ?? [] : [];

  const isInCart = (service: any) =>
    cartItems.some(
      (item) => item.petId === petId && (
        item.serviceId === service.id ||
        (item.sku && service.sku && item.sku === service.sku) ||
        (item.description === service.name && (
          (item.type === 'grooming' && service.suggestionKind === 'SPA') ||
          (item.type === 'hotel' && service.suggestionKind === 'HOTEL') ||
          item.type === 'service'
        ))
      )
    );

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
  const lastVaccination = pet?.vaccinations?.[0]; // Assuming order is desc
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

  const suggestedServices = pricingSuggestionsQuery.data?.slice(0, 20) ?? [];

  if (!isOpen || !petId) return null;

  const tabs = [
    ...(hideSuggestions ? [] : [{ id: 'suggestions' as const, label: 'Gợi ý', count: suggestedServices.length, icon: Sparkles }]),
    { id: 'services' as const, label: 'Dịch vụ', count: serviceHistory.length, icon: Clock3 },
    { id: 'vaccines' as const, label: 'Tiêm phòng', count: pet?.vaccinations?.length ?? 0, icon: Syringe },
    { id: 'updates' as const, label: 'Lịch sử', count: weightLogs.length + (pet?.updatedAt ? 1 : 0), icon: Info },
  ];

  const handleAddUpdate = async () => {
    if (!updateWeightValue && !updateNote) return;

    // Default to current weight if only note is provided
    const weightToSave = updateWeightValue ? Number(updateWeightValue) : (pet?.weight || 0.1);

    try {
      setIsSavingWeight(true);
      await petApi.addWeightLog(pet.id, {
        weight: weightToSave,
        notes: updateNote
      });
      petQuery.refetch();
      setIsAddingUpdate(false);
      setUpdateNote('');
      setUpdateWeightValue('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingWeight(false);
    }
  };

  const handleUpdateWeight = async () => {
    if (!weightValue || Number(weightValue) <= 0) {
      setIsEditingWeight(false);
      return;
    }
    try {
      setIsSavingWeight(true);
      await petApi.addWeightLog(pet.id, { weight: Number(weightValue) });
      petQuery.refetch();
      setIsEditingWeight(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingWeight(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background-tertiary shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
              <PawPrint size={20} />
            </div>
            <h2 className="text-lg font-bold">
              Hồ sơ Thú cưng <span className="font-normal text-foreground-muted">— {ownerName || pet?.customer?.fullName || 'Khách hàng'}</span>
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
              className="rounded-full p-1.5 text-foreground-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {petQuery.isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center text-foreground-muted">
            <div className="flex flex-col items-center gap-3">
              <PawPrint size={30} className="animate-pulse opacity-50" />
              <span>Đang tải hồ sơ pet...</span>
            </div>
          </div>
        ) : petQuery.isError || !pet ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-foreground-muted">
            <PawPrint size={30} className="opacity-50" />
            <p>Không tải được hồ sơ pet.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-5">
              <div className="flex flex-col gap-5">
                <div className="flex items-start gap-5">
                  <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-2xl bg-background-secondary text-5xl font-black uppercase text-foreground-muted shadow-inner">
                    {pet?.avatar ? (
                      <Image src={avatarUrl} alt={pet.name} className="h-full w-full rounded-2xl object-cover" width={400} height={400} unoptimized />
                    ) : (
                      <span className="opacity-50">{pet.name?.charAt(0)}</span>
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
                        <span className="text-[13px] text-foreground-muted">{pet.gender === 'MALE' ? '♂ Đực' : pet.gender === 'FEMALE' ? '♀ Cái' : 'Không rõ'}</span>
                        {ageLabel ? (
                          <>
                            <span className="mx-1 text-[13px] text-foreground-muted">•</span>
                            <span className="text-[13px] text-foreground-muted">{ageLabel}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {pet.customer?.id ? (
                        <Link href={`/customers/${pet.customer.id}`} onClick={onClose} className="block transition-transform hover:scale-[1.02]">
                          <PetStatCard
                            icon={User}
                            label="Chủ sở hữu"
                            value={
                              <span className="group-hover:text-primary-500 transition-colors">
                                {pet.customer.fullName || ownerName || 'Khách hàng'}
                              </span>
                            }
                            sub={pet.customer.phone || 'Chưa có số điện thoại'}
                            tone="blue"
                          />
                        </Link>
                      ) : (
                        <PetStatCard
                          icon={User}
                          label="Chủ sở hữu"
                          value={ownerName || 'Khách hàng'}
                          sub="Chưa có thông tin"
                          tone="blue"
                        />
                      )}
                      <PetStatCard
                        icon={Info}
                        label="Tuổi"
                        value={ageLabel || 'Chưa có ngày sinh'}
                        sub={pet.dateOfBirth ? `Sinh ngày ${fmtDate(pet.dateOfBirth)}` : 'Cập nhật ngày sinh để tính tuổi'}
                        tone="blue"
                      />
                      <PetStatCard
                        icon={Scale}
                        label="Cân nặng"
                        value={
                          isEditingWeight ? (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <input
                                autoFocus
                                type="number"
                                step="0.1"
                                disabled={isSavingWeight}
                                value={weightValue}
                                onChange={(e) => setWeightValue(e.target.value)}
                                className="w-[60px] min-w-0 rounded bg-background border border-border px-1.5 py-0.5 text-sm font-bold text-foreground"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateWeight()
                                  if (e.key === 'Escape') setIsEditingWeight(false)
                                }}
                                onBlur={handleUpdateWeight}
                              />
                              <span className="text-sm font-bold">kg</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 w-full">
                              <span className="truncate">{hasWeight ? `${pet.weight} kg` : 'Chưa cân lần nào'}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setWeightValue(hasWeight ? String(pet.weight) : '')
                                  setIsEditingWeight(true)
                                }}
                                className="shrink-0 flex items-center justify-center p-1 rounded hover:bg-background-tertiary text-foreground-muted transition-colors"
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                          )
                        }
                        sub={
                          weightLogs[0]?.date
                            ? `Cập nhật ${fmtDate(weightLogs[0].date)}`
                            : null
                        }
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
                        onClick={() => setVacModalOpen(true)}
                        tone="green"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-y border-border px-6 sticky top-0 bg-background-tertiary z-10">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${active
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

            <div className="px-6 py-5">
              {activeTab === 'suggestions' && !hideSuggestions ? (
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
                      <button
                        onClick={() => { setActiveTab('updates') }}
                        className="mt-4 inline-flex rounded-lg bg-warning/10 px-4 py-2 text-sm font-medium text-warning transition hover:bg-warning/20"
                      >
                        Cập nhật cân nặng ngay
                      </button>
                    </div>
                  ) : null}

                  {pricingSuggestionsQuery.isLoading ? (
                    <div className="rounded-xl border border-border bg-background-secondary px-6 py-8 text-center text-sm text-foreground-muted">
                      <Loader2 size={24} className="animate-spin mx-auto opacity-50 mb-2" />
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

                  {activeServicesQuery.data?.groomingSessions?.length > 0 && (
                    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                      <AlertTriangle size={16} className="shrink-0" />
                      <span className="font-medium mr-1">Đang có {activeServicesQuery.data.groomingSessions.length} phiên spa đang chờ xử lý:</span>
                      {activeServicesQuery.data.groomingSessions.map((s: any) => (
                        s.orderId ? (
                          <Link
                            key={s.id}
                            href={`/orders/${s.orderId}`}
                            onClick={onClose}
                            className="font-mono text-[11px] bg-warning/20 hover:bg-warning/30 px-2 py-0.5 rounded transition-colors"
                          >
                            {s.sessionCode}
                          </Link>
                        ) : (
                          <span
                            key={s.id}
                            className="font-mono text-[11px] bg-warning/20 px-2 py-0.5 rounded"
                          >
                            {s.sessionCode}
                          </span>
                        )
                      ))}
                    </div>
                  )}

                  <div className="grid gap-3 xl:grid-cols-2">
                    {suggestedServices.map((service: any) => (
                      <div
                        key={service.id}
                        onClick={() => !isInCart(service) && onSelectService?.(service, pet.id, pet.name)}
                        className={`group relative flex ${!isInCart(service) && onSelectService ? 'cursor-pointer hover:bg-background' : ''} ${isInCart(service) ? 'ring-2 ring-[#0089A1] bg-[#0089A1]/10' : 'bg-background-secondary'} flex-col justify-between rounded-xl p-4 transition-colors`}
                      >
                        {isInCart(service) && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-[#0089A1] rounded-full flex items-center justify-center shadow-sm">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-h-[50px] flex-col justify-between">
                            <span
                              className={`inline-flex w-fit rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${service.suggestionKind === 'HOTEL'
                                ? 'bg-primary-500/10 text-primary-500'
                                : service.suggestionKind === 'SPA'
                                  ? 'bg-pink-500/10 text-pink-500'
                                  : 'bg-warning/10 text-warning'
                                }`}
                            >
                              {service.suggestionKind}
                            </span>

                            <div className="mt-4 flex flex-wrap items-center gap-1.5">
                              <h3 className={`truncate text-[15px] font-bold text-foreground transition-colors ${onSelectService ? 'group-hover:text-primary-500' : ''}`}>
                                {service.name}
                              </h3>
                              {service.weightBandLabel ? (
                                <span className="text-[12px] font-normal text-foreground-muted">
                                  · {service.weightBandLabel}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-foreground-muted/10 text-foreground-muted">
                                  Giá cố định
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className={`text-[17px] font-bold text-foreground transition-colors ${onSelectService ? 'group-hover:text-primary-500' : ''}`}>
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
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-background-secondary p-3 rounded-xl border border-border">
                    <div>
                      <h3 className="font-semibold text-sm">Lịch sử tiêm phòng & tẩy giun</h3>
                      <p className="text-xs text-foreground-muted mt-0.5">Quản lý các mũi tiêm của thú cưng</p>
                    </div>
                    <button
                      onClick={() => setVacModalOpen(true)}
                      className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary-500/20"
                    >
                      <Plus size={14} /> Thêm mũi tiêm
                    </button>
                  </div>

                  {pet.vaccinations?.length ? (
                    <div className="grid gap-3">
                      {pet.vaccinations.map((vaccine: any, index: number) => (
                        <div
                          key={vaccine.id}
                          className="flex items-start gap-4 rounded-xl border border-border bg-background-secondary p-4 transition-colors hover:border-primary-500/50"
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
                            <p className="mt-1 text-sm text-foreground-muted flex gap-3">
                              <span><span className="opacity-70">Tiêm:</span> {fmtDate(vaccine.date)}</span>
                              {vaccine.nextDueDate ? <span><span className="opacity-70">Hẹn nhắc lại:</span> <span className="text-primary-500 font-medium">{fmtDate(vaccine.nextDueDate)}</span></span> : null}
                            </p>
                            {vaccine.notes ? (
                              <p className="mt-2 text-sm text-foreground-muted/80 bg-background/50 p-2 rounded-lg border border-border/50">{vaccine.notes}</p>
                            ) : null}
                            {vaccine.photoUrl ? (
                              <div className="mt-3">
                                <a href={vaccine.photoUrl} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition-opacity">
                                  <Image src={vaccine.photoUrl} className="h-24 w-36 object-cover rounded-lg border border-border/60 shadow-sm" alt="Ảnh tiêm phòng" width={400} height={400} unoptimized />
                                </a>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-foreground-muted rounded-xl border border-dashed border-border bg-background-secondary/50">
                      <Syringe size={28} className="opacity-40" />
                      <p>Chưa có lịch sử tiêm phòng.</p>
                      <button onClick={() => setVacModalOpen(true)} className="text-primary-500 font-medium hover:underline text-sm">Thêm mũi tiêm đầu tiên</button>
                    </div>
                  )}
                </div>
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
                          className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${entry.type === 'HOTEL'
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
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-foreground-muted rounded-xl border border-dashed border-border bg-background-secondary/50">
                    <Clock3 size={28} className="opacity-40" />
                    <p>Pet này chưa có lịch sử dịch vụ.</p>
                  </div>
                )
              ) : null}

              {activeTab === 'updates' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-background-secondary p-4 flex flex-col justify-center">
                      <p className="text-xs uppercase tracking-wider text-foreground-muted font-bold">Ngày tạo hồ sơ</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{fmtDate(pet.createdAt)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background-secondary p-4 flex flex-col justify-center">
                      <p className="text-xs uppercase tracking-wider text-foreground-muted font-bold">Cập nhật gần nhất</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{fmtDate(pet.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-6 mb-2">
                    <h3 className="font-semibold text-sm">Lịch sử thay đổi</h3>
                    {!isAddingUpdate && (
                      <button
                        onClick={() => {
                          setUpdateWeightValue(pet?.weight ? String(pet.weight) : '');
                          setUpdateNote('');
                          setIsAddingUpdate(true);
                        }}
                        className="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-md hover:bg-primary-100 transition-colors flex items-center gap-1"
                      >
                        <Plus size={12} /> Thêm ghi chú
                      </button>
                    )}
                  </div>

                  {isAddingUpdate && (
                    <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex gap-2 mb-3">
                        <div className="w-24 shrink-0">
                          <label className="text-[10px] font-bold uppercase text-foreground-muted mb-1 block">Cân nặng (kg)</label>
                          <input
                            type="number"
                            value={updateWeightValue}
                            onChange={(e) => setUpdateWeightValue(e.target.value)}
                            className="w-full bg-white border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary-500 transition-colors"
                            placeholder="0.0"
                            step="0.1"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-bold uppercase text-foreground-muted mb-1 block">Nội dung thay đổi</label>
                          <input
                            type="text"
                            value={updateNote}
                            onChange={(e) => setUpdateNote(e.target.value)}
                            className="w-full bg-white border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary-500 transition-colors"
                            placeholder="Cạo lông, tắm, v.v..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddUpdate();
                            }}
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setIsAddingUpdate(false)}
                          className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-background-secondary rounded-lg transition-colors"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={handleAddUpdate}
                          disabled={isSavingWeight}
                          className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isSavingWeight ? 'Đang lưu...' : 'Lưu cập nhật'}
                        </button>
                      </div>
                    </div>
                  )}

                  {weightLogs.length > 0 ? (
                    <div className="space-y-3">
                      {weightLogs.map((log: any) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between rounded-xl border border-border bg-background-secondary p-4"
                        >
                          <div>
                            <p className="text-base font-semibold text-foreground flex items-center gap-2">
                              <Scale size={16} className="text-amber-500" />
                              {log.weight} kg
                            </p>
                            {log.notes ? (
                              <p className="mt-1 text-sm text-foreground-muted/70">{log.notes}</p>
                            ) : null}
                          </div>
                          <p className="text-sm text-foreground-muted">{fmtDate(log.date)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-foreground-muted p-4 rounded-xl border border-dashed border-border text-center">Chưa có lịch sử cân nặng</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {editModalOpen && (
        <PetFormModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          customerId={pet?.customerId || pet?.customer?.id}
          customerName={ownerName || pet?.customer?.fullName || 'Khách hàng'}
          customerPhone={pet?.customer?.phone}
          initialData={pet}
          onSaved={() => {
            petQuery.refetch();
            setEditModalOpen(false);
          }}
        />
      )}

      {vacModalOpen && (
        <QuickVaccinationModal
          isOpen={vacModalOpen}
          petId={pet.id}
          onClose={() => setVacModalOpen(false)}
          onSaved={() => petQuery.refetch()}
        />
      )}
    </div>
  );
}
