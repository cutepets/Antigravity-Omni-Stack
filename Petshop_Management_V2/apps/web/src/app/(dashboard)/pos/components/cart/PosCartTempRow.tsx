'use client';

import { useEffect, useState } from 'react';
import { Package2, Pencil, Trash2, X } from 'lucide-react';
import type { CartItem } from '@petshop/shared';
import type { CartItemCallbacks } from './PosCartTypes';
import { PosCartQuantityControl } from './PosCartQuantityControl';

// ── Excel-style cart row for temp products ────────────────────────────────────
export function TempCartRow({
    item,
    idx,
    selectedRowIndex,
    store,
    callbacks,
    removeItem,
}: {
    item: CartItem;
    idx: number;
    selectedRowIndex: number;
    store: any;
    callbacks?: CartItemCallbacks;
    removeItem: () => void;
}) {
    const [descDraft, setDescDraft] = useState(item.description || '');
    const [unitDraft, setUnitDraft] = useState((item as any).unit || 'Cái');
    const [priceDraft, setPriceDraft] = useState(item.unitPrice ? String(item.unitPrice) : '');
    const currentQuantity = item.quantity || 1;
    const price = parseFloat(priceDraft.replace(/[^\d]/g, '')) || 0;
    const total = price * currentQuantity;

    const saveDesc = (val: string) => {
        const v = val.trim();
        if (v !== item.description) {
            store?.updateItemDescription?.(item.id, v);
        }
    };
    const saveUnit = (val: string) => {
        const u = val.trim() || 'Cái';
        if (u !== (item as any).unit) {
            store?.updateItemUnit?.(item.id, u);
        }
        setUnitDraft(u);
    };
    const savePrice = (val: string) => {
        const p = parseFloat(val.replace(/[^\d]/g, '')) || 0;
        if (p !== item.unitPrice) {
            store?.updateItemPrice?.(item.id, p);
        }
        setPriceDraft(p ? p.toLocaleString('vi-VN') : '');
    };

    useEffect(() => {
        if (item.unitPrice) {
            setPriceDraft(item.unitPrice.toLocaleString('vi-VN'));
        }
    }, [item.unitPrice]);

    const cellStyle: React.CSSProperties = {
        color: 'var(--color-foreground, #1f2937)',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: '1px solid transparent',
        outline: 'none',
        fontSize: '14px',
        fontWeight: 500,
        padding: '2px 4px',
        width: '100%',
        cursor: 'text',
        transition: 'border-color 0.15s',
    };
    const cellFocusStyle = '1px solid #0089A1';

    return (
        <div
            id={`cart-row-${item.id}`}
            className={`flex flex-col border-b hover:bg-amber-50/40 transition-colors group border-l-2 ${idx === selectedRowIndex ? 'bg-amber-100 border-l-amber-500' : 'border-l-transparent'}`}
            style={{ borderBottomColor: '#fcd34d' }}
        >
            {/* Desktop row */}
            <div className="hidden lg:grid grid-cols-[40px_30px_60px_1fr_80px_120px_120px_120px] gap-2 items-center px-4 py-2">
                <div style={{ textAlign: 'center', color: '#92400e', fontSize: '13px', fontWeight: 600 }}>{idx + 1}</div>

                <div className="flex justify-center">
                    <button
                        onClick={removeItem}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Xóa"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                <div className="flex justify-center">
                    <div style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package2 size={16} style={{ color: '#d97706' }} />
                    </div>
                </div>

                {/* Name — editable */}
                <div style={{ minWidth: 0 }}>
                    <input
                        autoFocus={!item.description}
                        type="text"
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                        onBlur={(e) => saveDesc(e.target.value)}
                        onFocus={(e) => { e.currentTarget.style.borderBottomColor = cellFocusStyle; }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                                saveDesc(e.currentTarget.value);
                                if (e.key === 'Tab') { e.preventDefault(); e.currentTarget.closest('.lg\\:grid')?.querySelectorAll('input')[1]?.focus(); }
                            }
                        }}
                        placeholder="Thêm sản phẩm tạm"
                        style={{ ...cellStyle, color: descDraft ? 'var(--color-foreground, #1f2937)' : 'var(--color-foreground-muted, #6b7280)', fontStyle: descDraft ? 'normal' : 'italic' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = '#fcd34d'; }}
                        onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderBottomColor = 'transparent'; }}
                    />
                </div>

                {/* Unit */}
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        value={unitDraft}
                        onChange={(e) => setUnitDraft(e.target.value)}
                        onBlur={(e) => saveUnit(e.target.value)}
                        onFocus={(e) => { e.currentTarget.style.borderBottomColor = cellFocusStyle; e.currentTarget.select(); }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                                saveUnit(e.currentTarget.value);
                                if (e.key === 'Tab') { e.preventDefault(); e.currentTarget.closest('.lg\\:grid')?.querySelectorAll('input')[2]?.focus(); }
                            }
                        }}
                        placeholder="Cái"
                        style={{ ...cellStyle, textAlign: 'center', fontSize: 13, padding: '2px' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = '#fcd34d'; }}
                        onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderBottomColor = 'transparent'; }}
                    />
                </div>

                {/* Quantity */}
                <div className="flex justify-center">
                    <PosCartQuantityControl item={item} isOverSellableQty={false} store={store} callbacks={callbacks} />
                </div>

                {/* Price — editable */}
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={priceDraft}
                        onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d]/g, '');
                            if (!raw) {
                                setPriceDraft('');
                            } else {
                                setPriceDraft(parseFloat(raw).toLocaleString('vi-VN'));
                            }
                        }}
                        onBlur={(e) => savePrice(e.target.value)}
                        onFocus={(e) => { e.currentTarget.style.borderBottomColor = cellFocusStyle; e.currentTarget.select(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { savePrice(e.currentTarget.value); e.currentTarget.blur(); } }}
                        placeholder="0"
                        style={{ ...cellStyle, textAlign: 'right', paddingRight: 16 }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = '#fcd34d'; }}
                        onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderBottomColor = 'transparent'; }}
                    />
                    <span style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9ca3af', pointerEvents: 'none' }}>đ</span>
                </div>

                {/* Total */}
                <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 700, color: total > 0 ? 'var(--color-foreground, #1f2937)' : 'var(--color-foreground-muted, #9ca3af)' }}>
                    {total > 0 ? total.toLocaleString('vi-VN') : 'đ'}
                </div>
            </div>
        </div>
    );
}

