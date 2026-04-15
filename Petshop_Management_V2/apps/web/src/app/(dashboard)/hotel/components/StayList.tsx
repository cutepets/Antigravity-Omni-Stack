'use client'

import { useQuery } from '@tanstack/react-query'
import { hotelApi, HotelStay } from '@/lib/api/hotel.api'
import { format } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DataListPagination,
  DataListTable,
  DataListToolbar,
} from '@petshop/ui/data-list'
import { useAuthorization } from '@/hooks/useAuthorization'
import StayDetailsDialog from './StayDetailsDialog'

const TABLE_COLUMNS = [
  { id: 'pet', label: 'Mã lưu trú / Thú cưng' },
  { id: 'customer', label: 'Khách hàng' },
  { id: 'cage', label: 'Chuồng / Gói' },
  { id: 'time', label: 'Thời gian' },
  { id: 'status', label: 'Trạng thái' },
  { id: 'actions', label: 'Thao tác', shrink: true },
]

type CageStub = { id: string; name: string; status: 'OCCUPIED' | 'AVAILABLE' | 'MAINTENANCE' }

export default function StayList({
  initialSearch = '',
  focusStayId,
}: {
  initialSearch?: string
  focusStayId?: string
}) {
  const { hasPermission } = useAuthorization()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState(initialSearch)
  const [detailCage, setDetailCage] = useState<CageStub | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const autoOpenedStayIdRef = useRef<string | null>(null)
  const canCheckout = hasPermission('hotel.checkout')

  const { data: stays, isLoading } = useQuery({
    queryKey: ['stays'],
    queryFn: () => hotelApi.getStayList(),
  })

  const allStays = useMemo(() => stays?.items || [], [stays?.items])

  useEffect(() => {
    setSearch(initialSearch)
    setPage(1)
  }, [initialSearch])

  const visibleStays = useMemo(() => {
    let filtered = allStays
    if (search) {
      const normalizedSearch = search.toLowerCase()
      filtered = filtered.filter((stay) =>
        stay.pet?.name?.toLowerCase().includes(normalizedSearch) ||
        stay.petName?.toLowerCase().includes(normalizedSearch) ||
        stay.id.toLowerCase().includes(normalizedSearch) ||
        stay.stayCode?.toLowerCase().includes(normalizedSearch),
      )
    }
    return filtered
  }, [allStays, search])

  const paginatedStays = useMemo(() => {
    const start = (page - 1) * pageSize
    return visibleStays.slice(start, start + pageSize)
  }, [page, pageSize, visibleStays])

  const handleViewDetail = (stay: HotelStay) => {
    setDetailCage({
      id: stay.cageId || stay.id,
      name: stay.cage?.name ?? (stay.stayCode || `Lưu trú #${stay.id.slice(-6).toUpperCase()}`),
      status: 'OCCUPIED',
    })
    setIsDetailOpen(true)
  }

  useEffect(() => {
    if (!focusStayId || autoOpenedStayIdRef.current === focusStayId || allStays.length === 0) return
    const matchedStay = allStays.find((stay) => stay.id === focusStayId)
    if (!matchedStay) return
    autoOpenedStayIdRef.current = focusStayId
    handleViewDetail(matchedStay)
  }, [allStays, focusStayId])

  const getStatusBadge = (status: HotelStay['status']) => {
    switch (status) {
      case 'BOOKED':
        return <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">Đã đặt</span>
      case 'CHECKED_IN':
        return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">Đang ở</span>
      case 'CHECKED_OUT':
        return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">Đã trả</span>
      case 'CANCELLED':
        return <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800">Đã hủy</span>
      default:
        return <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">{status}</span>
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex flex-1 min-h-0 flex-col gap-4">
        <DataListToolbar
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Tìm thú cưng, mã lưu trú..."
          showColumnToggle={false}
        />

        <DataListTable
          columns={TABLE_COLUMNS}
          isLoading={isLoading}
          isEmpty={paginatedStays.length === 0}
          emptyText="Không có lượt lưu trú nào phù hợp."
        >
          {paginatedStays.map((stay) => (
            <tr
              key={stay.id}
              className="border-b border-border/50 transition-colors hover:bg-background-secondary/40"
            >
              <td className="px-3 py-3">
                <div className="text-sm font-semibold text-foreground">
                  {stay.pet?.name || stay.petName}
                </div>
                <div className="mt-1 text-xs font-mono text-foreground-muted">
                  {stay.stayCode || `#${stay.id.slice(-6).toUpperCase()}`}
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="text-sm text-foreground">
                  {stay.customer?.fullName || 'Khách lẻ'}
                </div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {stay.customer?.phone || '—'}
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="text-sm font-medium text-foreground">
                  {stay.cage?.name || '---'}
                </div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {stay.lineType === 'HOLIDAY' ? 'Gói Lễ/Tết' : 'Gói Thường'}
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="text-sm text-foreground">
                  Vào: {format(new Date(stay.checkIn), 'dd/MM/yyyy HH:mm')}
                </div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {stay.status === 'CHECKED_OUT' && stay.checkOutActual
                    ? `Ra: ${format(new Date(stay.checkOutActual), 'dd/MM/yyyy HH:mm')}`
                    : stay.estimatedCheckOut
                      ? `Dự kiến: ${format(new Date(stay.estimatedCheckOut), 'dd/MM/yyyy')}`
                      : '----'}
                </div>
              </td>
              <td className="px-3 py-3">{getStatusBadge(stay.status)}</td>
              <td className="px-3 py-3 text-right">
                <button
                  onClick={() => handleViewDetail(stay)}
                  className="mr-3 text-sm font-medium text-primary-500 transition-colors hover:text-primary-600"
                >
                  Chi tiết
                </button>
                {stay.status === 'CHECKED_IN' && canCheckout ? (
                  <button
                    onClick={() => handleViewDetail(stay)}
                    className="text-sm font-medium text-emerald-500 transition-colors hover:text-emerald-600"
                  >
                    Ra chuồng
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </DataListTable>

        <DataListPagination
          page={page}
          pageSize={pageSize}
          total={visibleStays.length}
          totalPages={Math.ceil(visibleStays.length / pageSize)}
          rangeStart={(page - 1) * pageSize + 1}
          rangeEnd={Math.min(page * pageSize, visibleStays.length)}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 20, 50]}
          totalItemText={
            <p className="shrink-0 text-xs text-foreground-muted">
              Tổng <strong className="text-foreground">{visibleStays.length}</strong> lượt lưu trú
              {search ? <span> · tìm kiếm &quot;{search}&quot;</span> : null}
            </p>
          }
        />
      </div>

      <StayDetailsDialog
        cage={detailCage as any}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setDetailCage(null)
        }}
      />
    </div>
  )
}
