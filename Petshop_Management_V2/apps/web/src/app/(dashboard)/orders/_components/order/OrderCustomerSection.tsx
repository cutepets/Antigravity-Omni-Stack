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
        // Override POS light-only colors với CSS variables hệ thống
        <div className="order-customer-section [&_.bg-\[#f4f6f9\]]:bg-background-secondary! [&_.border-gray-200]:border-border! [&_.text-\[#2a3042\]]:text-foreground! [&_.text-\[#555b6d\]]:text-foreground-muted! [&_.bg-white]:bg-background! [&_.border-b.border-gray-200]:border-border! pointer-events-auto">
            <PosCustomerV1
                callbacks={callbacks}
                onSelectSuggestedService={isEditing ? onSelectSuggestedService : undefined}
            />
        </div>
    )
}
