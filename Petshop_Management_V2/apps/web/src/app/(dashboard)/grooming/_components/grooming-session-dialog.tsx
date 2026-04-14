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
} from "lucide-react";
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
import { CancelNotesModal } from "./cancel-notes-modal";



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
        staffId: data.staffId || undefined,
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
        name: pet.name,
        label: pet.breed || pet.species || "Không rõ giống",
        code: pet.petCode || pet.id,
        customerName: pet.customer?.fullName || "Khách lẻ",
        customerPhone: pet.customer?.phone || "—",
      };
    }
    return { name: "Chọn thú cưng", label: "", code: "", customerName: "", customerPhone: "" };
  };

  const petInfo = getPetInfo();
  const sessionLabel = isEditing ? (session.sessionCode || session.id.slice(-8).toUpperCase()) : "Tạo mới";

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      >
        <aside
          className="flex h-full w-full max-w-[500px] flex-col border-l border-border bg-background-base shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
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

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background-secondary text-foreground-muted transition-colors hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>

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
                  <div className="rounded-2xl border border-border bg-card/80 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                      <UserRound size={14} />
                      Khách hàng
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {petInfo.customerName}
                    </p>
                    <p className="mt-1 text-sm text-foreground-muted">
                      {petInfo.customerPhone}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-card/80 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                      <Tag size={14} />
                      Mã thú cưng
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {petInfo.code}
                    </p>
                    {isEditing && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-foreground-muted">
                          Tạo lúc: {formatGroomingDateTime(session.createdAt)}
                        </p>
                        {session.branch && (
                          <p className="text-xs text-foreground-muted">
                            Chi nhánh: <span className="font-medium text-foreground">{session.branch.name}</span>
                          </p>
                        )}
                        {session.staff && (
                          <p className="text-xs text-foreground-muted">
                            Người tạo: <span className="font-medium text-foreground">{session.staff.fullName}</span>
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

                  <div className="grid gap-4">
                    {isEditing && (
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                          Trạng thái
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {GROOMING_STATUS_ORDER.map((status) => {
                            const meta = GROOMING_STATUS_META[status];
                            const Icon = meta.icon;
                            const isSelected = watchStatus === status;

                            return (
                              <button
                                key={status}
                                type="button"
                                onClick={() => {
                                  if (!canUpdateSession) return;
                                  if (status === "CANCELLED") {
                                    setShowCancelModal(true);
                                  } else {
                                    setValue("status", status, { shouldDirty: true });
                                  }
                                }}
                                disabled={!canUpdateSession}
                                className={`inline-flex items-center justify-start gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                                  isSelected
                                    ? `${meta.chipClassName} shadow-sm`
                                    : "border-border bg-background-secondary text-foreground-muted hover:text-foreground"
                                } disabled:cursor-not-allowed disabled:opacity-50`}
                              >
                                <Icon size={14} className="shrink-0" />
                                <span className="truncate">{meta.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </label>
                    )}

                    <label className="space-y-2">
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

                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                        Nhân viên phụ trách
                      </span>
                      <select
                        {...register("staffId")}
                        disabled={!canUpdateSession}
                        className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                      >
                        <option value="">Chưa phân công</option>
                        {staffOptions.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.fullName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                          Bắt đầu
                        </span>
                        <input
                          type="datetime-local"
                          {...register("startTime")}
                          disabled={!canUpdateSession}
                          className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                        />
                      </label>

                      {isEditing && (
                        <label className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                            Kết thúc
                          </span>
                          <input
                            type="datetime-local"
                            {...register("endTime")}
                            disabled={!canUpdateSession}
                            className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                          />
                        </label>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                            <Tag size={14} /> Giá dịch vụ
                          </span>
                          {mode === "create" && watchPackageCode && (
                            <button
                              type="button"
                              disabled={calculateMutation.isPending}
                              onClick={() => calculateMutation.mutate()}
                              className="text-primary-500 hover:text-primary-600 outline-none"
                              title="Tính lại giá"
                            >
                              <RefreshCw size={14} className={calculateMutation.isPending ? "animate-spin" : ""} />
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          {...register("price")}
                          disabled={!canUpdateSession}
                          placeholder="0"
                          className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                        />
                        {errors.price && <p className="text-xs text-error">{errors.price.message}</p>}
                      </label>

                      <label className="space-y-2">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                          <Coins size={14} /> Phụ phí
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          {...register("surcharge")}
                          disabled={!canUpdateSession}
                          placeholder="Ví dụ: Phí hung dữ, phí gỡ rối..."
                          className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                        />
                        {errors.surcharge && <p className="text-xs text-error">{errors.surcharge.message}</p>}
                      </label>
                    </div>

                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                        Ghi chú
                      </span>
                      <textarea
                        rows={3}
                        {...register("notes")}
                        disabled={!canUpdateSession}
                        placeholder="Lưu ý về thú cưng, yêu cầu khách, ghi chú nội bộ..."
                        className="w-full rounded-2xl border border-border bg-background-secondary px-3 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
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
                  className="inline-flex h-11 min-w-[100px] items-center justify-center rounded-xl bg-background-secondary text-sm font-medium text-foreground transition-colors hover:bg-background-tertiary"
                >
                  Đóng
                </button>
                {canUpdateSession && (
                  <button
                    type="submit"
                    form="grooming-form"
                    disabled={saveMutation.isPending}
                    className="inline-flex h-11 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-primary-500 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-500/50"
                  >
                    <Save size={16} />
                    {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
                  </button>
                )}
              </div>
            </div>
          </footer>
        </aside>
      </div>

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
