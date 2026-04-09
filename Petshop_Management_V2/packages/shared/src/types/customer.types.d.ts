import type { CustomerTier } from './core.types.js';
export interface Customer {
    id: string;
    customerCode: string;
    fullName: string;
    phone: string;
    email?: string | null;
    address?: string | null;
    tier: CustomerTier;
    points: number;
    groupId?: string | null;
    notes?: string | null;
    debt?: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface CustomerGroup {
    id: string;
    name: string;
    color: string;
    pricePolicy?: string | null;
    discount: number;
    description?: string | null;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=customer.types.d.ts.map
