"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Phone,
  PawPrint,
  Printer,
  Save,
  Tag,
  Trash2,
  UserRound,
  X,
  RefreshCw,
  Coins,
} from "lucide-react";

import * as Tabs from "@radix-ui/react-tabs";
import { customToast as toast } from "@/components/ui/toast-with-copy";
import {
  groomingApi,
  type GroomingOrderItem,
  type GroomingSession,
  type GroomingSessionPricingSnapshot,
  type SpaExtraServiceLine,
} from "@/lib/api/grooming.api";
import { petApi } from "@/lib/api/pet.api";
import { staffApi } from "@/lib/api/staff.api";
import { pricingApi, type SpaPriceRule } from "@/lib/api/pricing.api";
import { useAuthorization } from "@/hooks/useAuthorization";
import { useAuthStore } from "@/stores/auth.store";
import {
  formatGroomingDateTime,
  GroomingStatusBadge,
  toDateTimeLocalValue,
} from "./grooming-status";
import { formatDateTime } from "@/lib/utils";
import { CancelNotesModal } from "./cancel-notes-modal";
import { settingsApi } from "@/lib/api/settings.api";
import { printGroomingSession } from "@/lib/grooming-print";
import { confirmDialog } from '@/components/ui/confirmation-provider'

const GROOMING_STATUS_VI: Record<string, string> = {
  BOOKED: 'Đặt lịch',
  PENDING: 'Chờ làm',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Hoàn thành',
  RETURNED: 'Đã trả',
  CANCELLED: 'Đã hủy',
};

function translateStatus(status?: string | null) {
  if (!status) return null;
  return GROOMING_STATUS_VI[status] ?? status;
}

