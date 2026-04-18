'use client'

import { PosProductSearch, type PosProductSearchProps } from '@/app/(dashboard)/pos/components/PosProductSearch'

// OrderProductSearch — wrapper around PosProductSearch với system design tokens.
// Dùng trong Orders module; KHÔNG dùng màu cố định của POS (bg-white, border-gray-200).
// Mọi thay đổi logic search → sửa PosProductSearch. Chỉ sửa file này khi cần override style.

type OrderProductSearchProps = PosProductSearchProps

export function OrderProductSearch(props: OrderProductSearchProps) {
    return (
        <PosProductSearch
            {...props}
            // Input container: dùng system tokens thay vì bg-white cố định
            containerClassName="order-search-container"
            // Dropdown panel: system bg + border, không phải POS light colors
            panelClassName={[
                // Mobile full-screen (giữ nguyên UX)
                'fixed inset-0 z-50 bg-background flex flex-col',
                // Desktop dropdown — system-themed
                'lg:block lg:absolute lg:top-full lg:left-0 lg:mt-1 lg:w-[500px]',
                'lg:bg-background lg:border lg:border-border',
                'lg:rounded-lg lg:shadow-xl lg:h-auto lg:max-h-[550px] lg:right-auto',
            ].join(' ')}
        />
    )
}
