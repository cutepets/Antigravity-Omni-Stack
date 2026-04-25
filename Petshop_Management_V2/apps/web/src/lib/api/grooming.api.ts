import { api } from "@/lib/api";
import type { ApiResponse } from "@petshop/shared";

export type GroomingStatus =
  | "BOOKED"
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "RETURNED"
  | "CANCELLED";


export interface GroomingCustomer {
  id?: string;
  fullName?: string;
  phone?: string;
}

export interface GroomingPet {
  id: string;
  petCode?: string | null;
  name?: string;
  species?: string | null;
  breed?: string | null;
  customer?: GroomingCustomer | null;
}

export interface GroomingStaff {
  id: string;
  fullName: string;
  staffCode?: string | null;
  avatar?: string | null;
}

export interface GroomingOrderItem {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
  discountItem?: number | null;
  type?: string | null;
  serviceId?: string | null;
  sku?: string | null;
  petId?: string | null;
  pricingSnapshot?: Record<string, unknown> | null;
}

export interface SpaExtraServiceLine {
  pricingRuleId?: string;
  orderItemId?: string;
  sku?: string | null;
  name: string;
  price: number;
  quantity?: number;
  durationMinutes?: number | null;
  discountItem?: number | null;
  total?: number;
}

export interface GroomingSessionPricingSnapshot {
  source?: string;
  packageCode?: string | null;
  mainPrice?: number | null;
  extraTotal?: number | null;
  totalPrice?: number | null;
  totalAmount?: number | null;
  grossAmount?: number | null;
  discountAmount?: number | null;
  weightBandLabel?: string | null;
  mainService?: {
    orderItemId?: string | null;
    name?: string | null;
    price?: number | null;
    quantity?: number | null;
    discountItem?: number | null;
    serviceId?: string | null;
    packageCode?: string | null;
    total?: number | null;
  } | null;
  extraServices?: SpaExtraServiceLine[];
  [key: string]: unknown;
}

export interface GroomingTimelineEntry {
  id: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  createdAt: string;
  performedByUser?: GroomingStaff | null;
}

export interface GroomingSession {
  id: string;
  sessionCode?: string | null;
  petId: string;
  petName: string;
  customerId: string | null;
  branchId?: string | null;
  staffId: string | null;
  serviceId: string | null;
  orderId?: string | null;
  status: GroomingStatus;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  price: number | null;
  surcharge?: number | null;
  packageCode?: string | null;
  weightAtBooking?: number | null;
  weightBandId?: string | null;
  weightBand?: { id: string; label: string } | null;
  pricingSnapshot?: GroomingSessionPricingSnapshot | null;
  extraServices?: SpaExtraServiceLine[];
  contactStatus?: 'CALLED' | 'UNCALLED' | null;
  createdAt: string;
  updatedAt?: string;
  pet: GroomingPet;
  staff: GroomingStaff | null;
  assignedStaff?: GroomingStaff[];
  branch: { id: string; name: string; code: string } | null;
  order?: {
    id: string;
    orderNumber: string;
    status?: string | null;
    paymentStatus?: string | null;
    total?: number | null;
    paidAmount?: number | null;
    remainingAmount?: number | null;
    staff?: { fullName: string } | null;
  } | null;
  orderItems?: GroomingOrderItem[];
  timeline?: GroomingTimelineEntry[];
}

export interface GetGroomingSessionsParams {
  status?: GroomingStatus;
  staffId?: string;
  startDate?: string;
  endDate?: string;
  omitBranchId?: boolean;
}

export type CreateGroomingPayload = {
  petId: string;
  branchId?: string;
  staffId?: string;
  staffIds?: string[];
  serviceId?: string;
  packageCode?: string;
  startTime?: string;
  notes?: string;
  price?: number;
  surcharge?: number;
  extraServices?: SpaExtraServiceLine[];
};

export interface SpaPricePreview {
  petId: string;
  petName: string;
  species: string | null;
  weight: number;
  packageCode: string;
  price: number;
  durationMinutes?: number | null;
  weightBand: {
    id: string;
    label: string;
    minWeight: number;
    maxWeight: number | null;
  };
  pricingSnapshot: Record<string, unknown>;
}

export type UpdateGroomingPayload = Partial<CreateGroomingPayload> & {
  id: string;
  status?: GroomingStatus;
  contactStatus?: 'CALLED' | 'UNCALLED';
  endTime?: string;
  price?: number;
  staffIds?: string[];
  surcharge?: number;
};

export interface BulkDeleteResult {
  success: boolean;
  deletedIds: string[];
  blocked: Array<{ id: string; reason: string }>;
}

export const groomingApi = {
  getSessions: async (params?: GetGroomingSessionsParams) => {
    const { omitBranchId, ...restParams } = params || {};
    const config: any = { params: restParams };
    if (omitBranchId) {
      config.headers = { "X-Omit-Branch-ID": "true" };
    }
    const res = await api.get<ApiResponse<GroomingSession[]>>("/grooming", config);
    return res.data.data;
  },

  getSession: async (id: string) => {
    const res = await api.get<ApiResponse<GroomingSession>>(`/grooming/${id}`);
    return res.data.data;
  },

  createSession: async (data: CreateGroomingPayload) => {
    const res = await api.post<ApiResponse<GroomingSession>>("/grooming", data);
    return res.data.data;
  },

  calculatePrice: async (data: { petId: string; packageCode: string; weight?: number; species?: string }) => {
    const res = await api.post<ApiResponse<SpaPricePreview>>("/grooming/calculate", data);
    return res.data.data;
  },

  updateSession: async (data: UpdateGroomingPayload) => {
    const { id, ...payload } = data;
    const res = await api.patch<ApiResponse<GroomingSession>>(
      `/grooming/${id}`,
      payload,
    );
    return res.data.data;
  },

  getPackages: async (species?: string) => {
    const params = species ? { species } : {};
    const res = await api.get<ApiResponse<{ code: string; label: string }[]>>(
      "/grooming/packages",
      { params },
    );
    return res.data.data;
  },

  deleteSession: async (id: string) => {
    const res = await api.delete<ApiResponse<{ success: boolean }>>(
      `/grooming/${id}`,
    );
    return res.data.data;
  },

  bulkDeleteSessions: async (ids: string[]) => {
    const res = await api.post<BulkDeleteResult>("/grooming/bulk-delete", { ids });
    return res.data;
  },
};