function buildHistorySummary(entry: any) {
  const actorName =
    entry.performedByUser?.fullName ?? entry.performedByUser?.username ?? 'Chưa xác định';
  const statusLabel =
    entry.fromStatus || entry.toStatus
      ? [
        entry.fromStatus ? translateStatus(entry.fromStatus) : null,
        entry.toStatus ? `→ ${translateStatus(entry.toStatus)}` : null,
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

function getOrderItemServiceRole(item: { pricingSnapshot?: Record<string, unknown> | null }) {
  const snapshot = (item.pricingSnapshot ?? {}) as Record<string, any>;
  return snapshot.serviceRole === "EXTRA" || snapshot.pricingSnapshot?.serviceRole === "EXTRA" ? "EXTRA" : "MAIN";
}

function getSessionExtraServices(session?: GroomingSession | null): SpaExtraServiceLine[] {
  const snapshot = (session?.pricingSnapshot ?? {}) as Record<string, any>;
  return session?.extraServices ?? snapshot.extraServices ?? [];
}

function getLinkedSessionSnapshot(session?: GroomingSession | null) {
  return ((session?.pricingSnapshot ?? {}) as GroomingSessionPricingSnapshot) ?? {};
}

type SpaServiceLineRole = "MAIN" | "EXTRA";
type SpaServiceLineSource = "order" | "snapshot" | "draft";

interface SpaServiceLine {
  discountItem?: number;
  key: string;
  role: SpaServiceLineRole;
  source: SpaServiceLineSource;
  name: string;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  lineTotal: number;
  pricingRuleId?: string;
}

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("vi-VN");

function toSafeNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function formatMoney(value: number) {
  return moneyFormatter.format(toSafeNumber(value));
}

function formatNumber(value: number) {
  return numberFormatter.format(toSafeNumber(value));
}

function buildSpaOrderLine(item: GroomingOrderItem, index: number): SpaServiceLine {
  const quantity = Math.max(1, toSafeNumber(item.quantity, 1));
  const unitPrice = toSafeNumber(item.unitPrice);
  const lineDiscount = toSafeNumber(item.discountItem);
  return {
    key: item.id ?? `order-${index}`,
    role: getOrderItemServiceRole(item),
    source: "order",
    name: item.description?.trim() || "Dịch vụ",
    quantity,
    unitPrice,
    lineDiscount,
    lineTotal: unitPrice * quantity - lineDiscount,
  };
}

function buildSpaExtraLine(
  service: SpaExtraServiceLine,
  index: number,
  source: SpaServiceLineSource,
): SpaServiceLine {
  const quantity = Math.max(1, toSafeNumber(service.quantity, 1));
  const unitPrice = toSafeNumber(service.price);
  const lineDiscount = toSafeNumber(service.discountItem);
  return {
    key: service.orderItemId ?? service.pricingRuleId ?? `${source}-extra-${index}-${service.name}`,
    role: "EXTRA",
    source,
    name: service.name?.trim() || "Dịch vụ phụ",
    quantity,
    unitPrice,
    lineDiscount,
    lineTotal: toSafeNumber(service.total, unitPrice * quantity - lineDiscount),
    pricingRuleId: service.pricingRuleId,
  };
}

function buildSpaMainSnapshotLine(
  snapshot: GroomingSessionPricingSnapshot,
  fallbackName?: string,
  fallbackPrice?: number,
): SpaServiceLine | null {
  const mainService = snapshot.mainService ?? null;
  const quantity = Math.max(1, toSafeNumber(mainService?.quantity, 1));
  const unitPrice = toSafeNumber(mainService?.price, toSafeNumber(snapshot.mainPrice, toSafeNumber(fallbackPrice)));
  const lineDiscount = toSafeNumber(mainService?.discountItem);
  const name =
    mainService?.name?.trim()
    || mainService?.packageCode?.trim()
    || snapshot.packageCode?.trim()
    || fallbackName?.trim()
    || (unitPrice > 0 ? "Dịch vụ chính" : "");

  if (!name) return null;

  return {
    key: `main-${snapshot.packageCode ?? fallbackName ?? "service"}`,
    role: "MAIN",
    source: "snapshot",
    name,
    quantity,
    unitPrice,
    lineDiscount,
    lineTotal: toSafeNumber(mainService?.total, unitPrice * quantity - lineDiscount),
  };
}

function buildSpaDraftMainLine(packageName: string, price?: number): SpaServiceLine | null {
  const unitPrice = toSafeNumber(price);
  const trimmedName = packageName.trim();
  const name = trimmedName || (unitPrice > 0 ? "Dịch vụ chính" : "");
  if (!name) return null;

  return {
    key: `draft-main-${trimmedName || unitPrice}`,
    role: "MAIN",
    source: "draft",
    name,
    quantity: 1,
    unitPrice,
    lineDiscount: 0,
    lineTotal: unitPrice,
  };
}



function SpaServiceLineRow({
  line,
  index,
  disabled = false,
  onQuantityChange,
  onRemove,
}: {
  line: SpaServiceLine;
  index: number;
  disabled?: boolean;
  onQuantityChange?: (quantity: number) => void;
  onRemove?: () => void;
}) {
  const isEditable = Boolean(onQuantityChange || onRemove);

  if (isEditable) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_88px_112px_32px] items-center gap-2 rounded-xl border border-border/60 bg-background-base/60 px-3 py-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-[10px] font-bold text-primary-500">
            {index}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{line.name}</p>
            <p className="text-[11px] text-foreground-muted">
              {formatNumber(line.unitPrice)} / lần
              {line.lineDiscount > 0 ? ` • CK ${formatNumber(line.lineDiscount)}` : ""}
            </p>
          </div>
        </div>
        <input
          type="number"
          min={1}
          value={line.quantity}
          disabled={disabled || !onQuantityChange}
          onChange={(event) => onQuantityChange?.(Number(event.target.value))}
          className="h-9 rounded-lg border border-border bg-background-secondary px-2 text-sm text-foreground outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="text-right text-xs font-semibold text-foreground">
          {formatMoney(line.lineTotal)}
        </div>
        <button
          type="button"
          disabled={disabled || !onRemove}
          onClick={onRemove}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-error transition-colors hover:bg-error/10 disabled:opacity-50"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 gap-y-0.5 rounded-xl border border-border/60 bg-background-base/60 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-[10px] font-bold text-primary-500">
          {index}
        </span>
        <span className="truncate text-sm font-medium text-foreground">{line.name}</span>
      </div>
      <span className="text-[11px] text-foreground-muted whitespace-nowrap">
        {formatNumber(line.unitPrice)} × {line.quantity}
      </span>
      {line.lineDiscount > 0 ? (
        <span className="text-[11px] text-rose-500 whitespace-nowrap">-{formatNumber(line.lineDiscount)}</span>
      ) : (
        <span className="text-[11px] text-foreground-muted/40">—</span>
      )}
      <span className="shrink-0 text-xs font-semibold text-foreground">{formatMoney(line.lineTotal)}</span>
    </div>
  );
}

