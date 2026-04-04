import { Metadata } from 'next'
import { ShoppingCart } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Đơn hàng | Petshop',
}

// TODO: Module này sẽ được phát triển sau.
// Cần implement: OrdersList, OrderFilters, OrderDetail, POS integration
export default function OrdersPage() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <ShoppingCart className="w-10 h-10 opacity-30" />
      <p className="text-lg font-medium">Quản lý Đơn hàng</p>
      <p className="text-sm opacity-70">Tính năng đang phát triển — sẽ hiển thị lịch sử giao dịch từ POS.</p>
    </div>
  )
}
