'use client';

import { X } from 'lucide-react';
import { money, moneyRaw } from '@/app/(dashboard)/_shared/payment/payment.utils';
import type { PosCartDiscountEditorProps } from './PosCartTypes';

export function PosCartDiscountEditor({
    item,
    discountedUnitPrice,
    itemDiscountAmount,
    itemDiscountPercent,
    isOpen,
    onClose,
    onOpen,
    store,
    callbacks,
    mobile = false,
}: PosCartDiscountEditorProps) {
    const updateDiscount = (value: number) =>
        callbacks ? callbacks.onUpdateDiscountItem(item.id, value) : store?.updateDiscountItem(item.id, value);

    return (
        <>
            {isOpen ? (
                <>
                    <div className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
                    <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 w-72 z-50 p-4 animate-in fade-in zoom-in-95 duration-200 cursor-default text-left shadow-primary-500/10">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                            <h4 className="font-bold text-gray-800 text-[15px]">Cài đặt giá &amp; Chiết khấu</h4>
                            <button className="text-gray-400 hover:text-gray-600 transition-colors" onClick={onClose}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[13px] font-medium text-gray-600 mb-1">CK (VNĐ)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full text-right text-[14px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 outline-none focus:border-amber-500 pr-6 transition-colors placeholder:text-amber-300"
                                            placeholder="0"
                                            value={item.discountItem ? money(item.discountItem) : ''}
                                            onChange={(event) => {
                                                const value = parseInt(event.target.value.replace(/\D/g, ''), 10);
                                                updateDiscount(Number.isNaN(value) ? 0 : value);
                                            }}
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-medium text-amber-500 select-none">đ</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium text-gray-600 mb-1">CK (%)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full text-right text-[14px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 outline-none focus:border-amber-500 pr-6 transition-colors placeholder:text-amber-300"
                                            placeholder="0"
                                            value={itemDiscountAmount > 0 && item.unitPrice ? itemDiscountPercent : ''}
                                            onChange={(event) => {
                                                const value = parseFloat(event.target.value.replace(/[^\d.]/g, ''));
                                                const percent = Number.isNaN(value) ? 0 : Math.min(100, Math.max(0, value));
                                                updateDiscount(Math.round((item.unitPrice || 0) * (percent / 100)));
                                            }}
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-medium text-amber-500 select-none">%</span>
                                    </div>
                                </div>
                            </div>
                            {(item.discountItem ?? 0) > 0 ? (
                                <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-[13px]">
                                    <span className="text-gray-500">Giảm giá:</span>
                                    <span className="font-bold text-amber-600">-{money(itemDiscountAmount)} ({itemDiscountPercent}%)</span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </>
            ) : null}

            {mobile ? (
                <>
                    <div className="text-[15px] font-medium text-gray-800 cursor-pointer border-b border-dashed border-gray-300 hover:border-primary-500 group-hover:border-primary-500 transition-colors w-fit pb-0.5" onClick={onOpen}>
                        {moneyRaw(discountedUnitPrice)}
                    </div>
                    {itemDiscountAmount > 0 ? (
                        <div className="text-[11px] flex items-center gap-1 font-semibold text-amber-500 bg-amber-50 px-1 py-0.5 rounded w-fit mt-0.5">
                            <span>-{itemDiscountPercent}%</span>
                            <span className="opacity-70">(-{money(itemDiscountAmount)})</span>
                        </div>
                    ) : null}
                </>
            ) : (
                <div className="group/price relative cursor-pointer flex flex-col items-end" onClick={onOpen}>
                    <div className="text-[15px] font-medium text-gray-800 border-b border-dashed border-gray-300 hover:border-primary-500 group-hover/price:border-primary-500 transition-colors pb-0.5">
                        {money(discountedUnitPrice)}
                    </div>
                    {itemDiscountAmount > 0 ? (
                        <div className="flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-amber-500 bg-amber-50 px-1 py-0.5 rounded max-w-full">
                            <span>-{itemDiscountPercent}%</span>
                            <span className="opacity-70">(-{money(itemDiscountAmount)})</span>
                        </div>
                    ) : null}
                </div>
            )}
        </>
    );
}
