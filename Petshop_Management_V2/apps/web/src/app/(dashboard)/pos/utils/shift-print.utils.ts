/**
 * Print utilities for Shift Closing Report (K80 thermal printer).
 * Extracted from PosShiftClosingModal để dễ test và tái sử dụng.
 */
import type { ShiftDenominations, ShiftSummary } from '@/lib/api/shift.api';

export const K80_PAGE_WIDTH = '80mm';

export const SHIFT_DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatShiftCurrency(value: number) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(value || 0));
}

export function formatShiftDateTime(value?: string | null) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function escapeHtml(value?: string | null) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// ── Denomination helpers ──────────────────────────────────────────────────────

export function normalizeDenominations(
    value?: import('@/lib/api/shift.api').CashDenomination[] | ShiftDenominations | null,
): ShiftDenominations {
    const result: ShiftDenominations = {};
    if (Array.isArray(value)) {
        for (const item of value) {
            result[String(item.value)] = Math.max(0, Number(item.quantity) || 0);
        }
    }
    for (const denomination of SHIFT_DENOMINATIONS) {
        if (result[String(denomination)] === undefined) {
            result[String(denomination)] = Math.max(
                0,
                Number(!Array.isArray(value) ? value?.[String(denomination)] : 0) || 0,
            );
        }
    }
    return result;
}

export function sumDenominations(value: ShiftDenominations) {
    return SHIFT_DENOMINATIONS.reduce((total, denomination) => {
        return total + denomination * (Number(value[String(denomination)]) || 0);
    }, 0);
}

// ── Print HTML builder ────────────────────────────────────────────────────────

export function buildShiftReportPrintHtml({
    modeLabel,
    branchName,
    branchAddress,
    staffName,
    openedAt,
    closedAt,
    summary,
}: {
    modeLabel: string;
    branchName: string;
    branchAddress?: string | null;
    staffName: string;
    openedAt?: string | null;
    closedAt?: string | null;
    summary: ShiftSummary | null;
}) {
    const reportRows = summary
        ? [
            ['Tiền mặt đầu ca', summary.openAmount, false],
            ['Thu phần mềm', (summary.orderCashIncome ?? 0) + (summary.manualCashIncome ?? 0), false],
            ['Chi phần mềm', (summary.orderCashExpense ?? 0) + (summary.manualCashExpense ?? 0), false],
            ['Bán được', summary.netCashAmount ?? 0, false],
            ['Thiếu két đầu ca', summary.reserveShortageAtOpen ?? 0, false],
            ['Bù két', summary.reserveTopUpAmount ?? 0, false],
            ['Thực rút', summary.withdrawableAmount ?? 0, false],
            ['Cần thu được', summary.expectedCloseAmount ?? 0, false],
            ['Thu CK/Thẻ', summary.nonCashIncome ?? 0, false],
            ['Chi CK/Thẻ', summary.nonCashExpense ?? 0, false],
            ['Số đơn giao dịch', summary.orderCount ?? 0, true],
            ['Số đơn trả/hoàn', summary.refundCount ?? 0, true],
        ]
        : [];

    const rowsHtml = reportRows
        .map(
            ([label, value, isCount]) => `
        <div class="line">
          <span>${escapeHtml(String(label))}</span>
          <strong>${isCount ? Number(value ?? 0) : formatShiftCurrency(Number(value ?? 0))}</strong>
        </div>
      `,
        )
        .join('');

    const paymentRows = summary?.otherPayments?.length
        ? summary.otherPayments
            .map(
                (payment) => `
            <div class="line compact">
              <span>${escapeHtml(payment.label)}</span>
              <span>+${formatShiftCurrency(payment.income)} / -${formatShiftCurrency(payment.expense)}</span>
            </div>
          `,
            )
            .join('')
        : '';

    return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>In báo cáo</title>
    <style>
      @page { size: ${K80_PAGE_WIDTH} auto; margin: 4mm; }
      * { box-sizing: border-box; }
      body {
        width: ${K80_PAGE_WIDTH};
        margin: 0 auto;
        padding: 0;
        font-family: Arial, sans-serif;
        font-size: 11px;
        line-height: 1.35;
        color: #111827;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .wrap { width: 100%; }
      .center { text-align: center; }
      .title { font-size: 15px; font-weight: 700; margin-bottom: 2px; text-transform: uppercase; }
      .sub { font-size: 10px; color: #475569; }
      .section { border-top: 1px dashed #94a3b8; margin-top: 8px; padding-top: 8px; }
      .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
      .line { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; padding: 2px 0; }
      .line.compact { font-size: 10px; color: #475569; }
      .line span:first-child { flex: 1; }
      .line strong { font-weight: 700; }
      .footer { border-top: 1px dashed #94a3b8; margin-top: 10px; padding-top: 8px; text-align: center; font-size: 10px; color: #64748b; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="center">
        <div class="title">${escapeHtml(modeLabel)}</div>
        <div class="sub">${escapeHtml(branchName)}</div>
        ${branchAddress ? `<div class="sub">${escapeHtml(branchAddress)}</div>` : ''}
      </div>
      <div class="section">
        <div class="section-title">Thông tin ca</div>
        <div class="line"><span>Chi nhánh</span><strong>${escapeHtml(branchName)}</strong></div>
        <div class="line"><span>Nhân viên</span><strong>${escapeHtml(staffName)}</strong></div>
        <div class="line"><span>Mở ca</span><strong>${escapeHtml(formatShiftDateTime(openedAt))}</strong></div>
        ${closedAt ? `<div class="line"><span>Chốt ca</span><strong>${escapeHtml(formatShiftDateTime(closedAt))}</strong></div>` : ''}
      </div>
      <div class="section">
        <div class="section-title">Báo cáo ca</div>
        ${rowsHtml || '<div class="sub">Chưa có dữ liệu báo cáo ca.</div>'}
        ${paymentRows ? `<div class="section"><div class="section-title">Thanh toán khác</div>${paymentRows}</div>` : ''}
      </div>
      <div class="footer">Báo cáo ca POS</div>
    </div>
  </body>
</html>`;
}
