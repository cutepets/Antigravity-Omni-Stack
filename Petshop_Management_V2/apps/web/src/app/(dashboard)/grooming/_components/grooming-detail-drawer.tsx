"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  Save,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { customToast as toast } from "@/components/ui/toast-with-copy";
import {
  groomingApi,
  type GroomingSession,
  type GroomingStatus,
} from "@/lib/api/grooming.api";
import { useAuthorization } from "@/hooks/useAuthorization";
import type { Staff } from "@/lib/api/staff.api";
import {
  formatGroomingDateTime,
  formatGroomingMoney,
  GroomingStatusBadge,
  GROOMING_STATUS_META,
  GROOMING_STATUS_ORDER,
  toDateTimeLocalValue,
} from "./grooming-status";
import { CancelNotesModal } from "./cancel-notes-modal";

interface GroomingDetailDrawerProps {
  isOpen: boolean;
  session: GroomingSession | null;
  staffOptions: Staff[];
  onClose: () => void;
}

interface DrawerFormState {
  status: GroomingStatus;
  staffId: string;
  startTime: string;
  endTime: string;
  price: string;
  notes: string;
}

function buildFormState(session: GroomingSession | null): DrawerFormState {
  return {
    status: session?.status ?? "PENDING",
    staffId: session?.staffId ?? "",
    startTime: toDateTimeLocalValue(session?.startTime),
    endTime: toDateTimeLocalValue(session?.endTime),
    price: session?.price ? String(Math.round(session.price)) : "",
    notes: session?.notes ?? "",
  };
}

