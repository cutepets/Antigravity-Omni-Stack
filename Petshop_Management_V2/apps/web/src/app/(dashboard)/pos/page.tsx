'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import PosCatalog from './components/PosCatalog'
import PosCart from './components/PosCart'

export default function PosPage() {
  const [catalog, setCatalog] = useState<{ products: any[]; services: any[] }>({
    products: [],
    services: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/orders/catalog')
      .then((res) => setCatalog(res.data))
      .catch((err) => console.error('Failed to load catalog', err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50 gap-4 p-4">
      {/* Left: Catalog */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">Sản phẩm &amp; Dịch vụ</h2>
          <input
            type="text"
            placeholder="Tìm kiếm SP, Mã vạch..."
            className="w-64 px-4 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-full text-muted-foreground">
              Đang tải dữ liệu...
            </div>
          ) : (
            <PosCatalog products={catalog.products} services={catalog.services} />
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200">
        <PosCart />
      </div>
    </div>
  )
}
