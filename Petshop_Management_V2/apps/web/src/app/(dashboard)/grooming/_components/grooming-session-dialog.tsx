"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  PawPrint,
  Save,
  Tag,
  Trash2,
  UserRound,
  X,
  RefreshCw,
  Coins,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import * as Tabs from "@radix-ui/react-tabs";
import { customToast as toast } from "@/components/ui/toast-with-copy";
import {
  groomingApi,
  type GroomingSession,
  type GroomingStatus,
} from "@/lib/api/grooming.api";
import { petApi } from "@/lib/api/pet.api";
import { staffApi, type Staff } from "@/lib/api/staff.api";
import { pricingApi } from "@/lib/api/pricing.api";
import { useAuthorization } from "@/hooks/useAuthorization";
import { useAuthStore } from "@/stores/auth.store";
import {
  formatGroomingDateTime,
  formatGroomingMoney,
  GroomingStatusBadge,
  GROOMING_STATUS_META,
  GROOMING_STATUS_ORDER,
  toDateTimeLocalValue,
} from "./grooming-status";
import { formatDateTime } from "@/lib/utils";
import { CancelNotesModal } from "./cancel-notes-modal";

function buildHistorySummary(entry: any) {
  const actorName =
    entry.performedByUser?.fullName ?? entry.performedByUser?.staffCode ?? 'Chưa xác định';
  const statusLabel =
    entry.fromStatus || entry.toStatus
      ? [
        entry.fromStatus ? entry.fromStatus : null,
        entry.toStatus ? `→ ${entry.toStatus}` : null,
      ]
        .filter(Boolean)
        .join(' ')
      : null;

  return [actorName, statusLabel, entry.note].filter(Boolean).join(' • ');
}

