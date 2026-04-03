export default function HotelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Khách sạn Thú cưng</h1>
        <p className="text-gray-500 text-sm mt-1">Quản lý chuồng nuôi, check-in, và lưu trú</p>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
