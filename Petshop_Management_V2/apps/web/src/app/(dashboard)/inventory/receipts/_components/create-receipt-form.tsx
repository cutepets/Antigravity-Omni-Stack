'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Trash2, Save, ScanBarcode, AlertTriangle } from 'lucide-react'
import { stockApi } from '@/lib/api/stock.api'
import { inventoryApi } from '@/lib/api/inventory.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthStore } from '@/stores/auth.store'


interface SelectedItem {
  productId: string
  productCode: string
  barcode: string
  name: string
  sellingPrice: number
  quantity: number
  unitCost: number
}

export function CreateReceiptForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const activeBranchId = useAuthStore((state) => state.activeBranchId)

  const [supplierId, setSupplierId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  const [items, setItems] = useState<SelectedItem[]>([])

  // Fetch Suppliers
  const { data: suppliersRes } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => stockApi.getSuppliers(),
  })
  const suppliers = (suppliersRes as any)?.data ?? []

  // Auto focus barcode scanner input
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

  const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!search.trim()) return

      setIsSearching(true)
      try {
        const res = await inventoryApi.getProducts({ search: search.trim() })
        const products = res?.data || []
        
        if (products.length === 1 || (products.length > 0 && products[0].barcode === search.trim())) {
          // Add first matching product
          addProductToReceipt(products[0])
          setSearch('') // Clear search after adding
        } else if (products.length > 1) {
          toast.info('Tìm thấy nhiều sản phẩm, vui lòng chọn từ danh sách dropdown (Chưa vẽ popup, tạm lấy SP đầu tiên)')
          // In a real app, you'd show a dropdown. We'll just take the first for simplicity if exact match fails
          addProductToReceipt(products[0])
          setSearch('')
        } else {
          toast.error('Không tìm thấy sản phẩm với mã này!')
        }
      } catch (error) {
        toast.error('Lỗi tìm kiếm sản phẩm')
      } finally {
        setIsSearching(false)
        // Keep focus on input for next scan
        setTimeout(() => searchInputRef.current?.focus(), 10)
      }
    }
  }

  const addProductToReceipt = (product: any) => {
    setItems((prev) => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [{
        productId: product.id,
        productCode: product.code,
        barcode: product.barcode,
        name: product.name,
        sellingPrice: product.price || 0,
        quantity: 1,
        unitCost: product.costPrice || 0,
      }, ...prev]
    })
  }

  const updateItem = (productId: string, field: keyof SelectedItem, value: number) => {
    setItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, [field]: Math.max(0, value) }
      }
      return item
    }))
  }

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)

  const createMutation = useMutation({
    mutationFn: (data: any) => stockApi.createReceipt(data),
    onSuccess: (res) => {
      toast.success('Đã tạo phiếu nhập lưu nháp thành công!')
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      router.push(`/inventory/receipts/${res.data?.data?.id || res.data?.id}`)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi tạo phiếu')
    }
  })

  const handleSave = () => {
    if (items.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 sản phẩm vào phiếu nhập')
      return
    }
    createMutation.mutate({
      supplierId: supplierId || undefined,
      branchId: activeBranchId || undefined,
      notes,
      items: items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitCost: i.unitCost
      }))
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-4">
        {/* Search / Scan Barcode Box */}
        <div className="card p-4 flex flex-col gap-3">
          <div className="relative w-full">
            <div className="absolute top-1/2 left-3 -translate-y-1/2 text-primary-500">
              <ScanBarcode size={20} />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Quét mã vạch (Barcode) hoặc gõ mã sản phẩm rồi ấn Enter..."
              className="form-input pl-10 pr-4 py-3 w-full text-lg shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              disabled={isSearching}
            />
            {isSearching && (
              <div className="absolute top-1/2 right-3 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <p className="text-xs text-foreground-muted flex items-center gap-1">
            <AlertTriangle size={12} /> Hỗ trợ nhập liệu bằng súng bắn mã vạch. Bắn xong hệ thống tự Enter.
          </p>
        </div>

        {/* Selected Items */}
        <div className="card p-0 overflow-hidden flex-1 min-h-[400px]">
          <div className="w-full overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th className="w-24 text-center">SL</th>
                  <th className="w-32 text-right">Đơn giá nhập</th>
                  <th className="w-32 text-right">Thành tiền</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-foreground-muted">
                      Chưa có sản phẩm nào. Lướt quét mã vạch ở ô trên để thêm.
                    </td>
                  </tr>
                ) : (
                  items.map(item => {
                    const profitMargin = item.sellingPrice > 0 
                      ? ((item.sellingPrice - item.unitCost) / item.sellingPrice) * 100 
                      : 0;
                    
                    const isLoss = profitMargin <= 0 && item.sellingPrice > 0;
                    const totalLine = item.quantity * item.unitCost;

                    return (
                      <tr key={item.productId} className="group hover:bg-background-secondary/20">
                        <td>
                          <div className="font-semibold text-foreground">{item.name}</div>
                          <div className="text-xs text-foreground-muted mt-1 font-mono">
                            {item.barcode || item.productCode}
                          </div>
                        </td>
                        <td>
                          <input 
                            type="number"
                            min="1"
                            className="form-input text-center px-1 py-1 w-full"
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(item.productId, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td>
                          <div className="flex flex-col gap-1 items-end">
                            <input 
                              type="number"
                              min="0"
                              className="form-input text-right px-2 py-1 w-full"
                              value={item.unitCost || ''}
                              onChange={(e) => updateItem(item.productId, 'unitCost', Number(e.target.value) || 0)}
                            />
                            {item.sellingPrice > 0 && (
                              <div className={`text-[11px] font-medium flex items-center justify-end w-full ${isLoss ? 'text-error' : 'text-success'}`}>
                                {isLoss ? (
                                  <><AlertTriangle size={10} className="mr-0.5" /> Lỗ hoặc huề vốn ({profitMargin.toFixed(1)}%)</>
                                ) : (
                                  <>Lãi: {profitMargin.toFixed(1)}%</>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="text-right font-bold text-primary-600">
                          {totalLine.toLocaleString('vi-VN')}₫
                        </td>
                        <td className="text-center">
                          <button 
                            className="text-foreground-muted hover:text-error transition-colors p-1"
                            onClick={() => removeItem(item.productId)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Receipt Settings */}
        <div className="card p-4 flex flex-col gap-4">
          <h3 className="font-bold border-b border-border pb-2">Thông tin phiếu nhập</h3>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nhà cung cấp</label>
            <select 
              className="form-input w-full"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">-- Chọn khách lẻ / Không rõ --</option>
              {suppliers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Ghi chú phiếu nhập</label>
            <textarea 
              className="form-input w-full resize-none"
              rows={3}
              placeholder="Vd: Nhập hàng đợt 1 tháng 4..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Summary & Save */}
        <div className="card p-4 bg-primary-500/5 border-primary-500/20">
          <div className="flex justify-between items-center mb-2 text-foreground-muted text-sm">
            <span>Tổng số lượng:</span>
            <span>{items.reduce((s, i) => s + i.quantity, 0)} sản phẩm</span>
          </div>
          <div className="flex justify-between items-end mt-2 pt-2 border-t border-primary-500/10">
            <span className="font-bold text-foreground">Tổng tiền:</span>
            <span className="text-2xl font-black text-primary-600">{totalAmount.toLocaleString('vi-VN')}₫</span>
          </div>

          <button 
            className="btn-primary liquid-button w-full mt-6 flex items-center justify-center gap-2 py-3 text-base"
            disabled={createMutation.isPending || items.length === 0}
            onClick={handleSave}
          >
            {createMutation.isPending ? 'Đang xử lý...' : (
              <>
                <Save size={18} /> Lưu Phiếu Nháp
              </>
            )}
          </button>
          <p className="text-center text-xs text-foreground-muted mt-2">
            Phiếu sẽ được lưu ở trạng thái "Bản nháp", kho chưa được cộng ngay.
          </p>
        </div>
      </div>
    </div>
  )
}

