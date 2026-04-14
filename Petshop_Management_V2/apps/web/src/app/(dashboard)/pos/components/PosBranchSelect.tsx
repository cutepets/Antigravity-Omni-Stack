'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ChevronDown, Check } from 'lucide-react';
import { settingsApi } from '@/lib/api';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useAuthStore } from '@/stores/auth.store';
import { useActiveTab, usePosStore } from '@/stores/pos.store';

export function PosBranchSelect() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTab = useActiveTab();
  const setBranch = usePosStore((state) => state.setBranch);
  const { hasPermission, allowedBranchIds, allowedBranches } = useAuthorization();
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const switchBranch = useAuthStore((state) => state.switchBranch);

  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: settingsApi.getBranches,
    staleTime: 5 * 60 * 1000,
  });

  const displayBranches = useMemo(() => {
    const sourceBranches = (branches.length > 0 ? branches : allowedBranches) ?? [];
    const activeBranches = sourceBranches.filter((branch: any) => branch?.isActive !== false);

    if (hasPermission('branch.access.all')) {
      return activeBranches;
    }

    return activeBranches.filter((branch: any) => allowedBranchIds.includes(branch.id));
  }, [allowedBranchIds, allowedBranches, branches, hasPermission]);

  const selectedBranch =
    displayBranches.find((branch: any) => branch.id === activeBranchId) ??
    displayBranches[0] ??
    null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!selectedBranch) return;

    if (activeBranchId !== selectedBranch.id) {
      switchBranch(selectedBranch.id);
      return;
    }

    if (!activeTab?.linkedOrderId && activeTab?.branchId !== selectedBranch.id) {
      setBranch(selectedBranch.id);
    }
  }, [activeBranchId, activeTab?.branchId, activeTab?.linkedOrderId, selectedBranch, setBranch, switchBranch]);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        className="flex items-center gap-1.5 text-sm hover:opacity-90 bg-transparent hover:bg-black/10 px-2 py-1.5 rounded-[4px] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        title="Đổi chi nhánh"
      >
        <MapPin size={15} /> 
        <span className="font-semibold">{selectedBranch?.name ?? 'Chọn chi nhánh'}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden z-[100] text-gray-800 animate-in slide-in-from-top-1 duration-150">
          <div className="py-1 flex flex-col">
            {displayBranches.map((branch: any) => (
              <button 
                key={branch.id}
                className="flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors"
                onClick={() => {
                  switchBranch(branch.id);
                  if (!activeTab?.linkedOrderId) {
                    setBranch(branch.id);
                  }
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-gray-500" />
                  <span className={selectedBranch?.id === branch.id ? "font-semibold text-primary-700" : "text-gray-700"}>
                    {branch.name}
                  </span>
                </div>
                {selectedBranch?.id === branch.id && <Check size={14} className="text-primary-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
