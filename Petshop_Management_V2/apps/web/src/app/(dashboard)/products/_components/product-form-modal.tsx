'use client'

import { useState, useEffect } from 'react'
import { X, Save, ImagePlus, Plus, Trash2 } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { inventoryApi } from '@/lib/api/inventory.api'
import { toast } from 'sonner'

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  initialData?: any
  onSuccess: () => void
}

export function ProductFormModal({ isOpen, onClose, initialData, onSuccess }: ProductFormModalProps) {
  const isEditing = !!initialData
  
  const [activeTab, setActiveTab] = useState<'info' | 'pricing' | 'variants' | 'settings'>('info')

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => inventoryApi.getCategories() })
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: () => inventoryApi.getBrands() })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: () => inventoryApi.getUnits() })

  const [formData, setFormData] = useState({
    name: '', sku: '', productCode: '', barcode: '',
    category: '', brand: '', unit: 'Cái', supplierId: '',
    price: 0, costPrice: 0, wholesalePrice: 0, vat: 0,
    stock: 0, minStock: 5, weight: 0,
    conversionRate: 1, conversionUnit: '', description: '', tags: '',
    isActive: true
  })

  useEffect(() => {
    if (initialData && isOpen) {
      setFormData({
        name: initialData.name || '',
        sku: initialData.sku || '',
        productCode: initialData.productCode || '',
        barcode: initialData.barcode || '',
        category: initialData.category || '',
        brand: initialData.brand || '',
        unit: initialData.unit || 'Cái',
        supplierId: initialData.supplierId || '',
        price: initialData.price || 0,
        costPrice: initialData.costPrice || 0,
        wholesalePrice: initialData.wholesalePrice || 0,
        vat: initialData.vat || 0,
        stock: initialData.stock || 0,
        minStock: initialData.minStock || 5,
        weight: initialData.weight || 0,
        conversionRate: initialData.conversionRate || 1,
        conversionUnit: initialData.conversionUnit || '',
        description: initialData.description || '',
        tags: initialData.tags || '',
        isActive: initialData.isActive ?? true
      })
    } else if (isOpen) {
      setFormData({
        name: '', sku: '', productCode: '', barcode: '',
        category: '', brand: '', unit: 'Cái', supplierId: '',
        price: 0, costPrice: 0, wholesalePrice: 0, vat: 0,
        stock: 0, minStock: 5, weight: 0,
        conversionRate: 1, conversionUnit: '', description: '', tags: '',
        isActive: true
      })
    }
  }, [initialData, isOpen])

  const mutation = useMutation({
    mutationFn: (data: any) => isEditing ? inventoryApi.updateProduct(initialData.id, data) : inventoryApi.createProduct(data),
    onSuccess: () => {
      toast.success(isEditing ? 'Cập nhật thành công' : 'Thêm sản phẩm thành công')
      onSuccess()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      ...formData,
      price: Number(formData.price),
      costPrice: Number(formData.costPrice),
      wholesalePrice: Number(formData.wholesalePrice),
      vat: Number(formData.vat),
      stock: Number(formData.stock),
      minStock: Number(formData.minStock),
      weight: Number(formData.weight),
      conversionRate: Number(formData.conversionRate),
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData(f => ({ ...f, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setFormData(f => ({ ...f, [name]: value }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-background-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="card p-0 relative w-full flex flex-col max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
      
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-background-tertiary flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {isEditing ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col h-full bg-background/50">
            <div className="flex border-b border-border bg-background px-6 pt-4 gap-6 shrink-0">
              <button type="button" onClick={() => setActiveTab('info')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'info' ? 'border-primary-500 text-primary-500' : 'border-transparent text-foreground-muted hover:text-foreground'}`}>Thông tin cơ bản</button>
              <button type="button" onClick={() => setActiveTab('pricing')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pricing' ? 'border-primary-500 text-primary-500' : 'border-transparent text-foreground-muted hover:text-foreground'}`}>Giá & Kho</button>
              <button type="button" onClick={() => setActiveTab('settings')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings' ? 'border-primary-500 text-primary-500' : 'border-transparent text-foreground-muted hover:text-foreground'}`}>Mở rộng</button>
            </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Tên sản phẩm <span className="text-error">*</span></label>
                  <input required name="name" value={formData.name} onChange={handleChange} className="form-input w-full" placeholder="Ví dụ: Hạt Royal Canin" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Mã SKU</label>
                    <input name="sku" value={formData.sku} onChange={handleChange} className="form-input w-full" placeholder="Để trống tự tạo" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Mã vạch (Barcode)</label>
                    <input name="barcode" value={formData.barcode} onChange={handleChange} className="form-input w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Danh mục</label>
                    <select name="category" value={formData.category} onChange={handleChange} className="form-input w-full">
                      <option value="">Chọn danh mục</option>
                      {categories?.data?.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Thương hiệu</label>
                    <select name="brand" value={formData.brand} onChange={handleChange} className="form-input w-full">
                      <option value="">Chọn thương hiệu</option>
                      {brands?.data?.map((b: any) => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Ảnh sản phẩm</label>
                  <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-foreground-muted hover:bg-background-secondary transition-colors cursor-pointer bg-background">
                    <ImagePlus size={24} className="mb-2" />
                    <span className="text-sm">Click hoặc kéo thả ảnh vào đây</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Mô tả ngắn</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} className="form-input w-full h-24 resize-none" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="card p-4 space-y-4">
                  <h3 className="font-semibold mb-2">Thông tin giá</h3>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Giá bán lẻ <span className="text-error">*</span></label>
                    <div className="relative">
                      <input type="number" required name="price" value={formData.price} onChange={handleChange} className="form-input w-full pr-12" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">VND</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Giá vốn</label>
                      <input type="number" name="costPrice" value={formData.costPrice} onChange={handleChange} className="form-input w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Giá bán sỉ (Tùy chọn)</label>
                      <input type="number" name="wholesalePrice" value={formData.wholesalePrice} onChange={handleChange} className="form-input w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Thuế VAT (%)</label>
                    <input type="number" name="vat" value={formData.vat} onChange={handleChange} className="form-input w-full" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="card p-4 space-y-4">
                  <h3 className="font-semibold mb-2">Quản lý kho</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Tồn kho hiện tại</label>
                      <input type="number" name="stock" value={formData.stock} onChange={handleChange} className="form-input w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Định mức tồn thấp</label>
                      <input type="number" name="minStock" value={formData.minStock} onChange={handleChange} className="form-input w-full" />
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-border mt-4">
                    <h4 className="text-sm font-medium mb-3">Quy đổi đơn vị</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs mb-1.5">Đơn vị cơ bản</label>
                        <select name="unit" value={formData.unit} onChange={handleChange} className="form-input w-full text-sm">
                          <option value="Cái">Cái</option>
                          <option value="Bao">Bao</option>
                          <option value="Hộp">Hộp</option>
                          <option value="Lon">Lon</option>
                          <option value="Gói">Gói</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs mb-1.5">Đơn vị lớn (nếu có)</label>
                        <input name="conversionUnit" value={formData.conversionUnit} onChange={handleChange} className="form-input w-full text-sm" placeholder="VD: Lốc, Thùng" />
                      </div>
                      <div>
                        <label className="block text-xs mb-1.5">Tỷ lệ quy đổi</label>
                        <input type="number" name="conversionRate" value={formData.conversionRate} onChange={handleChange} className="form-input w-full text-sm" placeholder="VD: 12" />
                      </div>
                    </div>
                    {formData.conversionUnit && (
                      <p className="text-xs text-foreground-muted mt-2">1 {formData.conversionUnit} = {formData.conversionRate} {formData.unit}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4 max-w-2xl">
              <div className="card p-4 space-y-4 relative overflow-hidden">
                <div className="grid grid-cols-2 gap-4 z-10 relative">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Mã sản phẩm NSX</label>
                    <input name="productCode" value={formData.productCode} onChange={handleChange} className="form-input w-full" placeholder="" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Trọng lượng (Gram)</label>
                    <input type="number" name="weight" value={formData.weight} onChange={handleChange} className="form-input w-full" placeholder="" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1.5">Tags (Phân tách bằng dấu phẩy)</label>
                  <input name="tags" value={formData.tags} onChange={handleChange} className="form-input w-full" placeholder="thuc_an_hat, meo_con, giam_gia" />
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-border mt-4">
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} className="sr-only peer" />
                    <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary-500 peer-focus:ring-2 peer-focus:ring-primary-300 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Bán sản phẩm này</p>
                    <p className="text-xs text-foreground-muted">Hiển thị trong kho và POS</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background border-t border-border mt-auto shrink-0">
            <button type="button" onClick={onClose} className="btn-outline h-10 px-4 rounded-xl">Hủy</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary liquid-button h-10 px-6 rounded-xl">
              {mutation.isPending ? 'Đang lưu...' : (isEditing ? 'Lưu thay đổi' : 'Tạo sản phẩm')}
            </button>
          </div>
          </form>
        </div>
      </div>
    </div>
  )
}
