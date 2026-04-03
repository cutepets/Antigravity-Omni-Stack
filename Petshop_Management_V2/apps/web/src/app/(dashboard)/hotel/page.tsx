'use client';

import { useState } from 'react';
import CageMap from './components/CageMap';

export default function HotelPage() {
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');

  return (
    <div className="p-6 h-[calc(100vh-4rem)] bg-slate-50 flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Pet Boarding Hotel</h1>
          <p className="text-sm text-slate-500">Quản lý nhận phòng, lưu trú đêm</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-200 p-1 rounded-lg flex text-sm font-medium">
            <button 
              onClick={() => setActiveTab('map')}
              className={`px-4 py-1.5 rounded-md transition-colors ${activeTab === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Bản đồ
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={`px-4 py-1.5 rounded-md transition-colors ${activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Danh sách
            </button>
          </div>

          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
             Nhận Phòng Mới
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-slate-100">
        {activeTab === 'map' ? (
          <CageMap />
        ) : (
          <div className="p-8 text-center text-slate-400">
            {/* Table placeholder */}
            Hiển thị danh sách lưu trú Data Table...
          </div>
        )}
      </div>
    </div>
  );
}
