'use client'

import Image from 'next/image'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Plus, Pencil, Medal, PawPrint } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCustomerSearch } from '@/components/search/use-commerce-search'
import { CustomerSearchResults } from '@/components/search/customer-search-results'
import { AddCustomerModal as PosAddCustomerModal } from '@/app/(dashboard)/_shared/customer/components/AddCustomerModal'
import { PetFormModal } from '@/app/(dashboard)/pets/_components/pet-form-modal'
import { UnifiedPetProfile } from '@/components/pet/UnifiedPetProfile'

// ─────────────────────────────────────────────────────────────────
// OrderCustomerSection — hệ thống màu (dark/light) + layout ngang
// 2 card: [Thông tin khách | Thú cưng] cạnh nhau
// ─────────────────────────────────────────────────────────────────

export type { }

type Props = {
    customerId?: string
    customerName?: string
    cartItems?: any[]
    isEditing: boolean
    onSelectCustomer: (id: string, name: string) => void
    onRemoveCustomer: () => void
    onSelectSuggestedService?: (service: any, petId: string, petName?: string) => void
    col1HeaderNode?: React.ReactNode
}

export function OrderCustomerSection({
    customerId,
    customerName,
    cartItems,
    isEditing,
    onSelectCustomer,
    onRemoveCustomer,
    onSelectSuggestedService,
    col1HeaderNode,
}: Props) {
    const [query, setQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [addModalData, setAddModalData] = useState<any>(null)
    const [showPetModal, setShowPetModal] = useState(false)
    const [selectedPetId, setSelectedPetId] = useState<string | null>(null)

    const hasCustomer = !!customerId

    const { data: customers = [] } = useCustomerSearch(query)

    const { data: customerDetail, refetch } = useQuery({
        queryKey: ['customer-detail', customerId],
        queryFn: async () => {
            if (!customerId) return null
            const res = await api.get(`/customers/${customerId}`)
            return res.data?.data || res.data
        },
        enabled: !!customerId,
    })

    const handleSelectCustomer = (c: any) => {
        onSelectCustomer(c.id, c.fullName || c.name || 'Khách lẻ')
        setShowSearch(false)
        setQuery('')
    }

    const handleQuickAdd = () => {
        const isPhone = /^[0-9\-+\s]+$/.test(query)
        setAddModalData({
            fullName: isPhone ? '' : query,
            phone: isPhone ? query.replace(/[^0-9]/g, '') : '',
            address: '',
        })
        setShowSearch(false)
        setShowAddModal(true)
    }

    const handleCustomerSaved = (saved: any) => {
        onSelectCustomer(saved.id, saved.fullName)
        refetch()
        setShowAddModal(false)
        setQuery('')
    }

    const handlePetSaved = () => {
        refetch()
        setShowPetModal(false)
    }

    const handleSelectService = (service: any, petId: string, petName?: string) => {
        onSelectSuggestedService?.(service, petId, petName)
    }

    // ─── Search bar (no customer selected) ──────────────────────────
    if (!hasCustomer) {
        return (
            <>
                {/* Col 1: Title + Search */}
                <div className="flex flex-col justify-center gap-3 px-5 py-4">
                    {col1HeaderNode}
                    <div className="relative">
                        <div className="flex items-center gap-2 rounded-xl border border-border bg-background-secondary px-3 py-2.5 focus-within:border-primary-500/50 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
                            <Search size={15} className="shrink-0 text-foreground-muted" />
                            <input
                                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted outline-none"
                                placeholder="Tìm khách hàng (F4)"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setShowSearch(true) }}
                                onFocus={() => setShowSearch(true)}
                            />
                        </div>

                        {showSearch && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
                                <CustomerSearchResults
                                    customers={customers as any[]}
                                    query={query}
                                    variant="pos"
                                    showGuest={false}
                                    guestLabel="Khách lẻ"
                                    onSelectGuest={() => { onSelectCustomer('', 'Khách lẻ'); setShowSearch(false) }}
                                    onSelectCustomer={handleSelectCustomer}
                                    onQuickAdd={handleQuickAdd}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Col 2: Empty placeholder for grid */}
                <div className="flex flex-col justify-center px-5 py-4"></div>

                <PosAddCustomerModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    initialData={addModalData}
                    onSaved={handleCustomerSaved}
                />
            </>
        )
    }

    // ─── 2-column layout (customer selected) ────────────────
    const pets: any[] = customerDetail?.pets ?? []
    const IMG_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

    return (
        <>
            {/* ── Col 1: Tiêu đề + Thông tin khách ───────────────────── */}
            <div className="relative flex flex-col justify-center gap-2 px-5 py-4 min-w-[300px]">
                {/* X = remove customer — gọn góc phải của col-1 */}
                <button
                    onClick={onRemoveCustomer}
                    className="absolute top-3 right-3 rounded-full p-1 text-foreground-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Xoá khách hàng"
                >
                    <X size={13} />
                </button>

                {col1HeaderNode}

                {/* Avatar + info block */}
                <div className="flex items-start gap-3 pr-5">
                    {/* Avatar */}
                    <div className="h-10 w-10 shrink-0 rounded-full bg-cyan-500 text-white flex items-center justify-center text-base font-bold uppercase shadow-sm">
                        {customerName?.charAt(0) || 'U'}
                    </div>

                    {/* Info block */}
                    <div className="min-w-0 flex-1">
                        {/* Row 1: tên + edit | điểm + nợ căn phải */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-foreground leading-tight">
                                {customerName}
                            </span>
                            {customerName?.toLowerCase() !== 'khách lẻ' && (
                                <button
                                    onClick={() => { setAddModalData(customerDetail); setShowAddModal(true) }}
                                    className="shrink-0 text-foreground-muted hover:text-primary-500 transition-colors"
                                    title="Chỉnh sửa"
                                >
                                    <Pencil size={11} />
                                </button>
                            )}
                            {/* Điểm — căn phải */}
                            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[11px] font-bold text-orange-500">
                                <Medal size={10} />{customerDetail?.points ?? 0} điểm
                            </span>
                            {/* Nợ — chỉ hiện nếu > 0 */}
                            {!!customerDetail?.debtAmount && customerDetail.debtAmount > 0 && (
                                <span className="text-[11px] font-semibold text-red-400 whitespace-nowrap">
                                    · Nợ {customerDetail.debtAmount.toLocaleString('vi-VN')}đ
                                </span>
                            )}
                        </div>

                        {/* Row 2: phone */}
                        {customerDetail?.phone && (
                            <div className="mt-0.5 text-xs text-foreground-muted leading-tight">
                                {customerDetail.phone}
                            </div>
                        )}

                        {/* Row 3: address */}
                        {customerDetail?.address && (
                            <div className="mt-0.5 text-xs text-foreground-muted leading-tight truncate">
                                {customerDetail.address}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Col 2: Thú cưng ─────────────────────────── */}
            <div className="flex flex-col justify-center gap-2 px-4 py-4 min-w-[200px]">
                {/* Header label — aligned with col1HeaderNode */}
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">
                    Thú cưng
                </div>

                {/* Pet list — inline, shrink to fit */}
                <div className="flex items-start gap-1.5 flex-nowrap">
                    {pets.map((pet: any) => (
                        <button
                            key={pet.id}
                            type="button"
                            onClick={() => setSelectedPetId(pet.id)}
                            className="flex flex-col items-center gap-1 rounded-xl px-1.5 py-1 active:scale-[0.97] transition-all hover:bg-background-secondary"
                            title={pet.name}
                        >
                            <div className="h-9 w-9 rounded-full overflow-hidden border border-border bg-background-tertiary shadow-sm">
                                {pet.avatar ? (
                                    <Image
                                        src={String(pet.avatar).startsWith('http') ? pet.avatar : `${IMG_BASE}${pet.avatar}`}
                                        alt={pet.name}
                                        className="h-full w-full object-cover"
                                        width={72}
                                        height={72}
                                        unoptimized
                                    />
                                ) : (
                                    <span className="flex h-full w-full items-center justify-center text-[15px] font-bold text-foreground-muted">
                                        {pet.name?.charAt(0)?.toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <span className="max-w-[44px] truncate text-[11px] font-semibold text-foreground leading-tight text-center">
                                {pet.name}
                            </span>
                            {pet.weight && (
                                <span className="rounded-full bg-orange-500/10 px-1 py-0 text-[10px] font-bold text-orange-500">
                                    {pet.weight}kg
                                </span>
                            )}
                        </button>
                    ))}

                    {/* + Thêm */}
                    <button
                        type="button"
                        onClick={() => setShowPetModal(true)}
                        className="flex flex-col items-center gap-1 rounded-xl px-1.5 py-1 active:scale-[0.97] transition-all group hover:bg-background-secondary"
                    >
                        <div className="h-9 w-9 rounded-full border-2 border-dashed border-border text-foreground-muted group-hover:text-primary-500 group-hover:border-primary-500/60 flex items-center justify-center transition-colors">
                            <Plus size={16} />
                        </div>
                        <span className="text-[11px] font-medium text-foreground-muted group-hover:text-primary-500 transition-colors">
                            Thêm
                        </span>
                    </button>
                </div>
            </div>

            {/* ── Modals ────────────────────────────────────────────── */}
            <PosAddCustomerModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                initialData={addModalData}
                onSaved={handleCustomerSaved}
            />

            {hasCustomer && customerDetail && (
                <PetFormModal
                    isOpen={showPetModal}
                    onClose={() => setShowPetModal(false)}
                    customerId={customerDetail.id}
                    customerName={customerDetail.fullName}
                    customerPhone={customerDetail.phone}
                    onSaved={handlePetSaved}
                />
            )}

            {hasCustomer && customerDetail && selectedPetId && createPortal(
                <UnifiedPetProfile
                    isOpen
                    petId={selectedPetId}
                    ownerName={customerDetail.fullName}
                    onClose={() => setSelectedPetId(null)}
                    onSelectService={handleSelectService}
                    cartItemsOverride={cartItems}
                    mode="pos"
                />,
                document.body
            )}
        </>
    )
}
