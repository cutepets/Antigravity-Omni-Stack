'use client'

import { useQuery } from '@tanstack/react-query'
import { hotelApi, HotelStay } from '@/lib/api/hotel.api'
import { format } from 'date-fns'
import { useState, useMemo } from 'react'
import {
  DataListToolbar,
  DataListTable,
  DataListPagination,
} from '@/components/data-list'
import { useAuthorization } from '@/hooks/useAuthorization'
import { cn } from '@/lib/utils'
import StayDetailsDialog from './StayDetailsDialog'

const TABLE_COLUMNS = [
  { id: 'pet', label: 'Mã LH / Thú cưng' },
  { id: 'customer', label: 'Khách hàng' },
  { id: 'cage', label: 'Chuồng / Gói' },
  { id: 'time', label: 'Thời gian' },
  { id: 'status', label: 'Trạng thái' },
  { id: 'actions', label: 'Thao tác', shrink: true },
]

// Cage stub for StayDetailsDialog — StayList re-uses the same dialog
type CageStub = { id: string; name: string; status: 'OCCUPIED' | 'AVAILABLE' | 'MAINTENANCE' }

export default function StayList() {
  const { hasPermission } = useAuthorization()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [detailCage, setDetailCage] = useState<CageStub | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const canCheckout = hasPermission('hotel.checkout')

  const { data: stays, isLoading } = useQuery({
    queryKey: ['stays'],
    queryFn: () => hotelApi.getStayList(),
  })

  const allStays = stays?.items || []

  const visibleStays = useMemo(() => {
    let filtered = allStays
    if (search) {
      filtered = filtered.filter((s) => 
        s.pet?.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.petName?.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase())
      )
    }
    return filtered
  }, [allStays, search])

  const paginatedStays = useMemo(() => {
    const start = (page - 1) * pageSize
    return visibleStays.slice(start, start + pageSize)
  }, [visibleStays, page, pageSize])

  const handleViewDetail = (stay: HotelStay) => {
    if (!stay.cageId) return
    setDetailCage({
      id: stay.cageId,
      name: stay.cage?.name ?? `Chuồng #${stay.cageId.slice(-4)}`,
      status: 'OCCUPIED',
    })
    setIsDetailOpen(true)
  }

  const getStatusBadge = (status: HotelStay['status']) => {
    switch (status) {
      case 'BOOKED':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">Đã Đặt</span>
      case 'CHECKED_IN':
        return <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">Đang Ở</span>
      case 'CHECKED_OUT':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full font-medium">Đã Trả</span>
      case 'CANCELLED':
        return <span className="px-2 py-1 bg-rose-100 text-rose-800 text-xs rounded-full font-medium">Đã Hủy</span>
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full font-medium">{status}</span>
    }
  }

  const handleSearch = (val: string) => {
    setSearch(val)
    setPage(1)
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex-1 min-h-0 flex flex-col gap-4">
        <DataListToolbar
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Tìm kiếm thú cưng, mã lưu trú..."
          showColumnToggle={false}
        />

        <DataListTable
          columns={TABLE_COLUMNS}
          isLoading={isLoading}
          isEmpty={paginatedStays.length === 0}
          emptyText="Không có lượt lưu trú nào phù hợp."
        >
          {paginatedStays.map((stay) => {
            return (
              <tr
                key={stay.id}
                className="border-b border-border/50 transition-colors hover:bg-background-secondary/40"
              >
                <td className="px-3 py-3">
                  <div className="text-sm font-semibold text-foreground">
                    {stay.pet?.name || stay.petName}
                  </div>
                  <div className="text-xs text-foreground-muted font-mono mt-1">
                    #{stay.id.slice(-6).toUpperCase()}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="text-sm text-foreground">
                    {stay.customer?.fullName || 'Khách lẻ'}
                  </div>
                  <div className="text-xs text-foreground-muted mt-1">
                    {stay.customer?.phone || '—'}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="text-sm font-medium text-foreground">
                    {stay.cage?.name || '---'}
                  </div>
                  <div className="text-xs text-foreground-muted mt-1">
                    {stay.lineType === 'HOLIDAY' ? 'Gói Lễ/Tết' : 'Gói Thường'}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="text-sm text-foreground">
                    Vào: {format(new Date(stay.checkIn), 'dd/MM/yyyy HH:mm')}
                  </div>
                  <div className="text-xs text-foreground-muted mt-1">
                    {stay.status === 'CHECKED_OUT' && stay.checkOutActual 
                      ? `Ra: ${format(new Date(stay.checkOutActual), 'dd/MM/yyyy HH:mm')}`
                      : stay.estimatedCheckOut 
                        ? `Dự kiến: ${format(new Date(stay.estimatedCheckOut), 'dd/MM/yyyy')}`
                        : '----'
                    }
                  </div>
                </td>
                <td className="px-3 py-3">
                  {getStatusBadge(stay.status)}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={() => handleViewDetail(stay)}
                    className="text-sm font-medium text-primary-500 hover:text-primary-600 transition-colors mr-3"
                  >
                    Chi tiết
                  </button>
                  {stay.status === 'CHECKED_IN' && canCheckout && (
                    <button
                      onClick={() => handleViewDetail(stay)}
                      className="text-sm font-medium text-emerald-500 hover:text-emerald-600 transition-colors"
                    >
                      Ra chuồng
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
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
              {search && <span> · tìm kiếm &quot;{search}&quot;</span>}
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
