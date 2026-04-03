'use client';

import { useState } from 'react';
import KanbanBoard from './components/KanbanBoard';

export default function GroomingPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="p-6 h-[calc(100vh-4rem)] bg-slate-50 overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Lịch hẹn Spa & Grooming</h1>
          <p className="text-sm text-slate-500">Kéo thả thẻ để cập nhật trạng thái</p>
        </div>
        
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            placeholder="Tìm theo Pet, SĐT..."
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            Lên Lịch Mới
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <KanbanBoard />
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 animate-in slide-in-from-bottom-4 duration-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Tạo lịch hẹn Spa</h2>
            {/* TODO: Add AddGroomingModal component here */}
            <div className="p-8 text-center text-slate-500 border-2 border-dashed rounded-lg mb-6 bg-slate-50">
              Form nhập liệu Lịch Hẹn...
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Hủy
              </button>
              <button className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">
                Lưu Lịch Hẹn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
