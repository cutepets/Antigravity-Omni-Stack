'use client';
import Image from 'next/image';

import { usePosStore } from '../../../../stores/pos.store';


export default function PosCatalog({ products, services }: { products: any[], services: any[] }) {
  const addItem = usePosStore((state) => state.addItem);

  const handleAddProduct = (p: any) => {
    addItem({
      id: p.id,
      description: p.name,
      unitPrice: p.price,
      type: 'product',
    });
  };

  const handleAddService = (s: any) => {
    addItem({
      id: s.id,
      description: s.name,
      unitPrice: s.price,
      type: 'service',
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
          Hàng hóa & Sản phẩm <span>📦</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(p => (
            <div 
              key={p.id} 
              onClick={() => handleAddProduct(p)}
              className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-amber-400 hover:shadow-md transition-all group"
            >
              <div className="aspect-square bg-slate-100 rounded-lg mb-3 flex items-center justify-center text-slate-400 group-hover:bg-amber-50">
                {p.image ? <Image src={p.image} alt={p.name} className="w-full h-full object-cover rounded-lg" width={400} height={400} unoptimized /> : 'No Image'}
              </div>
              <h4 className="font-semibold text-sm line-clamp-2">{p.name}</h4>
              <p className="text-amber-600 font-bold mt-1 text-sm">{p.price.toLocaleString('vi-VN')} đ</p>
              <p className="text-xs text-slate-500 mt-1">Tồn: {p.stock} {p.unit}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
          Dịch vụ Spa & Khác <span>💅</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {services.map(s => (
            <div 
              key={s.id} 
              onClick={() => handleAddService(s)}
              className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group flex flex-col justify-between min-h-32"
            >
              <h4 className="font-semibold text-sm">{s.name}</h4>
              <p className="text-blue-600 font-bold mt-2 text-sm">{s.price.toLocaleString('vi-VN')} đ</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
