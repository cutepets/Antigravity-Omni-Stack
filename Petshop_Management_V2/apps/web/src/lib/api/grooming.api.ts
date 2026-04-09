import { api } from "@/lib/api";
import type { ApiResponse } from "@petshop/shared";

export type GroomingStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
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
  avatar?: string | null;
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
  createdAt: string;
  updatedAt?: string;
  pet: GroomingPet;
  staff: GroomingStaff | null;
  order?: {
    id: string;
    orderNumber: string;
  } | null;
}

export interface GetGroomingSessionsParams {
  status?: GroomingStatus;
  staffId?: string;
  startDate?: string;
  endDate?: string;
}

export type CreateGroomingPayload = {
  petId: string;
  branchId?: string;
  staffId?: string;
  serviceId?: string;
  startTime?: string;
  notes?: string;
};

export type UpdateGroomingPayload = Partial<CreateGroomingPayload> & {
  id: string;
  status?: GroomingStatus;
  endTime?: string;
  price?: number;
};

export const groomingApi = {
  getSessions: async (params?: GetGroomingSessionsParams) => {
    const res = await api.get<ApiResponse<GroomingSession[]>>("/grooming", {
      params,
    });
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

  updateSession: async (data: UpdateGroomingPayload) => {
    const { id, ...payload } = data;
    const res = await api.patch<ApiResponse<GroomingSession>>(
      `/grooming/${id}`,
      payload,
    );
    return res.data.data;
  },

  deleteSession: async (id: string) => {
    const res = await api.delete<ApiResponse<{ success: boolean }>>(
      `/grooming/${id}`,
    );
    return res.data.data;
  },
};
