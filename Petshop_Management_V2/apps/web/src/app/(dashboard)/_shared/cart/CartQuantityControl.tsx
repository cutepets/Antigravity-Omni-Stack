'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import {
    formatCartQuantityInput,
    getCartQuantityStep,
    parseCartQuantityInput,
    roundCartQuantity,
} from './cart.utils'
import type { CartQuantityControlProps } from './cart.types'

/**
 * CartQuantityControl — Shared quantity +/- control cho POS và Orders.
 * Không phụ thuộc POS store, chỉ dùng callback `onUpdateQuantity`.
 */
export function CartQuantityControl({
    item,
    isOverSellableQty,
    onUpdateQuantity,
    mobile = false,
}: CartQuantityControlProps) {
    const quantityStep = getCartQuantityStep(item)
    const [draftQuantity, setDraftQuantity] = useState(() =>
        formatCartQuantityInput(item.quantity ?? quantityStep, quantityStep),
    )

    useEffect(() => {
        setDraftQuantity(formatCartQuantityInput(item.quantity ?? quantityStep, quantityStep))
    }, [item.quantity, quantityStep])

    const commitQuantity = (rawValue: string) => {
        const parsed = parseCartQuantityInput(rawValue)
        const nextQuantity = Number.isNaN(parsed)
            ? quantityStep
            : roundCartQuantity(Math.max(quantityStep, parsed), quantityStep)
        onUpdateQuantity(item.id, nextQuantity)
        setDraftQuantity(formatCartQuantityInput(nextQuantity, quantityStep))
    }

    const isHotel = item.type === 'hotel'

    return (
        <div
            className={[
                'flex items-center rounded overflow-hidden transition-colors',
                mobile ? 'h-[32px]' : 'h-8',
                isHotel
                    ? 'border-gray-200 bg-gray-50'
                    : isOverSellableQty
                        ? 'border border-red-500 bg-red-50 text-red-600'
                        : 'border border-gray-300 bg-white text-gray-700',
                !mobile && !isOverSellableQty && !isHotel ? 'focus-within:border-primary-500' : '',
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <button
                className={[
                    'h-full transition-colors',
                    mobile ? 'px-2.5 flex items-center justify-center' : 'px-2',
                    isHotel
                        ? 'text-gray-400 cursor-not-allowed opacity-50'
                        : isOverSellableQty
                            ? mobile
                                ? 'hover:bg-red-100'
                                : 'text-red-600 hover:bg-red-100'
                            : mobile
                                ? 'hover:bg-gray-100'
                                : 'text-gray-500 hover:bg-gray-100',
                ]
                    .filter(Boolean)
                    .join(' ')}
                disabled={isHotel}
                onClick={() => {
                    const nextQuantity = roundCartQuantity(
                        Math.max(quantityStep, (item.quantity ?? quantityStep) - quantityStep),
                        quantityStep,
                    )
                    onUpdateQuantity(item.id, nextQuantity)
                    setDraftQuantity(formatCartQuantityInput(nextQuantity, quantityStep))
                }}
            >
                <Minus size={mobile ? 16 : 14} />
            </button>

            <input
                id={`${mobile ? 'quantity-input-mobile' : 'quantity-input'}-${item.id}`}
                type="text"
                disabled={isHotel}
                inputMode="decimal"
                value={draftQuantity}
                onChange={(event) => setDraftQuantity(event.target.value)}
                onBlur={(event) => commitQuantity(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        commitQuantity(event.currentTarget.value)
                        event.currentTarget.blur()
                    }
                    if (event.key === 'Escape') {
                        setDraftQuantity(formatCartQuantityInput(item.quantity ?? quantityStep, quantityStep))
                        event.currentTarget.blur()
                    }
                }}
                className={[
                    'text-center font-bold outline-none border-none h-full',
                    mobile ? 'w-10 text-[14px]' : 'w-10 text-[15px]',
                    isHotel
                        ? 'bg-gray-50 text-gray-500'
                        : isOverSellableQty
                            ? 'bg-red-50 text-red-600'
                            : mobile
                                ? 'bg-transparent text-gray-700'
                                : 'bg-transparent text-gray-900',
                ]
                    .filter(Boolean)
                    .join(' ')}
            />

            <button
                className={[
                    'h-full transition-colors',
                    mobile ? 'px-2.5 flex items-center justify-center' : 'px-2',
                    isHotel
                        ? 'text-gray-400 cursor-not-allowed opacity-50'
                        : isOverSellableQty
                            ? mobile
                                ? 'hover:bg-red-100'
                                : 'text-red-600 hover:bg-red-100'
                            : mobile
                                ? 'hover:bg-gray-100'
                                : 'text-gray-500 hover:bg-gray-100',
                ]
                    .filter(Boolean)
                    .join(' ')}
                disabled={isHotel}
                onClick={() => {
                    const nextQuantity = roundCartQuantity(
                        (item.quantity ?? quantityStep) + quantityStep,
                        quantityStep,
                    )
                    onUpdateQuantity(item.id, nextQuantity)
                    setDraftQuantity(formatCartQuantityInput(nextQuantity, quantityStep))
                }}
            >
                <Plus size={mobile ? 16 : 14} />
            </button>
        </div>
    )
}
