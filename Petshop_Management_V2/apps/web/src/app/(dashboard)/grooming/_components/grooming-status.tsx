import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Clock3, Scissors, XCircle } from "lucide-react";
import type { GroomingStatus } from "@/lib/api/grooming.api";
import { cn } from "@/lib/utils";

interface GroomingStatusMeta {
  label: string;
  icon: LucideIcon;
  columnTitle: string;
  chipClassName: string;
  columnClassName: string;
  headerClassName: string;
}

export const GROOMING_STATUS_ORDER: GroomingStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export const GROOMING_STATUS_META: Record<GroomingStatus, GroomingStatusMeta> =
  {
    PENDING: {
      label: "Chờ làm",
      columnTitle: "Chờ làm",
      icon: Clock3,
      chipClassName: "border-amber-500/20 bg-amber-500/10 text-amber-500",
      columnClassName: "border-amber-500/15 bg-amber-500/[0.04]",
      headerClassName:
        "border-b border-amber-500/10 bg-amber-500/[0.08] text-amber-500",
    },
    IN_PROGRESS: {
      label: "Đang làm",
      columnTitle: "Đang làm",
      icon: Scissors,
      chipClassName: "border-sky-500/20 bg-sky-500/10 text-sky-500",
      columnClassName: "border-sky-500/15 bg-sky-500/[0.04]",
      headerClassName:
        "border-b border-sky-500/10 bg-sky-500/[0.08] text-sky-500",
    },
    COMPLETED: {
      label: "Hoàn thành",
      columnTitle: "Hoàn thành",
      icon: CheckCircle2,
      chipClassName: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
      columnClassName: "border-emerald-500/15 bg-emerald-500/[0.04]",
      headerClassName:
        "border-b border-emerald-500/10 bg-emerald-500/[0.08] text-emerald-500",
    },
    CANCELLED: {
      label: "Đã hủy",
      columnTitle: "Đã hủy",
      icon: XCircle,
      chipClassName: "border-rose-500/20 bg-rose-500/10 text-rose-500",
      columnClassName: "border-rose-500/15 bg-rose-500/[0.04]",
      headerClassName:
        "border-b border-rose-500/10 bg-rose-500/[0.08] text-rose-500",
    },
  };

export function formatGroomingMoney(value?: number | null) {
  return `${Math.round(value ?? 0).toLocaleString("vi-VN")}₫`;
}

export function formatGroomingDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatGroomingTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function GroomingStatusBadge({
  status,
  className,
}: {
  status: GroomingStatus;
  className?: string;
}) {
  const meta = GROOMING_STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        meta.chipClassName,
        className,
      )}
    >
      <Icon size={12} />
      {meta.label}
    </span>
  );
}
