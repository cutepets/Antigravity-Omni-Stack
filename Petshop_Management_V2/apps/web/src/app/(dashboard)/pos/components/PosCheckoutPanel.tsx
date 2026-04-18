'use client';

import { useMemo, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { OrderTab, PaymentEntry } from '@petshop/shared';
import type { PaymentMethod } from '@/lib/api/settings.api';
import { getPaymentMethodColorClasses } from '@/lib/payment-methods';
import { money, moneyRaw } from '@/app/(dashboard)/_shared/payment/payment.utils';
import { Check, ChevronDown } from 'lucide-react';

type PosCheckoutPanelProps = {
  activeTab: OrderTab;
  cartCount: number;
  cartTotal: number;
  manualDiscountTotal: number;
  paymentMethods: PaymentMethod[];
  visiblePaymentMethods: PaymentMethod[];
  allowMultiPayment: boolean;
  tabPayments: PaymentEntry[];
  isMultiPaymentSummary: boolean;
  currentSinglePaymentMethod: PaymentMethod | null;
  currentSinglePaymentType: string;
  customerMoneyInput: string;
  setCustomerMoneyInput: Dispatch<SetStateAction<string>>;
  isPaymentMenuOpen: boolean;
  setIsPaymentMenuOpen: Dispatch<SetStateAction<boolean>>;
  paymentMenuRef: RefObject<HTMLDivElement | null>;
  guestMoney: number;
  returnMoney: number;
  multiPaymentTotal: number;
  quickCashSuggestions: number[];
  isQrIntentPending: boolean;
  onDiscountChange: (discount: number) => void;
  onSelectSinglePaymentMethod: (method: PaymentMethod) => void;
  onOpenMultiPayment: () => void;
  onOpenBooking: () => void;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
};

export function PosCheckoutPanel({
  activeTab,
  cartCount,
  cartTotal,
  manualDiscountTotal,
  paymentMethods,
  visiblePaymentMethods,
  allowMultiPayment,
  tabPayments,
  isMultiPaymentSummary,
  currentSinglePaymentMethod,
  currentSinglePaymentType,
  customerMoneyInput,
  setCustomerMoneyInput,
  isPaymentMenuOpen,
  setIsPaymentMenuOpen,
  paymentMenuRef,
  guestMoney,
  returnMoney,
  multiPaymentTotal,
  quickCashSuggestions,
  isQrIntentPending,
  onDiscountChange,
  onSelectSinglePaymentMethod,
  onOpenMultiPayment,
  onOpenBooking,
  onPrimaryAction,
  primaryActionLabel,
}: PosCheckoutPanelProps) {
  const rawSubtotal = useMemo(
    () => activeTab.cart.reduce((sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 1), 0),
    [activeTab.cart],
  );
  const totalItemDiscount = useMemo(
    () => activeTab.cart.reduce((sum, item) => sum + ((item.discountItem || 0) * (item.quantity || 1)), 0),
    [activeTab.cart],
  );

  return (
    <>
      <div className="order-4 lg:col-start-2 lg:row-start-2 bg-white lg:border-l border-gray-200 z-20 flex-1 flex flex-col p-4 overflow-y-auto">
        <div className="mt-auto flex flex-col gap-4">
          <div className="flex justify-between items-center py-1">
            <span className="text-[15px] font-medium text-gray-600">Tổng tiền ({cartCount} SP)</span>
            <span className="text-[15px] font-bold">{moneyRaw(rawSubtotal)}</span>
          </div>

          {totalItemDiscount > 0 ? (
            <div className="flex justify-between items-center py-1 text-[15px] text-amber-600">
              <span>Chiết khấu SP</span>
              <span className="font-semibold">-{moneyRaw(totalItemDiscount)}</span>
            </div>
          ) : null}

          <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-300 pb-3">
            <span className="text-[15px] text-primary-600 cursor-pointer hover:underline decoration-dashed decoration-primary-400 underline-offset-4">
              Chiết khấu đơn (F6)
            </span>
            <div className="flex items-center">
              <input
                className="w-24 text-right text-[15px] border-b border-gray-300 outline-none focus:border-primary-500 pb-0.5"
                value={manualDiscountTotal > 0 ? money(manualDiscountTotal) : '0'}
                onChange={(e) => {
                  const value = parseInt(e.target.value.replace(/\D/g, ''), 10);
                  onDiscountChange(Number.isNaN(value) ? 0 : value);
                }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-[15px] font-medium text-gray-600">VAT (0%)</span>
            <span className="text-[15px] font-semibold text-gray-800">0</span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-[14px] sm:text-[15px] font-bold text-gray-800">KHÁCH PHẢI TRẢ</span>
            <span className="text-[18px] sm:text-[20px] font-bold text-red-600">{moneyRaw(cartTotal)}</span>
          </div>

          <div className="mt-1 sm:mt-2 rounded-2xl border border-gray-200 bg-gray-50/80 p-3 sm:p-4">
            {isMultiPaymentSummary ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] sm:text-[15px] font-medium text-gray-600">Khách đưa</span>
                  {allowMultiPayment ? (
                    <button
                      type="button"
                      onClick={onOpenMultiPayment}
                      className="text-xs font-semibold text-primary-600 hover:underline"
                    >
                      Nhiều hình thức
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {tabPayments.map((payment, index) => {
                    const method =
                      (payment.paymentAccountId
                        ? visiblePaymentMethods.find((item) => item.id === payment.paymentAccountId) ??
                          paymentMethods.find((item) => item.id === payment.paymentAccountId)
                        : null) ?? null;
                    const colorClasses = getPaymentMethodColorClasses(method?.type ?? 'CASH', method?.colorKey);

                    return (
                      <div
                        key={`${payment.paymentAccountId ?? payment.method}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClasses.chip}`}>
                            {method?.name ?? payment.paymentAccountLabel ?? payment.method}
                          </span>
                          <span className="truncate text-xs text-gray-400">{payment.method}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-800">{moneyRaw(Number(payment.amount) || 0)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1 border-t border-dashed border-gray-300 pt-2 sm:pt-3">
                  <div className="flex items-center justify-between text-[13px] sm:text-sm">
                    <span className="font-medium text-gray-500">Tổng khách đưa</span>
                    <span className={`font-bold ${multiPaymentTotal >= cartTotal ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {moneyRaw(multiPaymentTotal)}
                    </span>
                  </div>
                  <div className={`text-[11px] sm:text-xs font-semibold ${multiPaymentTotal >= cartTotal ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {multiPaymentTotal >= cartTotal ? 'Đã đủ thanh toán' : `Còn thiếu ${moneyRaw(cartTotal - multiPaymentTotal)}`}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-1.5 sm:gap-3">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 justify-start">
                    <span
                      className="shrink-0 text-[14px] sm:text-[15px] font-medium text-gray-600 cursor-pointer"
                      onClick={() => document.getElementById('customer_money_input')?.focus()}
                    >
                      Khách đưa (F8)
                    </span>

                    <div ref={paymentMenuRef} className="relative shrink-0 min-w-0">
                      <button
                        type="button"
                        onClick={() => setIsPaymentMenuOpen((current) => !current)}
                        className={`inline-flex items-center max-w-[130px] sm:max-w-[160px] lg:max-w-[140px] gap-1 sm:gap-2 rounded-full border px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold shadow-sm overflow-hidden ${getPaymentMethodColorClasses(currentSinglePaymentMethod?.type ?? 'CASH', currentSinglePaymentMethod?.colorKey).chip}`}
                      >
                        <span className="truncate">{currentSinglePaymentMethod?.name ?? 'Chọn...'}</span>
                        <ChevronDown size={14} className="shrink-0" />
                      </button>

                      {isPaymentMenuOpen ? (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full z-40 mb-2 w-[260px] sm:w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                          <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
                            {visiblePaymentMethods.map((method) => {
                              const colorClasses = getPaymentMethodColorClasses(method.type, method.colorKey);
                              return (
                                <button
                                  key={method.id}
                                  type="button"
                                  onClick={() => onSelectSinglePaymentMethod(method)}
                                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-50"
                                >
                                  <div className="flex items-center gap-2 overflow-hidden min-w-0">
                                    <span className={`inline-flex shrink-0 h-2.5 w-2.5 rounded-full ${colorClasses.accent}`} />
                                    <span className="truncate text-[13.5px] font-semibold text-gray-800">{method.name}</span>
                                    <span className="shrink-0 ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                                      {method.type}
                                    </span>
                                  </div>
                                  {currentSinglePaymentMethod?.id === method.id ? (
                                    <span className="text-primary-600 shrink-0 ml-2 block">
                                      <Check size={16} />
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}

                            {allowMultiPayment ? (
                              <button
                                type="button"
                                onClick={onOpenMultiPayment}
                                className="mt-1 flex w-full items-center justify-between rounded-xl border border-dashed border-primary-300 bg-primary-50 px-3 py-2.5 text-left text-[13.5px] font-semibold text-primary-700 transition-colors hover:bg-primary-100"
                              >
                                <span>Nhiều hình thức</span>
                                <ChevronDown size={14} className="-rotate-90" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 text-right pl-1 pointer-events-auto">
                    {currentSinglePaymentType === 'CASH' ? (
                      <input
                        id="customer_money_input"
                        className="w-20 sm:w-32 border-b border-gray-300 bg-transparent pb-0.5 text-right text-[15px] sm:text-base font-semibold outline-none focus:border-primary-500"
                        value={customerMoneyInput}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setCustomerMoneyInput(value ? money(parseInt(value, 10)) : '');
                        }}
                        placeholder={money(cartTotal)}
                      />
                    ) : (
                      <span className="text-base font-semibold text-gray-800">{moneyRaw(cartTotal)}</span>
                    )}
                  </div>
                </div>

                {currentSinglePaymentType === 'CASH' ? (
                  <div className="grid grid-cols-3 gap-2">
                    {quickCashSuggestions.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setCustomerMoneyInput(money(amount))}
                        className="rounded-full bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-gray-50 hover:text-gray-800"
                      >
                        {money(amount)}
                      </button>
                    ))}
                  </div>
                ) : currentSinglePaymentMethod?.type === 'BANK' && currentSinglePaymentMethod.accountNumber ? (
                  <div className="truncate rounded-xl bg-gray-50 px-3 py-2 text-[13.5px] text-gray-600 font-medium tracking-tight">
                    {currentSinglePaymentMethod.bankName} • {currentSinglePaymentMethod.accountNumber}
                    {currentSinglePaymentMethod.accountHolder ? ` • ${currentSinglePaymentMethod.accountHolder}` : ''}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-[15px] text-gray-500">
              {isMultiPaymentSummary ? 'Trạng thái thanh toán' : 'Tiền thừa'}
            </span>
            <span
              className={`text-[15px] font-bold ${
                isMultiPaymentSummary
                  ? multiPaymentTotal >= cartTotal
                    ? 'text-emerald-600'
                    : 'text-rose-500'
                  : returnMoney > 0
                    ? 'text-gray-800'
                    : 'text-gray-400'
              }`}
            >
              {isMultiPaymentSummary
                ? multiPaymentTotal >= cartTotal
                  ? 'Đã đủ'
                  : `Còn thiếu ${moneyRaw(cartTotal - multiPaymentTotal)}`
                : guestMoney === 0
                  ? '0'
                  : moneyRaw(returnMoney)}
            </span>
          </div>
        </div>
      </div>

      <div className="order-5 lg:col-start-2 lg:row-start-3 bg-gray-50 border-t border-b lg:border-b-0 lg:border-l border-gray-200 z-20 p-4 flex flex-col gap-3 shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
        <div className="grid grid-cols-1 gap-3">
          <button
            className="py-2.5 bg-white border border-gray-300 hover:border-primary-500 text-gray-700 rounded-lg text-[13px] font-bold uppercase transition-colors flex items-center justify-center shadow-sm"
            onClick={onOpenBooking}
            disabled={cartCount === 0}
          >
            ĐẶT HÀNG
          </button>
        </div>

        <button
          className={`w-full py-4 text-white text-lg font-bold rounded-lg uppercase shadow-lg transition-transform active:scale-[0.98] ${
            cartCount > 0 ? 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/30' : 'bg-gray-400 cursor-not-allowed shadow-none'
          }`}
          onClick={onPrimaryAction}
          disabled={cartCount === 0 || isQrIntentPending}
        >
          {primaryActionLabel}
        </button>
      </div>
    </>
  );
}
