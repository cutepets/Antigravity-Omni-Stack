'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, XCircle, DollarSign, Wallet, PackageOpen, X, AlertTriangle } from 'lucide-react'
import { stockApi } from '@/lib/api/stock.api'
import { toast } from 'sonner'
import dayjs from 'dayjs'

export function ReceiptDetail({ id }: { id: string }) {
  const queryClient = useQueryClient()

  const { data: res, isLoading } = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => stockApi.getReceipt(id),
  })

  const receipt = (res as any)?.data?.data

  const payMutation = useMutation({
    mutationFn: () => stockApi.payReceipt(id),
    onSuccess: () => {
      toast.success('Đã thanh toán công nợ phiếu nhập!')
      queryClient.invalidateQueries({ queryKey: ['receipt', id] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Có lỗi khi thanh toán')
    }
  })

  const receiveMutation = useMutation({
    mutationFn: () => stockApi.receiveReceipt(id),
    onSuccess: () => {
      toast.success('Đã nhận hàng thành công. Tồn kho đã được cập nhật!')
      queryClient.invalidateQueries({ queryKey: ['receipt', id] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Có lỗi khi xác nhận nhận hàng')
    }
  })

  const cancelMutation = useMutation({
    mutationFn: () => stockApi.cancelReceipt(id),
    onSuccess: () => {
      toast.success('Đã hủy phiếu nhập!')
      queryClient.invalidateQueries({ queryKey: ['receipt', id] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Có lỗi khi hủy phiếu')
    }
  })

  if (isLoading) return <div className="p-8 text-center text-foreground-muted animate-pulse">Đang tải thông tin...</div>
  if (!receipt) return <div className="p-8 text-center text-error border border-error/20 bg-error/5 rounded-xl">Không tìm thấy phiếu nhập</div>

  const isDraft = receipt.status === 'DRAFT'
  const isReceived = receipt.status === 'RECEIVED'
  const isCancelled = receipt.status === 'CANCELLED'
  const isUnpaid = receipt.totalAmount > (receipt.paidAmount || 0)

  const getStatusBadge = () => {
    switch (receipt.status) {
      case 'DRAFT': return <span className="badge badge-warning"><Clock size={12} /> BẢN NHÁP</span>
      case 'RECEIVED': return <span className="badge badge-success"><CheckCircle2 size={12} /> HOÀN THÀNH</span>
      case 'CANCELLED': return <span className="badge badge-error"><XCircle size={12} /> ĐÃ HỦY</span>
      default: return <span className="badge">{receipt.status}</span>
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header Info */}
      <div className="card p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold font-mono text-primary-600">
              {receipt.receiptNumber || receipt.id.substring(0,8).toUpperCase()}
            </h2>
            {getStatusBadge()}
          </div>
          <p className="text-sm text-foreground-muted">
            Tạo ngày: {dayjs(receipt.createdAt).format('DD/MM/YYYY HH:mm')}
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {isDraft && (
            <>
              <button 
                className="btn-outline text-error border-error/50 hover:bg-error/10 hover:border-error"
                onClick={() => {
                  if (confirm('Bạn có chắc muốn hủy phiếu chứng từ này?')) cancelMutation.mutate()
                }}
                disabled={cancelMutation.isPending}
              >
                <X size={15} className="mr-1.5" /> Hủy phiếu
              </button>
              <button 
                className="btn-primary liquid-button bg-success hover:bg-success-600 text-white"
                onClick={() => {
                  if (confirm('Xác nhận nhận hàng? Thao tác này sẽ cộng dồn số lượng vào kho và báo công nợ cho NCC.')) receiveMutation.mutate()
                }}
                disabled={receiveMutation.isPending}
              >
                <PackageOpen size={15} className="mr-1.5" /> Xác nhận Nhập Kho
              </button>
            </>
          )}

          {isReceived && isUnpaid && (
            <button 
              className="btn-primary liquid-button bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              onClick={() => {
                if (confirm('Xác nhận đã thanh toán toàn bộ phiếu qua tiền mặt / chuyển khoản?')) payMutation.mutate()
              }}
              disabled={payMutation.isPending}
            >
              <Wallet size={15} className="mr-1.5" /> Thanh toán cho NCC
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Supplier & Payment Details */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="card p-5">
            <h3 className="font-bold text-foreground mb-4 border-b border-border pb-2">Thông tin giao dịch</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-foreground-muted mb-0.5">Nhà cung cấp</p>
                <p className="font-medium">{receipt.supplier?.name || "Khách lẻ / Không rõ NCC"}</p>
              </div>
              {receipt.supplier?.phone && (
                <div>
                  <p className="text-xs text-foreground-muted mb-0.5">SĐT Liên hệ</p>
                  <p className="font-medium">{receipt.supplier.phone}</p>
                </div>
              )}
              {receipt.notes && (
                <div>
                  <p className="text-xs text-foreground-muted mb-0.5">Ghi chú</p>
                  <p className="font-medium text-sm border-l-2 border-border pl-2 italic">
                    {receipt.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5 bg-gradient-to-br from-background-secondary to-background-base">
            <h3 className="font-bold text-foreground mb-4 border-b border-border pb-2">Thanh toán</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground-muted">Tổng tiền hóa đơn:</span>
                <span className="font-bold">{receipt.totalAmount?.toLocaleString('vi-VN')}₫</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground-muted">Đã thanh toán:</span>
                <span className="font-bold text-success">{(receipt.paidAmount || 0).toLocaleString('vi-VN')}₫</span>
              </div>
              <div className="flex justify-between items-center text-error pt-2 border-t border-border/50">
                <span className="text-sm font-semibold">Còn nợ:</span>
                <span className="font-black text-lg">
                  {Math.max(0, receipt.totalAmount - (receipt.paidAmount || 0)).toLocaleString('vi-VN')}₫
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="md:col-span-2">
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-border bg-background-tertiary">
              <h3 className="font-bold text-foreground">Sản phẩm ({receipt.items?.length || 0})</h3>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th className="text-center">Số lượng</th>
                    <th className="text-right">Đơn giá nhập</th>
                    <th className="text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td>
                        <div className="font-medium text-foreground">{item.product?.name || 'Sản phẩm đã xóa'}</div>
                        <div className="text-xs text-foreground-muted mt-0.5 font-mono">
                          {item.product?.barcode || item.product?.code}
                        </div>
                      </td>
                      <td className="text-center font-semibold">
                        {item.quantity}
                      </td>
                      <td className="text-right">
                        {(item.unitPrice || 0).toLocaleString('vi-VN')}₫
                      </td>
                      <td className="text-right font-bold text-primary-600">
                        {(item.totalPrice || 0).toLocaleString('vi-VN')}₫
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