// ── Inline editable row for temp product ─────────────────────────────────────
export function TempProductInlineRow({
    onConfirm,
    onCancel,
}: {
    onConfirm: (item: { description: string; quantity: number; unitPrice: number }) => void;
    onCancel: () => void;
}) {
    const [description, setDescription] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [unitPrice, setUnitPrice] = useState('');

    const commit = () => {
        const desc = description.trim();
        const qty = Math.max(1, parseFloat(quantity) || 1);
        const price = parseFloat(unitPrice.replace(/[^\d.]/g, '')) || 0;
        if (!desc) return;
        onConfirm({ description: desc, quantity: qty, unitPrice: price });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') onCancel();
    };

    const inputBase: React.CSSProperties = {
        color: 'var(--color-foreground, #1f2937)',
        backgroundColor: 'var(--color-surface, #fff)',
        border: '1px solid #93c5fd',
        borderRadius: '6px',
        outline: 'none',
        fontSize: '14px',
        padding: '6px 10px',
    };

    return (
        <div style={{ borderBottom: '1px solid #bfdbfe', backgroundColor: '#eff6ff' }}>
            {/* Desktop inline row */}
            <div className="hidden lg:grid grid-cols-[40px_30px_60px_1fr_80px_120px_120px_120px] gap-2 items-center px-4 py-2">
                <div className="flex justify-center">
                    <Package2 size={16} style={{ color: '#0089A1' }} />
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={onCancel}
                        style={{ padding: '6px', color: '#9ca3af', borderRadius: '4px', cursor: 'pointer' }}
                        title="Hủy"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div />

                <input
                    autoFocus
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tên sản phẩm..."
                    style={{ ...inputBase, width: '100%' }}
                />

                <div className="text-center text-[13px] text-gray-400">cái</div>

                <div className="flex justify-center">
                    <input
                        type="text"
                        inputMode="decimal"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{ ...inputBase, width: '72px', textAlign: 'center', fontWeight: 700 }}
                    />
                </div>

                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value.replace(/[^\d]/g, ''))}
                        onKeyDown={handleKeyDown}
                        placeholder="0"
                        style={{ ...inputBase, width: '100%', textAlign: 'right', paddingRight: '20px' }}
                    />
                    <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#6b7280', pointerEvents: 'none' }}>đ</span>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={commit}
                        disabled={!description.trim()}
                        style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#fff',
                            backgroundColor: description.trim() ? '#0089A1' : '#9ca3af',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: description.trim() ? 'pointer' : 'not-allowed',
                        }}
                    >
                        Xác nhận
                    </button>
                </div>
            </div>

            {/* Mobile fallback */}
            <div className="lg:hidden flex items-center gap-3 px-3 py-2">
                <Package2 size={18} style={{ color: '#0089A1', flexShrink: 0 }} />
                <input
                    autoFocus
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tên sản phẩm..."
                    style={{ ...inputBase, flex: 1 }}
                />
                <button onClick={commit} disabled={!description.trim()} style={{ padding: '6px 10px', color: '#fff', backgroundColor: '#0089A1', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
                    OK
                </button>
                <button onClick={onCancel} style={{ padding: '4px', color: '#9ca3af' }}>
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}

// ── Inline name editor for temp items already in cart ─────────────────────────
export function TempItemNameEditor({
    description,
    onSave,
}: {
    description: string;
    onSave: (newDesc: string) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(description);

    if (editing) {
        return (
            <input
                autoFocus
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                    if (draft.trim()) onSave(draft.trim());
                    setEditing(false);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        if (draft.trim()) onSave(draft.trim());
                        setEditing(false);
                    }
                    if (e.key === 'Escape') {
                        setDraft(description);
                        setEditing(false);
                    }
                }}
                className="truncate shrink min-w-0 border-b border-primary-400 bg-transparent outline-none text-[15px] font-semibold text-gray-800 w-40"
            />
        );
    }

    return (
        <div className="flex items-center gap-1 min-w-0 max-w-full">
            <span className="truncate shrink text-amber-700">{description}</span>
            <button
                onClick={() => { setDraft(description); setEditing(true); }}
                className="shrink-0 p-0.5 text-gray-400 hover:text-primary-500 transition-colors"
                title="Sửa tên sản phẩm tạm"
                type="button"
            >
                <Pencil size={13} />
            </button>
        </div>
    );
}
