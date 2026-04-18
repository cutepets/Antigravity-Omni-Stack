'use client'

import { useState } from 'react'
import { Eye, EyeOff, ListChecks } from 'lucide-react'
import { PosProductSearch, type PosProductSearchProps } from '@/app/(dashboard)/pos/components/PosProductSearch'

// OrderProductSearch — search bar dùng system design tokens.
// Thêm toggles "Chọn nhiều" và "Ẩn hàng hết" giống POS.
// Không chứa business logic — tất cả delegate về PosProductSearch.

type OrderProductSearchProps = Omit<PosProductSearchProps, 'inputClassName' | 'containerClassName' | 'panelClassName'>

export function OrderProductSearch(props: OrderProductSearchProps) {
    const [outOfStockHidden, setOutOfStockHidden] = useState(false)

    return (
        <div className="flex flex-1 items-center gap-2 min-w-0">
            <PosProductSearch
                {...props}
                outOfStockHidden={outOfStockHidden}
                // System-themed input wrapper (thay cho POS bg-white)
                inputClassName={[
                    'bg-background-secondary/60 border border-border',
                    'focus-within:border-primary-500 focus-within:bg-background',
                ].join(' ')}
                // System-themed dropdown panel
                panelClassName={[
                    'fixed inset-0 z-50 bg-background flex flex-col',
                    'lg:block lg:absolute lg:top-full lg:left-0 lg:mt-1 lg:w-[500px]',
                    'lg:bg-background lg:border lg:border-border',
                    'lg:rounded-lg lg:shadow-xl lg:h-auto lg:max-h-[550px] lg:right-auto',
                ].join(' ')}
            />

            {/* Toggle: Ẩn hàng hết */}
            <button
                type="button"
                title={outOfStockHidden ? 'Đang ẩn hàng hết — bấm để hiện lại' : 'Ẩn hàng hết hàng'}
                onClick={() => setOutOfStockHidden((v) => !v)}
                className={[
                    'shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border transition-colors duration-150',
                    outOfStockHidden
                        ? 'border-primary-500/40 bg-primary-500/10 text-primary-600'
                        : 'border-border bg-background-secondary/50 text-foreground-muted hover:border-border-strong hover:text-foreground',
                ].join(' ')}
            >
                {outOfStockHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>

            {/* Toggle: Chọn nhiều */}
            <button
                type="button"
                title={props.isMultiSelectValue ? 'Đang chọn nhiều — bấm để tắt' : 'Bật chọn nhiều sản phẩm'}
                onClick={() => props.onSetMultiSelect?.(!props.isMultiSelectValue)}
                className={[
                    'shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border transition-colors duration-150',
                    props.isMultiSelectValue
                        ? 'border-primary-500/40 bg-primary-500/10 text-primary-600'
                        : 'border-border bg-background-secondary/50 text-foreground-muted hover:border-border-strong hover:text-foreground',
                ].join(' ')}
            >
                <ListChecks size={14} />
            </button>
        </div>
    )
}
