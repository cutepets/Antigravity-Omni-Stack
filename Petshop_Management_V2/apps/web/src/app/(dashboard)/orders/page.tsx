'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:3001/orders', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrders(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Đơn hàng</h1>
          <p className="text-sm text-muted-foreground mr-4">Lịch sử giao dịch bán hàng (POS)</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700">Mã đơn</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Khách hàng</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Ngày tạo</th>
              <th className="px-6 py-4 font-semibold text-slate-700 text-right">Tổng tiền</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Trạng thái TT</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">Đang tải dữ liệu...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">Chưa có đơn hàng nào</td></tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-blue-600">#{o.orderNumber}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{o.customerName}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{format(new Date(o.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-800">
                    {o.total.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      o.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 
                      o.paymentStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
