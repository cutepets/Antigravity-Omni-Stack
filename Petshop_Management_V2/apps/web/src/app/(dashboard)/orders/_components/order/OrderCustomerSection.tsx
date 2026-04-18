'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Search, X, Plus, Pencil, Medal, PawPrint } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCustomerSearch } from '@/components/search/use-commerce-search'
import { CustomerSearchResults } from '@/components/search/customer-search-results'
import { PosAddCustomerModal } from '@/app/(dashboard)/pos/components/PosAddCustomerModal'
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
        if (isEditing) onSelectSuggestedService?.(service, petId, petName)
    }

    // ─── Search bar (no customer selected) ──────────────────────────
    if (!hasCustomer) {
        return (
            <div className="relative px-4 py-3">
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
                    <div className="absolute top-full left-4 right-4 z-50 mt-1 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
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

                <PosAddCustomerModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    initialData={addModalData}
                    onSaved={handleCustomerSaved}
                />
            </div>
        )
    }

    // ─── 2-card horizontal layout (customer selected) ────────────────
    const pets: any[] = customerDetail?.pets ?? []
    const IMG_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

    return (
        <div className="px-3 py-3">
            {/* 2-column grid: [customer card ~42%] [pet card ~58%] */}
            <div className="grid grid-cols-[5fr_7fr] gap-2.5">

                {/* ── Card 1: Thông tin khách ─────────────────────────── */}
                <div className="relative flex flex-col gap-2 rounded-xl border border-border bg-background-secondary p-3">
                    {/* Remove button */}
                    <button
                        onClick={onRemoveCustomer}
                        className="absolute top-2 right-2 rounded-full p-0.5 text-foreground-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Xoá khách hàng"
                    >
                        <X size={13} />
                    </button>

                    {/* Avatar + name */}
                    <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-cyan-500 text-white flex items-center justify-center text-lg font-bold uppercase shadow-sm">
                            {customerName?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                                <span className="truncate text-[13px] font-bold text-foreground leading-tight">
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
                            </div>
                            {customerDetail?.phone && (
                                <div className="text-[11px] text-foreground-muted leading-tight mt-0.5 truncate">
                                    {customerDetail.phone}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Điểm */}
                    <div className="inline-flex items-center gap-1 self-start rounded-full border border-orange-200/60 bg-orange-50/80 dark:bg-orange-500/10 dark:border-orange-500/20 px-2 py-0.5 text-[11px] font-bold text-orange-500">
                        <Medal size={11} />
                        {customerDetail?.points ?? 0} điểm
                    </div>

                    {/* Địa chỉ */}
                    {customerDetail?.address && (
                        <div className="text-[11px] text-foreground-muted leading-tight truncate">
                            {customerDetail.address}
                        </div>
                    )}
                </div>

                {/* ── Card 2: Thú cưng ────────────────────────────────── */}
                <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-background-secondary p-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                        <PawPrint size={11} />
                        Thú cưng
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {pets.map((pet: any) => (
                            <button
                                key={pet.id}
                                type="button"
                                onClick={() => setSelectedPetId(pet.id)}
                                className="flex flex-col items-center gap-1 rounded-xl px-1.5 py-1 hover:bg-background-tertiary transition-colors"
                            >
                                <div className="h-10 w-10 rounded-full overflow-hidden border border-border bg-background-tertiary shadow-sm">
                                    {pet.avatar ? (
                                        <Image
                                            src={String(pet.avatar).startsWith('http') ? pet.avatar : `${IMG_BASE}${pet.avatar}`}
                                            alt={pet.name}
                                            className="h-full w-full object-cover"
                                            width={80}
                                            height={80}
                                            unoptimized
                                        />
                                    ) : (
                                        <span className="flex h-full w-full items-center justify-center text-base font-bold text-foreground-muted">
                                            {pet.name?.charAt(0)?.toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <span className="max-w-[52px] truncate text-[11px] font-semibold text-foreground leading-tight text-center">
                                    {pet.name}
                                </span>
                                {pet.weight && (
                                    <span className="rounded-full bg-orange-100 dark:bg-orange-500/15 px-1.5 py-0 text-[10px] font-bold text-orange-500">
                                        {pet.weight}kg
                                    </span>
                                )}
                            </button>
                        ))}

                        {/* Add pet */}
                        <button
                            type="button"
                            onClick={() => setShowPetModal(true)}
                            className="flex flex-col items-center gap-1 rounded-xl px-1.5 py-1 hover:bg-background-tertiary transition-colors group"
                        >
                            <div className="h-10 w-10 rounded-full border-2 border-dashed border-border text-foreground-muted group-hover:text-primary-500 group-hover:border-primary-500/60 flex items-center justify-center transition-colors">
                                <Plus size={18} />
                            </div>
                            <span className="text-[11px] font-medium text-foreground-muted group-hover:text-primary-500 transition-colors">
                                Thêm
                            </span>
                        </button>
                    </div>
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

            {hasCustomer && customerDetail && selectedPetId && (
                <UnifiedPetProfile
                    isOpen
                    petId={selectedPetId}
                    ownerName={customerDetail.fullName}
                    onClose={() => setSelectedPetId(null)}
                    onSelectService={handleSelectService}
                    mode="pos"
                />
            )}
        </div>
    )
}
