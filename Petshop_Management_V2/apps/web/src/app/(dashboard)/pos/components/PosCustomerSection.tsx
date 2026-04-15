import { useState } from 'react';
import { User, ChevronDown } from 'lucide-react';
import { usePosStore, useActiveTab } from '@/stores/pos.store';
import { useCustomerSearch } from '@/components/search/use-commerce-search';

export function PosCustomerSection() {
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  
  const store = usePosStore();
  const activeTab = useActiveTab();
  
  const { data: customers = [] } = useCustomerSearch(customerQuery);

  if (!activeTab) return null;

  const handleSelectCustomer = (customer: any) => {
    store.setCustomer(customer.id, customer.fullName);
    setShowCustomerSearch(false);
    setCustomerQuery('');
  };

  return (
    <div className="pos-customer" style={{ position: 'relative' }}>
      <button
        className="pos-customer__btn flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background-tertiary border border-border text-foreground hover:border-primary-500 transition-colors"
        onClick={() => setShowCustomerSearch(!showCustomerSearch)}
      >
        <User size={16} />
        <span className="text-sm">{activeTab.customerName}</span>
        <ChevronDown size={14} />
      </button>

      {showCustomerSearch && (
        <>
          {/* Backdrop for click outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowCustomerSearch(false)}
          />
          <div className="absolute top-full right-0 mt-1 w-72 max-h-80 bg-background-secondary border border-border rounded-xl shadow-xl overflow-hidden z-50 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-border">
              <input
                className="w-full px-3 py-2 bg-background-base rounded-md border border-border text-sm focus:outline-none focus:border-primary-500 transition-colors"
                placeholder="Tìm khách hàng (tên, SĐT)..."
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="overflow-y-auto p-1 flex pl-0 flex-col">
              <button
                className="flex items-center gap-3 w-full p-2.5 rounded-md hover:bg-background-tertiary text-left text-sm transition-colors text-foreground"
                onClick={() => { store.setCustomer(undefined, 'Khách lẻ'); setShowCustomerSearch(false); }}
              >
                <div className="w-8 h-8 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
                <span className="font-medium">Khách lẻ</span>
              </button>
              
              {(customers as any[]).map((c: any) => (
                <button
                  key={c.id}
                  className="flex items-center gap-3 w-full p-2.5 rounded-md hover:bg-background-tertiary text-left text-sm transition-colors text-foreground"
                  onClick={() => handleSelectCustomer(c)}
                >
                  <div className="w-8 h-8 rounded-full bg-background-base border border-border flex items-center justify-center shrink-0">
                    <User size={16} className="text-foreground-muted" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-medium truncate">{c.fullName}</span>
                    <span className="text-xs text-foreground-muted">{c.phone}</span>
                  </div>
                </button>
              ))}

              {customerQuery.length >= 2 && customers.length === 0 && (
                <div className="p-4 text-center text-sm text-foreground-muted">
                  Không tìm thấy khách hàng &quot;{customerQuery}&quot;
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
