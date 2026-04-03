'use client'

import { useQuery } from '@tanstack/react-query'
import { hotelApi, HotelStay } from '@/lib/api/hotel.api'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

export default function StayList() {
  const { data: stays, isLoading } = useQuery({
    queryKey: ['stays'],
    queryFn: hotelApi.getStays,
  })

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Đang tải danh sách lưu trú...</div>
  }

  const getStatusBadge = (status: HotelStay['status']) => {
    switch (status) {
      case 'OCCUPIED':
        return <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">Đang ở</span>
      case 'COMPLETED':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full font-medium">Đã trả</span>
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full font-medium">{status}</span>
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Danh sách Lưu trú ({stays?.length || 0})</h2>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mã LH / Thú cưng
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Chuồng
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thời gian
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trạng thái
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stays?.map((stay) => (
              <tr key={stay.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {stay.pet?.name || stay.petName}
                      </div>
                      <div className="text-sm text-gray-500">#{stay.id.slice(-6).toUpperCase()}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{stay.cage?.name || '---'}</div>
                  <div className="text-xs text-gray-500">{stay.lineType === 'HOLIDAY' ? 'Gói Lễ/Tết' : 'Gói Thường'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    Vào: {format(new Date(stay.checkIn), 'dd/MM/yyyy HH:mm')}
                  </div>
                  <div className="text-sm text-gray-500">
                    {stay.status === 'COMPLETED' && stay.checkOut 
                      ? `Ra: ${format(new Date(stay.checkOut), 'dd/MM/yyyy HH:mm')}`
                      : stay.estimatedCheckOut 
                        ? `Dự kiến: ${format(new Date(stay.estimatedCheckOut), 'dd/MM/yyyy')}`
                        : 'Chưa có dự kiến ra'
                    }
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(stay.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-indigo-600 hover:text-indigo-900 mr-4">
                    Chi tiết
                  </button>
                  {stay.status === 'OCCUPIED' && (
                    <button className="text-emerald-600 hover:text-emerald-900">
                      Check-out
                    </button>
                  )}
                </td>
              </tr>
            ))}
            
            {(!stays || stays.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  Chưa có lượt lưu trú nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
