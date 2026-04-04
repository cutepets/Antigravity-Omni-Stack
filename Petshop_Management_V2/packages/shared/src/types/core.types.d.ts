export interface ApiResponse<T = unknown> {
    success: true;
    data: T;
}
export interface ApiError {
    success: false;
    message: string;
    statusCode?: number;
    errors?: Record<string, string[]>;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface ListParams {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface JwtPayload {
    userId: string;
    role: StaffRole | string;
    permissions?: string[];
    iat: number;
    exp: number;
}
export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
}
export interface BaseBranch {
    id: string;
    name: string;
    address?: string | null;
    isActive: boolean;
}
export interface AuthUser {
    id: string;
    username: string;
    fullName: string;
    role: StaffRole | string;
    staffCode: string;
    branchId?: string | null;
    avatar?: string | null;
    authorizedBranches: BaseBranch[];
    permissions?: string[];
}
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'COMPLETED' | 'REFUNDED';
export type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';
export type StaffStatus = 'PROBATION' | 'OFFICIAL' | 'LEAVE' | 'LEAVING' | 'RESIGNED' | 'QUIT' | 'WORKING';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type ServiceType = 'GROOMING' | 'HOTEL' | 'MEDICAL' | 'TRAINING' | 'DAYCARE' | 'OTHER';
export type GroomingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type HotelStatus = 'BOOKED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
export type HotelLineType = 'REGULAR' | 'HOLIDAY';
export type CustomerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type PetGender = 'MALE' | 'FEMALE' | 'UNKNOWN';
//# sourceMappingURL=core.types.d.ts.map