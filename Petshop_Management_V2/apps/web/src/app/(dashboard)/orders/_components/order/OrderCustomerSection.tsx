'use client'

import { PosCustomerV1, type CustomerCallbacks } from '@/app/(dashboard)/pos/components/PosCustomerV1'

// OrderCustomerSection — wrapper around PosCustomerV1 với system design tokens.
// Dùng trong Orders module; không dùng POS store — mọi thứ qua callbacks.
// Style override: bg-background-secondary + border-border (thay cho POS bg-[#f4f6f9] + border-gray-200).
// Chỉ sửa file này khi cần override style; sửa logic → PosCustomerV1.

export type { CustomerCallbacks }

type OrderCustomerSectionProps = {
    customerId?: string
    customerName?: string
    isEditing: boolean
    onSelectCustomer: (id: string, name: string) => void
    onRemoveCustomer: () => void
    onSelectSuggestedService?: (service: any, petId: string, petName?: string) => void
}

export function OrderCustomerSection({
    customerId,
    customerName,
    isEditing,
    onSelectCustomer,
    onRemoveCustomer,
    onSelectSuggestedService,
}: OrderCustomerSectionProps) {
    const callbacks: CustomerCallbacks = {
        customerId,
        customerName,
        onSelectCustomer,
        onRemoveCustomer,
    }

    return (
        <div className="order-customer-section pointer-events-auto">
            <PosCustomerV1
                callbacks={callbacks}
                theme="system"
                onSelectSuggestedService={isEditing ? onSelectSuggestedService : undefined}
            />
        </div>
    )
}
