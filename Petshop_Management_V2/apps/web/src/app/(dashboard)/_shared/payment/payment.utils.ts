/**
 * Shared payment utils — used by both POS and Order modules.
 * Money formatting, quick-cash suggestions, and input parsing.
 */

// ─── Formatters ───────────────────────────────────────────────────────────────

const _moneyFormatter = new Intl.NumberFormat('vi-VN')

/** Format a number as VND display string, e.g. 50000 → "50.000" */
export function money(n: number) {
    return _moneyFormatter.format(n)
}

// alias to satisfy legacy callers that used `moneyRaw`
export { money as moneyRaw }

// ─── Input Parsers ────────────────────────────────────────────────────────────

/** Strip non-digit chars and return a number. Used for cash input fields. */
export function parseMoneyInputValue(value: string) {
    const digits = value.replace(/\D/g, '')
    return digits ? Number(digits) : 0
}

/** Parse a decimal quantity input (allows comma as decimal separator). */
export function parseDecimalInput(value: string, fallback = 0) {
    const normalized = value.replace(/[^\d.,-]/g, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : fallback
}

// ─── Quick Cash Suggestions ───────────────────────────────────────────────────

/**
 * Given a cart total, return up to 6 rounded-up cash denominations for quick selection.
 * e.g. total=45000 → [50000, 60000, 100000, ...]
 */
export function buildQuickCashSuggestions(total: number): number[] {
    if (!Number.isFinite(total) || total <= 0) return []

    const steps = [2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000]
    const candidates = steps
        .map((step) => Math.ceil(total / step) * step)
        .filter((value) => value > total)

    return [...new Set(candidates)].sort((left, right) => left - right).slice(0, 6)
}
