'use client';
import { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Check } from 'lucide-react';

const branches = [
  { id: '1', name: 'Tô Hiệu' },
  { id: '2', name: 'Nguyễn Khang' },
  { id: '3', name: 'Khâm Thiên' },
];

export function PosBranchSelect() {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(branches[0]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        className="flex items-center gap-1.5 text-sm hover:opacity-90 bg-transparent hover:bg-black/10 px-2 py-1.5 rounded-[4px] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        title="Đổi chi nhánh"
      >
        <MapPin size={15} /> 
        <span className="font-semibold">{selected.name}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden z-[100] text-gray-800 animate-in slide-in-from-top-1 duration-150">
          <div className="py-1 flex flex-col">
            {branches.map(b => (
              <button 
                key={b.id}
                className="flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors"
                onClick={() => {
                  setSelected(b);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-gray-500" />
                  <span className={selected.id === b.id ? "font-semibold text-primary-700" : "text-gray-700"}>
                    {b.name}
                  </span>
                </div>
                {selected.id === b.id && <Check size={14} className="text-primary-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
