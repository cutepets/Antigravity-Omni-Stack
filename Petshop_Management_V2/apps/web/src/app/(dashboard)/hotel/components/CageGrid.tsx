'use client'

import { useQuery } from '@tanstack/react-query'
import { hotelApi, Cage } from '@/lib/api/hotel.api'
import { useState } from 'react'

import CheckInDialog from './CheckInDialog'
import StayDetailsDialog from './StayDetailsDialog'
import ManageCagesDialog from './ManageCagesDialog'

export default function CageGrid() {
  const { data: cages, isLoading } = useQuery({
    queryKey: ['cages'],
    queryFn: hotelApi.getCages,
  })

  // Modal states
  const [selectedCage, setSelectedCage] = useState<Cage | null>(null)
  const [isCheckInOpen, setIsCheckInOpen] = useState(false)
  const [isStayDetailsOpen, setIsStayDetailsOpen] = useState(false)
  const [isManageCagesOpen, setIsManageCagesOpen] = useState(false)

  const handleCageClick = (cage: Cage) => {
    setSelectedCage(cage)
    if (cage.status === 'AVAILABLE') {
      setIsCheckInOpen(true)
    } else if (cage.status === 'OCCUPIED') {
      setIsStayDetailsOpen(true)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Đang tải danh sách chuồng...</div>
  }

  if (!cages || cages.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
        <div className="text-4xl mb-4">🏠</div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">Chưa có chuồng nào</h3>
        <p className="text-gray-500 mb-4">Bắt đầu bằng cách thêm chuồng nuôi mới cho khách sạn.</p>
        <button 
          onClick={() => setIsManageCagesOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
        >
          Thêm chuồng ngay
        </button>

        <ManageCagesDialog 
          isOpen={isManageCagesOpen} 
          onClose={() => setIsManageCagesOpen(false)} 
        />
      </div>
    )
  }

  const getStatusColor = (status: Cage['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-300'
      case 'OCCUPIED':
        return 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-300'
      case 'MAINTENANCE':
        return 'bg-gray-50 border-gray-200 text-gray-500 opacity-60'
      default:
        return 'bg-white border-gray-200 text-gray-700'
    }
  }

  const getStatusLabel = (status: Cage['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return 'Trống'
      case 'OCCUPIED':
        return 'Đang sử dụng'
      case 'MAINTENANCE':
        return 'Bảo trì'
      case 'COMPLETED':
        return 'Hoàn thành'
      default:
        return status
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Sơ đồ Chuồng ({cages.length})</h2>
        <button 
          onClick={() => setIsManageCagesOpen(true)}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition text-sm font-medium"
        >
          + Thêm chuồng mới
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {cages.map((cage) => (
          <div
            key={cage.id}
            className={`border rounded-xl p-4 cursor-pointer transition-all ${getStatusColor(cage.status)}`}
            onClick={() => handleCageClick(cage)}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg">{cage.name}</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-white/60 font-medium">
                {cage.type === 'HOLIDAY' ? '🌟 Lễ/Tết' : 'Thường'}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  cage.status === 'AVAILABLE'
                    ? 'bg-emerald-500'
                    : cage.status === 'OCCUPIED'
                    ? 'bg-amber-500'
                    : 'bg-gray-400'
                }`}
              />
              <span className="text-sm font-medium">{getStatusLabel(cage.status)}</span>
            </div>
            
            {cage.description && (
              <p className="text-xs mt-2 line-clamp-2 opacity-80">{cage.description}</p>
            )}
          </div>
        ))}
      </div>

      {/* Modals */}
      <CheckInDialog 
        cage={selectedCage} 
        isOpen={isCheckInOpen} 
        onClose={() => {
          setIsCheckInOpen(false)
          setSelectedCage(null)
        }} 
      />
      <StayDetailsDialog 
        cage={selectedCage} 
        isOpen={isStayDetailsOpen} 
        onClose={() => {
          setIsStayDetailsOpen(false)
          setSelectedCage(null)
        }} 
      />
      <ManageCagesDialog 
        isOpen={isManageCagesOpen} 
        onClose={() => setIsManageCagesOpen(false)} 
      />
    </div>
  )
}