export function GroomingDetailDrawer({
  isOpen,
  session,
  staffOptions,
  onClose,
}: GroomingDetailDrawerProps) {
  const queryClient = useQueryClient();
  const { hasPermission, hasAnyPermission } = useAuthorization();
  const [form, setForm] = useState<DrawerFormState>(() =>
    buildFormState(session),
  );
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(buildFormState(session));
    }
  }, [isOpen, session]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!session) return null;

      return groomingApi.updateSession({
        id: session.id,
        status: form.status,
        staffId: form.staffId || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        notes: form.notes.trim() || undefined,
        price: form.price === "" ? undefined : Number(form.price),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grooming-sessions"] });
      toast.success("Đã cập nhật phiên grooming");
      onClose();
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || "Không thể cập nhật phiên grooming",
      );
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
      toast.error(
        error?.response?.data?.message || "Không thể xóa phiên grooming",
      );
    },
  });

  if (!isOpen || !session) return null;

  const canUpdateSession = hasAnyPermission([
    "grooming.update",
    "grooming.start",
    "grooming.complete",
    "grooming.cancel",
  ]);
  const canDeleteSession = hasPermission("grooming.cancel") && !session.orderId;
  const canReadOrders = hasAnyPermission(["order.read.all", "order.read.assigned"]);

  const customerName = session.pet?.customer?.fullName || "Khách lẻ";
  const customerPhone = session.pet?.customer?.phone || "—";
  const petLabel = session.pet?.breed || session.pet?.species || "Không rõ giống";
  const sessionLabel = session.sessionCode || session.id.slice(-8).toUpperCase();
  const petCodeLabel = session.pet?.petCode || session.petId;
  const orderCodeLabel = session.order?.orderNumber || session.orderId || "—";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-[460px] flex-col border-l border-border bg-background-base shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <GroomingStatusBadge status={session.status} />
              <span className="rounded-full border border-border bg-background-secondary px-2 py-1 font-mono text-[11px] text-foreground-muted">
                {sessionLabel}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {session.petName}
              </h2>
              <p className="text-sm text-foreground-muted">{petLabel}</p>
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

        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card/80 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                <UserRound size={14} />
                Khách hàng
              </div>
              <p className="text-sm font-semibold text-foreground">
                {customerName}
              </p>
              <p className="mt-1 text-sm text-foreground-muted">
                {customerPhone}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card/80 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                <CalendarClock size={14} />
                Thời gian
              </div>
              <p className="text-sm font-semibold text-foreground">
                {formatGroomingDateTime(session.createdAt)}
              </p>
              <p className="mt-1 text-xs text-foreground-muted">Tạo lúc</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
              <ClipboardList size={14} />
              Thông tin liên kết
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-foreground-muted">Mã thú cưng</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {petCodeLabel}
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Mã dịch vụ</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {session.serviceId || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Mã đơn hàng</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {orderCodeLabel}
                  </span>
                  {session.orderId && canReadOrders ? (
                    <Link
                      href={`/orders/${session.orderId}`}
                      className="text-xs font-medium text-primary-400 transition-colors hover:text-primary-300"
                    >
                      Mở đơn
                    </Link>
                  ) : null}
                  {session.orderId && canReadOrders ? (
                    <ArrowUpRight size={14} className="text-foreground-muted" />
                  ) : null}
                </div>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Giá hiện tại</p>
                <p className="mt-1 text-sm font-semibold text-primary-500">
                  {formatGroomingMoney(session.price)}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Cập nhật phiên
                </p>
                <p className="text-xs text-foreground-muted">
                  Theo workflow hiện có của V2.
                </p>
              </div>
              <GroomingStatusBadge status={form.status} />
            </div>

            <div className="grid gap-3">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  Trạng thái
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {GROOMING_STATUS_ORDER.map((status) => {
                    const meta = GROOMING_STATUS_META[status];
                    const Icon = meta.icon;

                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => {
                          if (!canUpdateSession) return;
                          if (status === "CANCELLED") {
                            setShowCancelModal(true);
                          } else {
                            setForm((current) => ({ ...current, status }));
                          }
                        }}
                        disabled={!canUpdateSession}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                          form.status === status
                            ? `${meta.chipClassName} shadow-sm`
                            : "border-border bg-background-secondary text-foreground-muted hover:text-foreground"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        <Icon size={14} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  Nhân viên phụ trách
                </span>
                <select
                  value={form.staffId}
                  disabled={!canUpdateSession}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      staffId: event.target.value,
                    }))
                  }
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
                    value={form.startTime}
                    disabled={!canUpdateSession}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                    Kết thúc
                  </span>
                  <input
                    type="datetime-local"
                    value={form.endTime}
                    disabled={!canUpdateSession}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  <Tag size={14} />
                  Giá dịch vụ
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={form.price}
                  disabled={!canUpdateSession}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                  placeholder="150000"
                  className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  Ghi chú
                </span>
                <textarea
                  rows={4}
                  value={form.notes}
                  disabled={!canUpdateSession}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Lưu ý về thú cưng, yêu cầu khách, ghi chú nội bộ..."
                  className="w-full rounded-2xl border border-border bg-background-secondary px-3 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                />
              </label>
            </div>
          </section>

          {!canDeleteSession ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
              Phiên này đang gắn với đơn hàng. Mình giữ an toàn bằng cách chỉ
              cho phép cập nhật trạng thái, không xóa cứng.
            </div>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => {
              if (!canUpdateSession) return;
              updateMutation.mutate();
            }}
            disabled={!canUpdateSession || updateMutation.isPending}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {updateMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-background-secondary px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/60"
            >
              Đóng
            </button>

            <button
              type="button"
              disabled={!canDeleteSession || deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`Xóa phiên grooming của ${session.petName}?`)) {
                  deleteMutation.mutate();
                }
              }}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-error/20 bg-error/10 px-4 text-sm font-semibold text-error transition-colors hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={15} />
              Xóa phiên
            </button>
          </div>
        </div>
      </aside>

      {showCancelModal && (
        <CancelNotesModal
          session={{ petName: session.petName }}
          onConfirm={(note) => {
            const existingNotes = form.notes || "";
            const cancelNote = note.trim();
            const combinedNotes = cancelNote
              ? cancelNote + (existingNotes ? "\n" + existingNotes : "")
              : existingNotes;
            setForm((current) => ({
              ...current,
              status: "CANCELLED",
              notes: combinedNotes,
            }));
            setShowCancelModal(false);
          }}
          onCancel={() => setShowCancelModal(false)}
        />
      )}
    </div>
  );
}