function HistorySection({ timeline }: { timeline: any[] }) {
  return (
    <div className="py-2">
      <div className="rounded-2xl border border-border/60 bg-background-secondary/30 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
            Lịch sử thao tác
          </div>
        </div>

        {timeline && timeline.length > 0 ? (
          <div className="mt-4 space-y-4">
            {timeline.map((entry: any, index: number) => (
              <div key={entry.id} className="grid grid-cols-[16px_1fr] gap-4">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary-500 ring-4 ring-primary-500/10" />
                  {index < timeline.length - 1 ? <span className="mt-2 h-full w-px bg-border/60" /> : null}
                </div>
                <div className="rounded-xl border border-border/40 bg-background-base px-3.5 py-3 transition-colors duration-150 hover:bg-primary-500/4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-semibold text-primary-400">
                      {entry.action}
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-[11px] text-foreground-muted">
                      {formatDateTime(entry.createdAt)}
                    </div>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-foreground-muted">
                    {buildHistorySummary(entry) || 'Không có thêm thông tin'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-foreground-muted">
            Chưa có lịch sử thao tác cho dịch vụ này.
          </div>
        )}
      </div>
    </div>
  );
}



const groomingSchema = z.object({
  petId: z.string().min(1, "Vui lòng chọn thú cưng"),
  branchId: z.string().optional(),
  staffId: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  notes: z.string().optional(),
  packageCode: z.string().optional(),
  price: z.preprocess(
    (value) =>
      value === "" || value == null || Number.isNaN(value) ? undefined : value,
    z.number().nonnegative("Giá không hợp lệ").optional(),
  ),
  surcharge: z.preprocess(
    (value) =>
      value === "" || value == null || Number.isNaN(value) ? undefined : value,
    z.number().nonnegative("Phụ phí không hợp lệ").optional(),
  ),
  status: z.enum(["BOOKED", "PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).optional(),
});

type FormData = z.infer<typeof groomingSchema>;

interface GroomingSessionDialogProps {
  isOpen: boolean;
  mode: "create" | "detail";
  session: GroomingSession | null;
  onClose: () => void;
}

export function GroomingSessionDialog({
  isOpen,
  mode,
  session,
  onClose,
}: GroomingSessionDialogProps) {
  const isEditing = mode === "detail" && Boolean(session);
  const queryClient = useQueryClient();
  const { hasPermission, hasAnyPermission } = useAuthorization();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [searchStaff, setSearchStaff] = useState("");
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  const petsQuery = useQuery({
    queryKey: ["pets", "grooming-modal"],
    queryFn: () => petApi.getPets({ limit: 500 }),
    enabled: isOpen && mode === "create",
  });

  const staffQuery = useQuery({
    queryKey: ["staff", "grooming-modal"],
    queryFn: staffApi.getAll,
    enabled: isOpen,
  });

  // Derive species from selected pet (create mode) or existing session (detail mode)
  const selectedPetSpecies =
    mode === "create"
      ? petsQuery.data?.data?.find((p: any) => p.id === watchPetId)?.species ?? undefined
      : session?.pet?.species ?? undefined;

  const packagesQuery = useQuery({
    queryKey: ["grooming-packages", selectedPetSpecies ?? "all"],
    queryFn: () => groomingApi.getPackages(selectedPetSpecies),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const availablePackages = packagesQuery.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(groomingSchema),
    defaultValues: {
      petId: "",
      branchId: activeBranchId ?? "",
      staffId: "",
      startTime: toDateTimeLocalValue(new Date().toISOString()),
      endTime: "",
      notes: "",
      price: undefined,
      surcharge: undefined,
      packageCode: "",
      status: "PENDING",
    },
  });

  const watchPetId = watch("petId");
  const watchPackageCode = watch("packageCode");
  const watchStatus = watch("status");
  const watchPrice = watch("price");
  const watchSurcharge = watch("surcharge");

  useEffect(() => {
    if (isOpen) {
      if (mode === "detail" && session) {
        reset({
          petId: session.petId,
          branchId: session.branchId ?? activeBranchId ?? "",
          staffId: session.staffId ?? "",
          startTime: toDateTimeLocalValue(session.startTime),
          endTime: toDateTimeLocalValue(session.endTime),
          notes: session.notes ?? "",
          price: session.price ?? undefined,
          surcharge: session.surcharge ?? undefined,
          packageCode: session.packageCode ?? "",
          status: session.status,
        });
        setSelectedStaffIds(session.staffId ? [session.staffId] : []);
      } else if (mode === "create") {
        reset({
          petId: "",
          branchId: activeBranchId ?? "",
          staffId: "",
          startTime: toDateTimeLocalValue(new Date().toISOString()),
          endTime: "",
          notes: "",
          price: undefined,
          surcharge: undefined,
          packageCode: "",
          status: "PENDING",
        });
        setSelectedStaffIds([]);
      }
    }
  }, [isOpen, mode, session, reset, activeBranchId]);

  const calculateMutation = useMutation({
    mutationFn: async () => {
      if (!watchPetId || !watchPackageCode) return null;
      return groomingApi.calculatePrice({
        petId: watchPetId,
        packageCode: watchPackageCode,
      });
    },
    onSuccess: (data) => {
      if (data?.price !== undefined) {
        setValue("price", data.price, { shouldValidate: true });
        toast.success("Đã tính giá tự động thành công (tuyến " + data.weightBand.label + ")");
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Không thể tính giá tự động");
    },
  });

  useEffect(() => {
    if (mode === "create" && watchPetId && watchPackageCode) {
      calculateMutation.mutate();
    }
  }, [watchPetId, watchPackageCode, mode]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        petId: data.petId,
        branchId: data.branchId || undefined,
        staffId: selectedStaffIds.length > 0 ? selectedStaffIds[0] : undefined,
        startTime: data.startTime || undefined,
        endTime: data.endTime || undefined,
        notes: data.notes?.trim() || undefined,
        packageCode: data.packageCode || undefined,
        price: typeof data.price === "number" && !Number.isNaN(data.price) ? data.price : undefined,
        surcharge: typeof data.surcharge === "number" && !Number.isNaN(data.surcharge) ? data.surcharge : 0,
      };

      if (mode === "create" || !session) {
        return groomingApi.createSession(payload);
      }

      return groomingApi.updateSession({
        id: session.id,
        ...payload,
        status: data.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grooming-sessions"] });
      toast.success(isEditing ? "Đã cập nhật phiên grooming" : "Đã tạo phiên grooming");
      onClose();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Không thể lưu phiên grooming");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!session) return null;
      return groomingApi.deleteSession(session.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grooming-sessions"] });
      toast.success("Đã xóa phiên grooming");
      onClose();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Không thể xóa phiên grooming");
    },
  });

  if (!isOpen) return null;

  const pets = petsQuery.data?.data ?? [];
  const staffOptions = (staffQuery.data ?? []).filter(
    (staff) => !["RESIGNED", "QUIT"].includes(staff.status),
  );

  const canUpdateSession = mode === "create" || hasAnyPermission([
    "grooming.update",
    "grooming.start",
    "grooming.complete",
    "grooming.cancel",
  ]);
  const canDeleteSession = isEditing && hasPermission("grooming.cancel") && !session?.orderId;
  const canReadOrders = hasAnyPermission(["order.read.all", "order.read.assigned"]);

  const getPetInfo = () => {
    if (mode === "detail" && session) {
      return {
        petId: session.petId,
        customerId: session.pet?.customerId,
        name: session.petName,
        label: session.pet?.breed || session.pet?.species || "Không rõ giống",
        code: session.pet?.petCode || session.petId,
        customerName: session.pet?.customer?.fullName || "Khách lẻ",
        customerPhone: session.pet?.customer?.phone || "—",
      };
    }
    const pet = pets.find((p) => p.id === watchPetId);
    if (pet) {
      return {
        petId: pet.id,
        customerId: pet.customerId,
        name: pet.name,
        label: pet.breed || pet.species || "Không rõ giống",
        code: pet.petCode || pet.id,
        customerName: pet.customer?.fullName || "Khách lẻ",
        customerPhone: pet.customer?.phone || "—",
      };
    }
    return { petId: "", customerId: "", name: "Chọn thú cưng", label: "", code: "", customerName: "", customerPhone: "" };
  };

  const petInfo = getPetInfo();
  const sessionLabel = isEditing ? (session!.sessionCode || session!.id.slice(-8).toUpperCase()) : "Tạo mới";

  return (
    <>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-backdrop/60 p-4 backdrop-blur-sm sm:p-0">
        <aside
          className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-background-base shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <Tabs.Root defaultValue="info" className="flex h-full flex-col">
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <GroomingStatusBadge status={watchStatus || "PENDING"} />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-500/20 bg-primary-500/10 px-2.5 py-1 text-xs font-semibold text-primary-500">
                      <PawPrint size={12} /> Tạo mới
                    </span>
                  )}
                  <span className="rounded-full border border-border bg-background-secondary px-2 py-1 font-mono text-[11px] text-foreground-muted">
                    {sessionLabel}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {petInfo.name}
                  </h2>
                  {petInfo.label && (
                    <p className="text-sm text-foreground-muted">{petInfo.label}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-4">
                {session && (
                  <Tabs.List className="flex items-center gap-1 rounded-xl bg-background-secondary/50 p-1">
                    <Tabs.Trigger
                      value="info"
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground-muted transition-all duration-150 hover:text-foreground data-[state=active]:bg-background-base data-[state=active]:text-primary-600 data-[state=active]:shadow-sm outline-none"
                    >
                      Thông tin
                    </Tabs.Trigger>
                    <Tabs.Trigger
                      value="history"
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground-muted transition-all duration-150 hover:text-foreground data-[state=active]:bg-background-base data-[state=active]:text-primary-600 data-[state=active]:shadow-sm outline-none"
                    >
                      Lịch sử
                    </Tabs.Trigger>
                  </Tabs.List>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background-secondary text-foreground-muted transition-all duration-150 hover:bg-background-tertiary hover:text-foreground active:scale-95"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <Tabs.Content value="info" className="flex-1 overflow-y-auto outline-none flex flex-col">
              <form
                id="grooming-form"
                onSubmit={handleSubmit((data) => saveMutation.mutate(data))}
                className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-6 py-5"
              >
                {mode === "create" && (
                  <label className="space-y-2 block">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                      <PawPrint size={14} />
                      Chọn thú cưng
                    </span>
                    <select
                      {...register("petId")}
                      className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                    >
                      <option value="">-- Chọn thú cưng --</option>
                      {pets.map((pet) => (
                        <option key={pet.id} value={pet.id}>
                          {pet.name} · {pet.customer?.fullName || "Khách lẻ"}
                        </option>
                      ))}
                    </select>
                    {errors.petId && (
                      <p className="text-xs font-medium text-error">{errors.petId.message}</p>
                    )}
                  </label>
                )}

                {(mode === "detail" || watchPetId) && (
                  <>
                    <section className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-card/80 p-4 relative group">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                          <span className="flex items-center gap-2"><UserRound size={14} /> Khách hàng</span>
                          {petInfo.customerId && (
                            <Link href={`/customers/${petInfo.customerId}`} target="_blank" className="hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              Chi tiết
                            </Link>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {petInfo.customerName}
                        </p>
                        <p className="mt-1 text-sm text-foreground-muted">
                          {petInfo.customerPhone}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-border bg-card/80 p-4 relative group">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                          <span className="flex items-center gap-2"><Tag size={14} /> Mã thú cưng</span>
                          {petInfo.petId && (
                            <Link href={`/pets/${petInfo.petId}`} target="_blank" className="hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              Chi tiết
                            </Link>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {petInfo.code}
                        </p>
                        {isEditing && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-foreground-muted">
                              Tạo lúc: {formatGroomingDateTime(session!.createdAt)}
                            </p>
                            {session!.branch && (
                              <p className="text-xs text-foreground-muted">
                                Chi nhánh: <span className="font-medium text-foreground">{session!.branch.name}</span>
                              </p>
                            )}
                            {session!.staff && (
                              <p className="text-xs text-foreground-muted">
                                Người tạo: <span className="font-medium text-foreground">{session!.staff.fullName}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="space-y-4 rounded-2xl border border-border bg-card/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Thông tin dịch vụ
                          </p>
                          <p className="text-xs text-foreground-muted">
                            Thiết lập dịch vụ và người phụ trách
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {isEditing && (
                          <label className="space-y-2 col-span-1">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                              Trạng thái
                            </span>
                            <div className="relative">
                              <select
                                value={watchStatus}
                                onChange={(e) => {
                                  const status = e.target.value as any;
                                  if (!canUpdateSession) return;
                                  if (status === "CANCELLED") {
                                    setShowCancelModal(true);
                                  } else {
                                    setValue("status", status, { shouldDirty: true });
                                  }
                                }}
                                disabled={!canUpdateSession}
                                className="h-11 w-full appearance-none rounded-xl border border-border bg-background-secondary px-3 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {GROOMING_STATUS_ORDER.map((s) => (
                                  <option key={s} value={s}>{GROOMING_STATUS_META[s].label}</option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-foreground-muted">
                                <ChevronDown size={14} />
                              </div>
                            </div>
                          </label>
                        )}

                        <label className="space-y-2 col-span-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                            Mã gói / Package
                          </span>
                          <select
                            {...register("packageCode")}
                            disabled={!canUpdateSession}
                            className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                          >
                            <option value="">-- Không chọn (Tự nhập giá) --</option>
                            {availablePackages.map((pkg: { code: string; label: string }) => (
                              <option key={pkg.code} value={pkg.code}>
                                {pkg.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="space-y-2 sm:col-span-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                            Nhân viên phụ trách (Có thể thêm nhiều)
                          </span>
                          <div className="relative">
                            <div className="flex flex-wrap gap-2 mb-2">
                              {selectedStaffIds.map((id) => {
                                const st = staffOptions.find(s => s.id === id);
                                return st ? (
                                  <div key={id} className="flex items-center gap-1.5 rounded-full bg-primary-100 text-primary-700 px-3 py-1 text-xs font-medium dark:bg-primary-900/30 dark:text-primary-400">
                                    <span>{st.fullName}</span>
                                    {canUpdateSession && (
                                      <button type="button" onClick={() => setSelectedStaffIds(prev => prev.filter(p => p !== id))} className="mt-0.5 hover:text-primary-900 dark:hover:text-primary-200 focus:outline-none">
                                        <X size={12} />
                                      </button>
                                    )}
                                  </div>
                                ) : null;
                              })}
                            </div>
                            <input
                              type="text"
                              disabled={!canUpdateSession}
                              placeholder="Tìm nhân viên..."
                              value={searchStaff}
                              onFocus={() => setShowStaffDropdown(true)}
                              onBlur={() => setTimeout(() => setShowStaffDropdown(false), 200)}
                              onChange={(e) => setSearchStaff(e.target.value)}
                              className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                            />
                            {showStaffDropdown && (
                              <div className="absolute left-0 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-border bg-background-base p-1 text-sm shadow-xl z-10 custom-scrollbar">
                                {staffOptions
                                  .filter(s => s.fullName.toLowerCase().includes(searchStaff.toLowerCase()) && !selectedStaffIds.includes(s.id))
                                  .map((staff) => (
                                    <div
                                      key={staff.id}
                                      onClick={() => {
                                        setSelectedStaffIds([...selectedStaffIds, staff.id]);
                                        setSearchStaff("");
                                      }}
                                      className="cursor-pointer rounded-lg px-3 py-2 hover:bg-background-secondary text-foreground transition-colors"
                                    >
                                      {staff.fullName}
                                    </div>
                                  ))}
                                {staffOptions.filter(s => s.fullName.toLowerCase().includes(searchStaff.toLowerCase()) && !selectedStaffIds.includes(s.id)).length === 0 && (
                                  <div className="px-3 py-2 text-foreground-muted text-center text-xs">Không có kết quả</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <label className="space-y-2 col-span-1">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                              <Tag size={14} /> Giá dịch vụ
                            </span>
                            {mode === "create" && watchPackageCode && (
                              <button
                                type="button"
                                disabled={calculateMutation.isPending}
                                onClick={() => calculateMutation.mutate()}
                                className="text-primary-500 hover:text-primary-600 outline-none transition-colors"
                                title="Tính lại giá"
                              >
                                <RefreshCw size={14} className={calculateMutation.isPending ? "animate-spin" : ""} />
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={watchPrice !== undefined ? new Intl.NumberFormat("vi-VN").format(watchPrice) : ""}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              setValue("price", raw ? Number(raw) : undefined, { shouldDirty: true });
                            }}
                            disabled={!canUpdateSession}
                            placeholder="0"
                            className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                          />
                          {errors.price && <p className="text-xs text-error">{errors.price.message}</p>}
                        </label>

                        <label className="space-y-2 col-span-1">
                          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                            <Coins size={14} /> Phụ phí
                          </span>
                          <input
                            type="text"
                            value={watchSurcharge !== undefined && watchSurcharge !== 0 ? new Intl.NumberFormat("vi-VN").format(watchSurcharge) : ""}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              setValue("surcharge", raw ? Number(raw) : undefined, { shouldDirty: true });
                            }}
                            disabled={!canUpdateSession}
                            placeholder="0"
                            className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                          />
                          {errors.surcharge && <p className="text-xs text-error">{errors.surcharge.message}</p>}
                        </label>

                        <label className="space-y-2 sm:col-span-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                            Ghi chú
                          </span>
                          <input
                            type="text"
                            {...register("notes")}
                            disabled={!canUpdateSession}
                            placeholder="Lưu ý về thú cưng, yêu cầu khách, ghi chú nội bộ..."
                            className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                          />
                        </label>
                      </div>
                    </section>
                  </>
                )}
              </form>

              <footer className="border-t border-border bg-background-base px-6 py-4">
                <div className="flex items-center justify-between">
                  {canDeleteSession ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Bạn có chắc muốn xóa phiên này?")) {
                          deleteMutation.mutate();
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-error transition-colors hover:bg-error/10 px-4"
                    >
                      <Trash2 size={16} />
                      Xóa
                    </button>
                  ) : (
                    <div />
                  )}
                  <div className="flex gap-3 [&>*]:flex-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex h-11 min-w-[100px] items-center justify-center rounded-xl bg-background-secondary text-sm font-medium text-foreground transition-all duration-150 hover:scale-[1.02] hover:bg-background-tertiary active:scale-[0.98]"
                    >
                      Đóng
                    </button>
                    {canUpdateSession && (
                      <button
                        type="submit"
                        form="grooming-form"
                        disabled={saveMutation.isPending}
                        className="inline-flex h-11 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-primary-500 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:scale-[1.02] hover:bg-primary-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                      >
                        <Save size={16} className={saveMutation.isPending ? "animate-pulse" : ""} />
                        {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
                      </button>
                    )}
                  </div>
                </div>
              </footer>
            </Tabs.Content >
            {
              session ? (
                <Tabs.Content value="history" className="flex-1 overflow-y-auto outline-none" >
                  <HistorySection timeline={(session as any).timeline || []} />
                </Tabs.Content >
              ) : null}
          </Tabs.Root >
        </aside >
      </div >

      <CancelNotesModal
        isOpen={showCancelModal}
        title="Lý do hủy"
        placeholder="VD: Khách báo bận, Không liên lạc được..."
        onClose={() => setShowCancelModal(false)}
        onConfirm={(notes) => {
          setValue("status", "CANCELLED", { shouldDirty: true });
          const existingNotes = watch("notes") || "";
          const newNotes = [existingNotes, `Lý do hủy: ${notes}`]
            .filter(Boolean)
            .join("\n\n");
          setValue("notes", newNotes, { shouldDirty: true });
          setShowCancelModal(false);
        }}
      />
    </>
  );
}
