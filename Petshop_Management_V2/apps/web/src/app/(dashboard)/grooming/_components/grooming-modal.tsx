"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, PawPrint, Save, UserRound, X } from "lucide-react";
import { customToast as toast } from "@/components/ui/toast-with-copy";
import { groomingApi, type GroomingSession } from "@/lib/api/grooming.api";
import { petApi } from "@/lib/api/pet.api";
import { staffApi } from "@/lib/api/staff.api";
import {
  GROOMING_STATUS_META,
  GROOMING_STATUS_ORDER,
  toDateTimeLocalValue,
} from "./grooming-status";

const groomingSchema = z.object({
  petId: z.string().min(1, "Vui lòng chọn thú cưng"),
  staffId: z.string().optional(),
  startTime: z.string().optional(),
  notes: z.string().optional(),
  price: z.preprocess(
    (value) =>
      value === "" || value == null || Number.isNaN(value) ? undefined : value,
    z.number().nonnegative("Giá không hợp lệ").optional(),
  ),
});

type FormData = z.infer<typeof groomingSchema>;

interface GroomingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: GroomingSession | null;
}

export function GroomingModal({
  isOpen,
  onClose,
  initialData = null,
}: GroomingModalProps) {
  const isEditing = Boolean(initialData);
  const queryClient = useQueryClient();

  const petsQuery = useQuery({
    queryKey: ["pets", "grooming-modal"],
    queryFn: () => petApi.getPets({ limit: 500 }),
    enabled: isOpen,
  });

  const staffQuery = useQuery({
    queryKey: ["staff", "grooming-modal"],
    queryFn: staffApi.getAll,
    enabled: isOpen,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(groomingSchema),
    defaultValues: {
      petId: initialData?.petId ?? "",
      staffId: initialData?.staffId ?? "",
      startTime: toDateTimeLocalValue(initialData?.startTime),
      notes: initialData?.notes ?? "",
      price: initialData?.price ?? undefined,
    },
  });

  useEffect(() => {
    reset({
      petId: initialData?.petId ?? "",
      staffId: initialData?.staffId ?? "",
      startTime: toDateTimeLocalValue(initialData?.startTime),
      notes: initialData?.notes ?? "",
      price: initialData?.price ?? undefined,
    });
  }, [initialData, reset]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        petId: data.petId,
        staffId: data.staffId || undefined,
        startTime: data.startTime || undefined,
        notes: data.notes?.trim() || undefined,
      };

      if (!initialData) {
        return groomingApi.createSession(payload);
      }

      return groomingApi.updateSession({
        id: initialData.id,
        ...payload,
        price:
          typeof data.price === "number" && !Number.isNaN(data.price)
            ? data.price
            : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grooming-sessions"] });
      toast.success(
        isEditing ? "Đã cập nhật phiên grooming" : "Đã tạo phiên grooming",
      );
      onClose();
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || "Không thể lưu phiên grooming",
      );
    },
  });

  if (!isOpen) return null;

  const pets = petsQuery.data?.data ?? [];
  const staffOptions = (staffQuery.data ?? []).filter(
    (staff) => !["RESIGNED", "QUIT"].includes(staff.status),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-border bg-background-base shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
              {isEditing ? "Chỉnh sửa phiên" : "Tạo phiên mới"}
            </span>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {isEditing ? "Cập nhật phiên grooming" : "Lên lịch grooming"}
              </h2>
              <p className="text-sm text-foreground-muted">
                Dùng giao diện hiện tại nhưng giữ luồng thao tác gần với module
                cũ.
              </p>
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
          onSubmit={handleSubmit((data) => saveMutation.mutate(data))}
          className="grid gap-5 px-6 py-6"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                <PawPrint size={14} />
                Thú cưng
              </span>
              <select
                {...register("petId")}
                disabled={isEditing}
                className="h-12 w-full rounded-2xl border border-border bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="">Chọn thú cưng</option>
                {pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name} · {pet.customer?.fullName || "Khách lẻ"}
                  </option>
                ))}
              </select>
              {errors.petId ? (
                <p className="text-xs font-medium text-error">
                  {errors.petId.message}
                </p>
              ) : null}
            </label>

            <label className="space-y-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                <UserRound size={14} />
                Nhân viên phụ trách
              </span>
              <select
                {...register("staffId")}
                className="h-12 w-full rounded-2xl border border-border bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
              >
                <option value="">Chưa phân công</option>
                {staffOptions.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.fullName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                <CalendarClock size={14} />
                Thời gian bắt đầu
              </span>
              <input
                type="datetime-local"
                {...register("startTime")}
                className="h-12 w-full rounded-2xl border border-border bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Giá dịch vụ
              </span>
              <input
                type="number"
                min="0"
                step="1000"
                {...register("price", { valueAsNumber: true })}
                placeholder="150000"
                className="h-12 w-full rounded-2xl border border-border bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
              />
              {errors.price ? (
                <p className="text-xs font-medium text-error">
                  {errors.price.message}
                </p>
              ) : null}
            </label>
          </div>

          {isEditing ? (
            <div className="rounded-2xl border border-border bg-card/80 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Trạng thái hiện tại
              </p>
              <div className="flex flex-wrap gap-2">
                {GROOMING_STATUS_ORDER.map((status) => {
                  const meta = GROOMING_STATUS_META[status];
                  const Icon = meta.icon;

                  return (
                    <span
                      key={status}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${meta.chipClassName} ${
                        initialData?.status === status
                          ? "ring-1 ring-current/20"
                          : "opacity-60"
                      }`}
                    >
                      <Icon size={12} />
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
              Ghi chú
            </span>
            <textarea
              rows={4}
              {...register("notes")}
              placeholder="Lưu ý cho ca grooming, yêu cầu khách, ghi chú nội bộ..."
              className="w-full rounded-[24px] border border-border bg-background-secondary px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
            />
          </label>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background-secondary px-5 text-sm font-medium text-foreground transition-colors hover:border-primary-500/60"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {saveMutation.isPending
                ? "Đang lưu..."
                : isEditing
                  ? "Lưu thay đổi"
                  : "Tạo phiên"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