function isCommonSpaExtraRule(rule: SpaPriceRule, petWeight?: number | null) {
  if (rule.species || rule.weightBandId || rule.weightBand) return false;
  const hasMin = rule.minWeight !== null && rule.minWeight !== undefined;
  const hasMax = rule.maxWeight !== null && rule.maxWeight !== undefined;
  if (!hasMin && !hasMax) return true;
  if (!Number.isFinite(Number(petWeight))) return false;
  const weight = Number(petWeight);
  const minWeight = Number(rule.minWeight ?? 0);
  const maxWeight = rule.maxWeight === null || rule.maxWeight === undefined ? Number.POSITIVE_INFINITY : Number(rule.maxWeight);
  return weight >= minWeight && weight < maxWeight;
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
  status: z.enum(["BOOKED", "PENDING", "IN_PROGRESS", "COMPLETED", "RETURNED", "CANCELLED"] as const).optional(),
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
  const [selectedExtraServices, setSelectedExtraServices] = useState<SpaExtraServiceLine[]>([]);

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

  const printTemplateQuery = useQuery({
    queryKey: ["settings.print-templates", "spa_receipt_k80"],
    queryFn: () => settingsApi.getPrintTemplateByType("spa_receipt_k80"),
    enabled: isOpen && isEditing,
    retry: false,
  });

  const printConfigQuery = useQuery({
    queryKey: ["settings", "configs", "print-shop"],
    queryFn: () => settingsApi.getConfigs(["shopName", "shopAddress", "shopPhone"]),
    enabled: isOpen && isEditing,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const sessionId = isEditing ? session?.id : undefined;
  const sessionDetailQuery = useQuery({
    queryKey: ["grooming-session", sessionId],
    queryFn: () => groomingApi.getSession(sessionId!),
    enabled: isOpen && isEditing && Boolean(sessionId),
  });
  const activeSession = sessionDetailQuery.data ?? session;

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

  const linkedOrderItems = activeSession?.orderItems ?? [];
  const linkedSessionSnapshot = getLinkedSessionSnapshot(activeSession);
  const snapshotExtraServices = getSessionExtraServices(activeSession);
  const isLinkedToOrder = isEditing && Boolean(activeSession?.orderId || activeSession?.order || linkedOrderItems.length > 0);
  const linkedOrderLines = linkedOrderItems.map((item, index) => buildSpaOrderLine(item, index));
  const linkedMainOrderItems = linkedOrderLines.filter((item) => item.role === "MAIN");
  const linkedExtraOrderItems = linkedOrderLines.filter((item) => item.role === "EXTRA");
  const linkedMainBaseAmount = linkedMainOrderItems.length > 0
    ? linkedMainOrderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    : Number(linkedSessionSnapshot.mainService?.price ?? linkedSessionSnapshot.mainPrice ?? 0)
    * Number(linkedSessionSnapshot.mainService?.quantity ?? 1);
  const linkedExtraBaseAmount = linkedExtraOrderItems.length > 0
    ? linkedExtraOrderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    : Number(linkedSessionSnapshot.extraTotal ?? 0);
  const linkedOrderBaseAmount = linkedMainBaseAmount + linkedExtraBaseAmount;
  const linkedOrderDiscount = linkedOrderItems.length > 0
    ? linkedOrderItems.reduce((sum, item) => sum + (item.discountItem ?? 0), 0)
    : Number(linkedSessionSnapshot.discountAmount ?? linkedSessionSnapshot.mainService?.discountItem ?? 0);
  const linkedOrderTotal = Math.max(
    0,
    linkedOrderItems.length > 0
      ? linkedOrderBaseAmount - linkedOrderDiscount
      : Number(linkedSessionSnapshot.totalPrice ?? linkedSessionSnapshot.totalAmount ?? (linkedOrderBaseAmount - linkedOrderDiscount)),
  );

  // Derive species from selected pet (create mode) or existing session (detail mode)
  const selectedPetSpecies =
    mode === "create"
      ? petsQuery.data?.data?.find((p: any) => p.id === watchPetId)?.species ?? undefined
      : activeSession?.pet?.species ?? undefined;

  const packagesQuery = useQuery({
    queryKey: ["grooming-packages", selectedPetSpecies ?? "all"],
    queryFn: () => groomingApi.getPackages(selectedPetSpecies),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const availablePackages = packagesQuery.data ?? [];
  const selectedPetWeight =
    mode === "create"
      ? petsQuery.data?.data?.find((p: any) => p.id === watchPetId)?.weight ?? null
      : activeSession?.weightAtBooking ?? null;
  const spaExtraRulesQuery = useQuery({
    queryKey: ["grooming-extra-services", "common"],
    queryFn: () => pricingApi.getSpaRules({ isActive: true }),
    enabled: isOpen && !isLinkedToOrder,
    staleTime: 30_000,
  });
  const availableExtraRules = (spaExtraRulesQuery.data ?? []).filter((rule) => isCommonSpaExtraRule(rule, selectedPetWeight));
  const selectedPackageLabel =
    availablePackages.find((pkg: { code: string; label: string }) => pkg.code === watchPackageCode)?.label
    ?? watchPackageCode
    ?? "";
  const standaloneMainLine = buildSpaDraftMainLine(selectedPackageLabel, watchPrice);
  const standaloneExtraLines = selectedExtraServices.map((service, index) => buildSpaExtraLine(service, index, "draft"));
  const snapshotMainLine = buildSpaMainSnapshotLine(linkedSessionSnapshot, activeSession?.packageCode ?? undefined, activeSession?.price ?? undefined);
  const snapshotExtraLines = snapshotExtraServices.map((service, index) => buildSpaExtraLine(service, index, "snapshot"));
  const spaServiceLines = isLinkedToOrder
    ? (linkedOrderLines.length > 0
      ? linkedOrderLines
      : [
        ...(snapshotMainLine ? [snapshotMainLine] : []),
        ...snapshotExtraLines,
      ])
    : [
      ...(standaloneMainLine ? [standaloneMainLine] : []),
      ...standaloneExtraLines,
    ];
  const mainServiceLines = spaServiceLines.filter((line) => line.role === "MAIN");
  const extraServiceLines = spaServiceLines.filter((line) => line.role === "EXTRA");
  const hasMultipleMainServices = mainServiceLines.length > 1;
  const serviceSubtotal = spaServiceLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const serviceLineDiscount = spaServiceLines.reduce((sum, line) => sum + line.lineDiscount, 0);
  const standaloneAdjustment = toSafeNumber(watchSurcharge);
  const serviceSummaryDiscount = isLinkedToOrder ? linkedOrderDiscount : serviceLineDiscount;
  const serviceSummaryTotal = isLinkedToOrder
    ? linkedOrderTotal
    : Math.max(0, serviceSubtotal - serviceLineDiscount + standaloneAdjustment);
  const standaloneTotal = serviceSummaryTotal;
  const displayedPrice = isLinkedToOrder ? linkedMainBaseAmount : watchPrice;
  const displayedAdjustment = isLinkedToOrder ? linkedOrderDiscount : watchSurcharge;

  useEffect(() => {
    if (isOpen) {
      if (mode === "detail" && activeSession) {
        const activeSnapshot = getLinkedSessionSnapshot(activeSession);
        const activeExtraServices = getSessionExtraServices(activeSession);
        reset({
          petId: activeSession.petId,
          branchId: activeSession.branchId ?? activeBranchId ?? "",
          staffId: activeSession.staffId ?? "",
          startTime: toDateTimeLocalValue(activeSession.startTime),
          endTime: toDateTimeLocalValue(activeSession.endTime),
          notes: activeSession.notes ?? "",
          price: isLinkedToOrder ? linkedMainBaseAmount : activeSnapshot.mainPrice ?? activeSession.price ?? undefined,
          surcharge: isLinkedToOrder ? linkedOrderDiscount : activeSession.surcharge ?? undefined,
          packageCode: activeSession.packageCode ?? "",
          status: activeSession.status,
        });
        const prevStaffIds = activeSession.assignedStaff?.map(s => s.id) ?? (activeSession.staffId ? [activeSession.staffId] : []);
        setSelectedStaffIds(prevStaffIds);
        setSelectedExtraServices(isLinkedToOrder ? [] : activeExtraServices);
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
        setSelectedExtraServices([]);
      }
    }
  }, [isOpen, mode, activeSession, reset, activeBranchId, isLinkedToOrder, linkedMainBaseAmount, linkedOrderDiscount]);

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

  const { mutate: triggerCalculate } = calculateMutation;
  useEffect(() => {
    if (mode === "create" && watchPetId && watchPackageCode) {
      triggerCalculate();
    }
  }, [watchPetId, watchPackageCode, mode, triggerCalculate]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: any = {
        petId: data.petId,
        branchId: data.branchId || undefined,
        staffId: selectedStaffIds.length > 0 ? selectedStaffIds[0] : undefined,
        staffIds: selectedStaffIds,
        startTime: data.startTime || undefined,
        endTime: data.endTime || undefined,
        notes: data.notes?.trim() || undefined,
        packageCode: data.packageCode || undefined,
      };

      if (!isLinkedToOrder) {
        payload.price = typeof data.price === "number" && !Number.isNaN(data.price) ? data.price : undefined;
        payload.surcharge = typeof data.surcharge === "number" && !Number.isNaN(data.surcharge) ? data.surcharge : 0;
        payload.extraServices = selectedExtraServices;
      }

      if (mode === "create" || !session) {
        return groomingApi.createSession(payload);
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { petId: _petId, ...updatePayload } = payload;
      return groomingApi.updateSession({
        id: session.id,
        ...updatePayload,
        status: data.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grooming-sessions"] });
      if (session?.id) {
        queryClient.invalidateQueries({ queryKey: ["grooming-session", session.id] });
      }
      if (isLinkedToOrder) {
        queryClient.invalidateQueries({ queryKey: ["order"] });
        queryClient.invalidateQueries({ queryKey: ["order-timeline"] });
      }
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
      if (session?.id) {
        queryClient.invalidateQueries({ queryKey: ["grooming-session", session.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["order"] });
      queryClient.invalidateQueries({ queryKey: ["order-timeline"] });
      toast.success("Đã xóa phiên grooming");
      onClose();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Không thể xóa phiên grooming");
    },
  });

  const contactStatusMutation = useMutation({
    mutationFn: async (contactStatus: 'CALLED' | 'UNCALLED') => {
      if (!session) return null;
      return groomingApi.updateSession({ id: session.id, contactStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grooming-sessions"] });
      if (session?.id) {
        queryClient.invalidateQueries({ queryKey: ["grooming-session", session.id] });
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Không thể cập nhật liên hệ");
    },
  });

  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!session) return null;
      return groomingApi.updateSession({ id: session.id, status: 'RETURNED' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grooming-sessions"] });
      if (session?.id) {
        queryClient.invalidateQueries({ queryKey: ["grooming-session", session.id] });
      }
      toast.success("Đã trả thú cưng cho khách");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Không thể cập nhật trạng thái");
    },
  });

  const revertCancelMutation = useMutation({
    mutationFn: async () => {
      if (!session) return null;
      return groomingApi.updateSession({ id: session.id, status: 'PENDING' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grooming-sessions'] });
      if (session?.id) queryClient.invalidateQueries({ queryKey: ['grooming-session', session.id] });
      toast.success('Đã hoàn hủy phiếu — chuyển về Chờ làm');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể hoàn hủy');
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
  const canDeleteSession = isEditing && hasPermission("grooming.cancel") && !isLinkedToOrder;
  const canReadOrders = hasAnyPermission(["order.read.all", "order.read.assigned"]);

  const getPetInfo = () => {
    if (mode === "detail" && activeSession) {
      return {
        petId: activeSession.petId,
        customerId: activeSession.pet?.customer?.id || activeSession.customerId,
        name: activeSession.petName,
        label: activeSession.pet?.breed || activeSession.pet?.species || "Không rõ giống",
        code: activeSession.pet?.petCode || activeSession.petId,
        customerName: activeSession.pet?.customer?.fullName || "Khách lẻ",
        customerPhone: activeSession.pet?.customer?.phone || "—",
      };
    }
    const pet = pets.find((p) => p.id === watchPetId);
    if (pet) {
      return {
        petId: pet.id,
        customerId: pet.customer?.id || pet.customerId,
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
  const addExtraService = (rule: SpaPriceRule) => {
    if (selectedExtraServices.some((service) => service.pricingRuleId === rule.id)) return;
    setSelectedExtraServices((current) => [
      ...current,
      {
        pricingRuleId: rule.id,
        sku: rule.sku ?? null,
        name: rule.packageCode,
        price: rule.price,
        quantity: 1,
        durationMinutes: rule.durationMinutes ?? null,
      },
    ]);
  };
  const updateExtraQuantity = (pricingRuleId: string | undefined, quantity: number) => {
    setSelectedExtraServices((current) =>
      current.map((service) =>
        service.pricingRuleId === pricingRuleId
          ? { ...service, quantity: Math.max(1, Number(quantity) || 1) }
          : service,
      ),
    );
  };
  const removeExtraService = (pricingRuleId: string | undefined) => {
    setSelectedExtraServices((current) => current.filter((service) => service.pricingRuleId !== pricingRuleId));
  };
  const sessionLabel = isEditing && activeSession ? (activeSession.sessionCode || activeSession.id.slice(-8).toUpperCase()) : "Tạo mới";

  return (
    <>

      <div className="fixed inset-0 z-50 flex items-start justify-center app-modal-overlay p-4 pt-[10vh] sm:p-0 sm:pt-[10vh]">
        <aside
          className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-background-base shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <Tabs.Root defaultValue="info" className="flex h-full flex-col">
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-foreground">
                    {petInfo.name}
                  </h2>
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
                {petInfo.label && (
                  <p className="text-sm text-foreground-muted">{petInfo.label}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeSession && (
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
                {isEditing && activeSession && (
                  <button
                    type="button"
                    title="In phiếu grooming"
                    onClick={() =>
                      printGroomingSession(
                        {
                          session: activeSession,
                          shopName: printConfigQuery.data?.shopName,
                          shopAddress: printConfigQuery.data?.shopAddress,
                          shopPhone: printConfigQuery.data?.shopPhone,
                          branchName: activeSession.branch?.name,
                        },
                        printTemplateQuery.data ?? null,
                      )
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background-secondary text-foreground-muted transition-all duration-150 hover:border-primary-500/40 hover:bg-primary-500/10 hover:text-primary-500 active:scale-95"
                  >
                    <Printer size={18} />
                  </button>
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
                    <section className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border bg-card/80 p-4 relative group">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                          <span className="flex items-center gap-2"><UserRound size={14} /> Khách hàng</span>
                          {petInfo.customerId && (
                            <Link href={`/customers/${petInfo.customerId}`} target="_blank" className="hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              Chi tiết
                            </Link>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground">{petInfo.customerName}</p>
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-foreground-muted">
                            SĐT: <span className="font-medium text-foreground">{petInfo.customerPhone}</span>
                          </p>
                        </div>
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
                        <p className="text-sm font-mono font-semibold text-foreground">{petInfo.code}</p>
                        <p className="mt-2 text-xs text-foreground-muted">
                          Tên: <span className="font-medium text-foreground">{petInfo.name}</span>
                        </p>
                      </div>

                      <div className="rounded-2xl border border-border bg-card/80 p-4 relative group">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                          <span className="flex items-center gap-2"><ClipboardList size={14} /> Đơn hàng</span>
                          {isEditing && activeSession?.order && canReadOrders && (
                            <Link
                              href={`/orders/${activeSession.order.orderNumber}`}
                              target="_blank"
                              className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-400 transition-colors"
                            >
                              <ArrowUpRight size={13} />
                              {activeSession.order.orderNumber}
                            </Link>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="space-y-1 mt-2">
                            <p className="text-xs text-foreground-muted">
                              Tạo lúc: <span className="font-medium text-foreground">{formatGroomingDateTime(activeSession!.createdAt)}</span>
                            </p>
                            {activeSession!.branch && (
                              <p className="text-xs text-foreground-muted">
                                CN: <span className="font-medium text-foreground">{activeSession!.branch.name}</span>
                              </p>
                            )}
                            {activeSession!.order?.staff && (
                              <p className="text-xs text-foreground-muted">
                                Người thu ngân: <span className="font-medium text-foreground">{activeSession!.order.staff.fullName}</span>
                              </p>
                            )}
                            {!activeSession!.order && (
                              <p className="mt-2 text-xs italic text-foreground-muted">Chưa liên kết đơn POS</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-foreground-muted mt-2 italic">Chưa có thông tin</p>
                        )}
                      </div>
                    </section>

                    <section className="space-y-4 rounded-2xl border border-border bg-card/80 p-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 col-span-1" hidden={isLinkedToOrder}>
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                            Mã gói / Package
                          </span>
                          <select
                            {...register("packageCode")}
                            disabled={!canUpdateSession || isLinkedToOrder}
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

                        <div className="space-y-2 col-span-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                            Nhân viên phụ trách
                          </span>
                          {/* Input + pill toggle ngang nhau */}
                          <div className="flex items-start gap-2">
                            <div className="relative flex-1">
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
                                        onClick={async () => {
                                          setSelectedStaffIds(prev => [...prev, staff.id]);
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

                            {/* Pill segmented: Chưa gọi / Đã gọi */}
                            {isEditing && (activeSession?.status === 'COMPLETED' || activeSession?.status === 'RETURNED') && (
                              <div className="ml-auto flex h-11 shrink-0 items-center gap-0.5 rounded-xl border border-border bg-background-secondary p-1">
                                <button
                                  type="button"
                                  disabled={contactStatusMutation.isPending}
                                  onClick={() => contactStatusMutation.mutate('UNCALLED')}
                                  className={`h-full rounded-lg px-3 text-xs font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50 ${(activeSession?.contactStatus ?? 'UNCALLED') === 'UNCALLED'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'text-foreground-muted hover:text-foreground'
                                    }`}
                                >
                                  Chưa gọi
                                </button>
                                <button
                                  type="button"
                                  disabled={contactStatusMutation.isPending}
                                  onClick={() => contactStatusMutation.mutate('CALLED')}
                                  className={`h-full rounded-lg px-3 text-xs font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50 ${(activeSession?.contactStatus ?? 'UNCALLED') === 'CALLED'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-foreground-muted hover:text-foreground'
                                    }`}
                                >
                                  Đã gọi
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Tags nhân viên đã chọn — hiện ngay dưới ô tìm kiếm */}
                          {selectedStaffIds.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
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
                          )}
                        </div>

                        <label className="space-y-2 col-span-1" hidden={isLinkedToOrder}>
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
                            value={displayedPrice !== undefined ? new Intl.NumberFormat("vi-VN").format(displayedPrice) : ""}
                            onChange={(e) => {
                              if (isLinkedToOrder) return;
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              setValue("price", raw ? Number(raw) : undefined, { shouldDirty: true });
                            }}
                            disabled={!canUpdateSession || isLinkedToOrder}
                            placeholder="0"
                            className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                          />
                          {errors.price && <p className="text-xs text-error">{errors.price.message}</p>}
                        </label>

                        <label className="space-y-2 col-span-1" hidden={isLinkedToOrder}>
                          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                            <Coins size={14} /> {isLinkedToOrder ? "Chiết khấu" : "Phụ phí"}
                          </span>
                          <input
                            type="text"
                            value={displayedAdjustment !== undefined && displayedAdjustment !== 0 ? new Intl.NumberFormat("vi-VN").format(displayedAdjustment) : ""}
                            onChange={(e) => {
                              if (isLinkedToOrder) return;
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              setValue("surcharge", raw ? Number(raw) : undefined, { shouldDirty: true });
                            }}
                            disabled={!canUpdateSession || isLinkedToOrder}
                            placeholder="0"
                            className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                          />
                          {errors.surcharge && <p className="text-xs text-error">{errors.surcharge.message}</p>}
                        </label>

                        <div className="sm:col-span-2 space-y-3 rounded-xl border border-primary-500/20 bg-primary-500/5 px-4 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-foreground-muted">Chi tiết phiếu</span>
                            <span className="text-[11px] italic text-foreground-muted">
                              {isLinkedToOrder ? "Chỉ xem — sửa dịch vụ tại đơn POS" : "Cập nhật tự động theo phiếu"}
                            </span>
                          </div>

                          {spaServiceLines.length > 0 ? (
                            <div className="space-y-3">
                              {spaServiceLines.map((line, idx) => (
                                <SpaServiceLineRow
                                  key={line.key}
                                  line={line}
                                  index={idx + 1}
                                  disabled={!canUpdateSession}
                                  onQuantityChange={!isLinkedToOrder && line.source === "draft" && line.role === "EXTRA"
                                    ? (quantity) => updateExtraQuantity(line.pricingRuleId, quantity)
                                    : undefined}
                                  onRemove={!isLinkedToOrder && line.source === "draft" && line.role === "EXTRA"
                                    ? () => removeExtraService(line.pricingRuleId)
                                    : undefined}
                                />
                              ))}

                              {hasMultipleMainServices ? (
                                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                                  Phiếu này đang có nhiều dòng dịch vụ chính từ dữ liệu đơn cũ. Hệ thống hiển thị tất cả để tránh mất thông tin.
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-border px-4 py-4 text-center text-sm text-foreground-muted">
                              {isLinkedToOrder ? "Chưa đồng bộ được dòng dịch vụ từ đơn POS." : "Chưa có dịch vụ nào trên phiếu."}
                            </div>
                          )}
                        </div>


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



                {!isLinkedToOrder && (mode === "create" || activeSession) && (
                  <section className="rounded-2xl border border-border bg-card/80 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted flex items-center gap-2">
                        <ClipboardList size={13} />
                        Dịch vụ khác
                      </p>
                      <span className="text-[10px] text-foreground-muted italic">Có thể chọn nhiều dịch vụ</span>
                    </div>

                    {availableExtraRules.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {availableExtraRules.map((rule) => {
                          const selected = selectedExtraServices.some((service) => service.pricingRuleId === rule.id);
                          return (
                            <button
                              key={rule.id}
                              type="button"
                              disabled={!canUpdateSession || selected}
                              onClick={() => addExtraService(rule)}
                              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background-secondary px-3 py-2 text-left transition-colors hover:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">{rule.packageCode}</span>
                                <span className="text-[11px] text-foreground-muted">{rule.durationMinutes ? `${rule.durationMinutes} phút` : "Dịch vụ thêm"}</span>
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-foreground">
                                {new Intl.NumberFormat("vi-VN").format(rule.price)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border px-4 py-4 text-center text-sm text-foreground-muted">
                        Chưa có dịch vụ Khác phù hợp.
                      </div>
                    )}

                    {selectedExtraServices.length > 0 && spaServiceLines.length < 0 ? (
                      <div className="space-y-2 pt-2">
                        {selectedExtraServices.map((service) => (
                          <div key={service.pricingRuleId ?? service.name} className="grid grid-cols-[1fr_90px_110px_32px] items-center gap-2 rounded-xl border border-border/60 bg-background-base/60 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{service.name}</p>
                              <p className="text-[11px] text-foreground-muted">{new Intl.NumberFormat("vi-VN").format(service.price)} / lần</p>
                            </div>
                            <input
                              type="number"
                              min={1}
                              value={service.quantity ?? 1}
                              disabled={!canUpdateSession}
                              onChange={(event) => updateExtraQuantity(service.pricingRuleId, Number(event.target.value))}
                              className="h-9 rounded-lg border border-border bg-background-secondary px-2 text-sm text-foreground outline-none focus:border-primary-500"
                            />
                            <div className="text-right text-xs font-semibold text-foreground">
                              {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(service.price * (service.quantity ?? 1))}
                            </div>
                            <button
                              type="button"
                              disabled={!canUpdateSession}
                              onClick={() => removeExtraService(service.pricingRuleId)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center justify-between rounded-xl border border-primary-500/20 bg-primary-500/5 px-4 py-3">
                          <span className="text-sm font-medium text-foreground-muted">Tổng phiếu</span>
                          <span className="text-base font-semibold text-foreground">
                            {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(standaloneTotal)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </section>
                )}
              </form>

              <footer className="border-t border-border bg-background-base px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {canDeleteSession ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (await confirmDialog("Bạn có chắc muốn xóa phiên này?")) {
                            deleteMutation.mutate();
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-error transition-colors hover:bg-error/10 px-4"
                      >
                        <Trash2 size={16} />
                        Xóa
                      </button>
                    ) : null}
                    {isEditing && activeSession?.status === 'CANCELLED' && hasAnyPermission(['grooming.update']) ? (
                      <button
                        type="button"
                        disabled={revertCancelMutation.isPending}
                        onClick={() => revertCancelMutation.mutate()}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 text-sm font-semibold text-amber-600 transition-all hover:bg-amber-500/20 active:scale-95 disabled:opacity-50"
                      >
                        <RefreshCw size={15} className={revertCancelMutation.isPending ? 'animate-spin' : ''} />
                        Hoàn hủy
                      </button>
                    ) : null}
                  </div>

                  <div className="flex gap-3 *:flex-1">
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
              activeSession ? (
                <Tabs.Content value="history" className="flex-1 overflow-y-auto outline-none" >
                  <HistorySection timeline={activeSession.timeline || []} />
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
