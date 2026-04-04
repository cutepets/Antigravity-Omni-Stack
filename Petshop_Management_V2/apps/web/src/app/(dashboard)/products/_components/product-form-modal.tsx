'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Save, ImagePlus, Plus, Trash2, ChevronDown, ChevronUp, Tag } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { inventoryApi } from '@/lib/api/inventory.api'
import { toast } from 'sonner'

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  initialData?: any
  onSuccess: () => void
}

const removeAccents = (str: string) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

const generateSKU = (name: string) => {
  if (!name) return '';
  return name.split(/\s+/).map(word => {
    const cleanWord = removeAccents(word);
    return cleanWord.charAt(0).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }).join('');
}

const cartesian = (arrays: string[][]) => {
  if (arrays.length === 0) return [[]] as string[][];
  return arrays.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat() as string[])), [[]] as string[][]);
}

export function ProductFormModal({ isOpen, onClose, initialData, onSuccess }: ProductFormModalProps) {
  const isEditing = !!initialData
  
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => inventoryApi.getCategories() })
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: () => inventoryApi.getBrands() })

  const [formData, setFormData] = useState({
    name: '', sku: '', productCode: '', barcode: '',
    category: '', brand: '', unit: 'cái', importName: '',
    price: 0, vat: 0, weight: 0, minStock: 5, tags: '',
    isActive: true
  })

  // === Attributes ===
  const [hasAttributes, setHasAttributes] = useState(false)
  const [attributes, setAttributes] = useState<{name: string, values: string[]}[]>([
    { name: 'Loại', values: [] }
  ])

  // === Conversions ===
  const [hasConversions, setHasConversions] = useState(false)
  const [conversions, setConversions] = useState<{applyTo: string, mainQty: number, mainUnit: string, convQty: number, convUnit: string}[]>([
    { applyTo: 'all', mainQty: 12, mainUnit: 'cái', convQty: 1, convUnit: 'Thùng' }
  ])

  // Initial load
  useEffect(() => {
    if (initialData && isOpen) {
      setFormData({
        name: initialData.name || '',
        sku: initialData.sku || '',
        productCode: initialData.productCode || '',
        barcode: initialData.barcode || '',
        category: initialData.category || '',
        brand: initialData.brand || '',
        unit: initialData.unit || 'cái',
        importName: initialData.importName || '',
        price: initialData.price || 0,
        vat: initialData.vat || 0,
        weight: initialData.weight || 0,
        minStock: initialData.minStock || 5,
        tags: initialData.tags || '',
        isActive: initialData.isActive ?? true
      })
      
      try {
        if (initialData.attributes) {
          const parsedAttr = JSON.parse(initialData.attributes)
          if (parsedAttr && parsedAttr.length > 0) {
            setHasAttributes(true)
            setAttributes(parsedAttr)
          }
        }
      } catch (e) {}
    } else if (isOpen) {
      setFormData({
        name: '', sku: '', productCode: '', barcode: '',
        category: '', brand: '', unit: 'cái', importName: '',
        price: 0, vat: 0, weight: 0, minStock: 5, tags: '',
        isActive: true
      })
      setHasAttributes(false)
      setAttributes([{ name: 'Loại', values: [] }])
      setHasConversions(false)
      setConversions([{ applyTo: 'all', mainQty: 12, mainUnit: 'cái', convQty: 1, convUnit: 'Thùng' }])
    }
  }, [initialData, isOpen])

  // Automatically update unit of conversions when main unit changes
  useEffect(() => {
    setConversions(c => c.map(item => ({ ...item, mainUnit: formData.unit })))
  }, [formData.unit])

  // Auto Generate Variants
  const generatedVariants = useMemo(() => {
    let baseCombo = [{ name: formData.name || 'Sản phẩm mới', attrs: [] as string[] }]

    // 1. Multiply by Attributes
    if (hasAttributes) {
      const validAttrs = attributes.filter(a => a.values.length > 0)
      if (validAttrs.length > 0) {
        const valueArrays = validAttrs.map(a => a.values)
        const matrix = cartesian(valueArrays)
        baseCombo = matrix.map(combo => ({
          name: `${formData.name || 'SP'} - ${combo.join(' - ')}`,
          attrs: combo
        }))
      }
    }

    // 2. Base Variants Array
    const result: any[] = []
    
    baseCombo.forEach((bc, idx) => {
       const baseSku = formData.sku ? `${formData.sku}${idx > 0 ? idx : ''}` : `SKU${idx}`
       
       // Add Base
       result.push({
         isConversion: false,
         parentId: null,
         name: bc.name,
         sku: baseSku,
         unit: formData.unit,
         attrs: bc.attrs,
         weight: formData.weight,
         price: formData.price
       })

       // Add Conversions
       if (hasConversions) {
         conversions.filter(c => c.applyTo === 'all' || (hasAttributes && bc.attrs.includes(c.applyTo))).forEach((conv, cIdx) => {
           result.push({
             isConversion: true,
             parentId: baseSku, // use sku as ref
             name: `${bc.name} - ${conv.convUnit}`,
             sku: `${baseSku}-${conv.convUnit.substring(0, 2).toUpperCase()}`,
             unit: conv.convUnit,
             attrs: bc.attrs,
             conversionRate: conv.mainQty,
             weight: formData.weight * conv.mainQty,
             price: formData.price * conv.mainQty
           })
         })
       }
    })

    return result
  }, [formData, hasAttributes, attributes, hasConversions, conversions])

  const mutation = useMutation({
    mutationFn: async (_: any) => {
      // Tách variants ra khỏi payload — Prisma nested write cần xử lý riêng
      const basePayload = {
        name: formData.name,
        sku: formData.sku || undefined,
        productCode: formData.productCode || undefined,
        barcode: formData.barcode || undefined,
        category: formData.category || undefined,
        brand: formData.brand || undefined,
        unit: formData.unit,
        importName: formData.importName || undefined,
        price: Number(formData.price),
        vat: Number(formData.vat),
        weight: Number(formData.weight) || undefined,
        minStock: Number(formData.minStock),
        tags: formData.tags || undefined,
        isActive: formData.isActive,
        attributes: hasAttributes ? JSON.stringify(attributes) : undefined,
      }

      if (isEditing) {
        // 1. Update thông tin cơ bản
        await inventoryApi.updateProduct(initialData.id, basePayload)

        // 2. Nếu có variants, xóa cũ và tạo mới
        if (generatedVariants.length > 0) {
          // Xóa variants cũ
          if (initialData.variants?.length > 0) {
            await Promise.all(
              initialData.variants.map((v: any) => inventoryApi.deleteVariant(v.id))
            )
          }
          // Tạo variants mới — bọc trong { variants: [...] } for backend
          const variantPayload = generatedVariants.map(v => ({
            name: v.name,
            sku: v.sku || undefined,
            price: Number(v.price) || Number(formData.price),
            conversions: v.isConversion ? JSON.stringify({ rate: v.conversionRate }) : undefined,
          }))
          await inventoryApi.batchCreateVariants(initialData.id, { variants: variantPayload })
        }
        return { success: true }
      } else {
        // Tạo mới: gửi dạng nested create
        const payload: any = { ...basePayload }
        if (generatedVariants.length > 0) {
          payload.variants = {
            create: generatedVariants.map(v => ({
              name: v.name,
              sku: v.sku || undefined,
              price: Number(v.price) || Number(formData.price),
              conversions: v.isConversion ? JSON.stringify({ rate: v.conversionRate }) : undefined,
            }))
          }
        }
        return inventoryApi.createProduct(payload)
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Cập nhật thành công' : 'Thêm sản phẩm thành công')
      onSuccess()
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra, vui lòng thử lại';
      toast.error(msg)
    }
  })

  // --- Handlers ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({})
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData(f => ({ ...f, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setFormData(f => {
        const newData = { ...f, [name]: value }
        if (name === 'name' && !isEditing) newData.sku = generateSKU(value)
        return newData;
      })
    }
  }

  // --- Render Options ---
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pb-20 pt-10">
      <div className="fixed inset-0 bg-background-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="card p-0 relative w-full flex flex-col max-w-[900px] h-full max-h-[92vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
      
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-background flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-500">
                <BoxIcon size={18} />
             </div>
             <h2 className="text-xl font-bold text-foreground">
               {isEditing ? "Cập nhật sản phẩm" : "Thêm sản phẩm"}
             </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto bg-background-secondary/30 relative">
           <form id="productForm" onSubmit={handleSubmit} className="p-6 flex flex-col gap-6 max-w-[850px] mx-auto">
              
              {/* SECTION: THÔNG TIN CHUNG */}
              <div className="border border-border bg-background rounded-2xl overflow-hidden shadow-sm">
                 <div className="px-5 py-3 border-b border-border bg-background-tertiary/50 text-[11px] font-bold uppercase tracking-wider text-foreground-muted">Thông tin chung</div>
                 <div className="p-5 flex gap-6">
                    {/* Left: Avatar */}
                    <div className="w-32 h-32 rounded-xl border-2 border-dashed border-border bg-background-secondary flex flex-col items-center justify-center text-foreground-muted hover:bg-background-tertiary transition-colors cursor-pointer shrink-0">
                       <ImagePlus size={24} className="mb-2" />
                       <span className="text-[10px] uppercase font-bold tracking-wider">Tải ảnh</span>
                    </div>

                    {/* Right: Info */}
                    <div className="flex-1 flex flex-col gap-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Tên sản phẩm <span className="text-error">*</span></label>
                             <input required name="name" value={formData.name} onChange={handleChange} className="form-input w-full font-semibold" placeholder="thức ăn cho mèo Canin 1kg" />
                          </div>
                          <div>
                             <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Nhãn hiệu</label>
                             <select name="brand" value={formData.brand} onChange={handleChange} className="form-input w-full">
                                <option value="">Chọn hoặc gõ tìm...</option>
                                {brands?.data?.map((b: any) => <option key={b.id} value={b.name}>{b.name}</option>)}
                             </select>
                          </div>
                       </div>
                       <div>
                          <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Tên nhập hàng <span className="italic font-normal">(không bắt buộc)</span></label>
                          <input name="importName" value={formData.importName} onChange={handleChange} className="form-input w-full" placeholder="Phục vụ đối soát với hoá đơn nhập kho..." />
                       </div>

                       <div className="grid grid-cols-6 gap-3 pt-2">
                          <div className="col-span-1">
                             <label className="block text-xs font-medium mb-1.5 text-foreground-muted">SKU</label>
                             <input name="sku" value={formData.sku} onChange={handleChange} className="form-input w-full text-xs" />
                          </div>
                          <div className="col-span-2">
                             <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Mã vạch</label>
                             <input name="barcode" value={formData.barcode} onChange={handleChange} className="form-input w-full text-xs" />
                          </div>
                          <div className="col-span-1">
                             <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Đơn vị bán</label>
                             <input name="unit" required value={formData.unit} onChange={handleChange} className="form-input w-full text-xs" placeholder="Cái" />
                          </div>
                          <div className="col-span-1">
                             <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Trọng lượng (g)</label>
                             <input type="number" name="weight" value={formData.weight} onChange={handleChange} className="form-input w-full text-xs" />
                          </div>
                          <div className="col-span-1">
                             <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Tồn min</label>
                             <input type="number" name="minStock" value={formData.minStock} onChange={handleChange} className="form-input w-full text-xs" />
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* SECTION: BẢNG GIÁ */}
              <div className="border border-border bg-background rounded-2xl overflow-hidden shadow-sm">
                 <div className="px-5 py-3 border-b border-border bg-background-tertiary/50 text-[11px] font-bold uppercase tracking-wider text-foreground-muted flex justify-between items-center">
                    <span>Bảng Giá</span>
                    <span className="font-normal text-xs normal-case text-foreground-muted">Giá nền — áp dụng cho tất cả phiên bản</span>
                 </div>
                 <div className="p-5 flex gap-4 items-center">
                    <div className="w-48">
                       <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Giá bán chung</label>
                       <div className="relative">
                          <input type="number" name="price" required value={formData.price} onChange={handleChange} className="form-input w-full text-right pr-9 font-semibold text-primary-500" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground-muted">đ</span>
                       </div>
                    </div>
                    <div className="text-xs text-foreground-muted italic mt-2">
                       Bạn có thể điều chỉnh giá trị riêng cho từng phiên bản ở bảng bên dưới.
                    </div>
                 </div>
              </div>

              {/* SECTION: THUỘC TÍNH PHIÊN BẢN */}
              <div className={`border ${hasAttributes ? 'border-primary-500/50 shadow-md ring-1 ring-primary-500/20' : 'border-border'} bg-background rounded-2xl overflow-hidden transition-all duration-300`}>
                 <div className="px-5 py-3 bg-background flex justify-between items-center cursor-pointer" onClick={() => setHasAttributes(!hasAttributes)}>
                    <div className="flex items-center gap-3">
                       <Tag size={16} className={hasAttributes ? 'text-primary-500' : 'text-foreground-muted'} />
                       <span className={`text-[12px] font-bold uppercase tracking-wider ${hasAttributes ? 'text-primary-500' : 'text-foreground-muted'}`}>Thuộc tính phiên bản</span>
                       {!hasAttributes && <span className="text-xs text-foreground-muted font-normal normal-case">— Màu sắc, kích thước, hương vị...</span>}
                    </div>
                    <CustomToggle checked={hasAttributes} onChange={(e) => { e.stopPropagation(); setHasAttributes(!hasAttributes) }} />
                 </div>
                 
                 {hasAttributes && (
                    <div className="p-5 border-t border-border flex flex-col gap-4 bg-background-secondary/10 relative">
                       {attributes.map((attr, index) => (
                          <div key={index} className="flex gap-4 items-start pb-4 border-b border-border/50 last:border-b-0 last:pb-0 relative">
                             <button type="button" onClick={() => setAttributes(a => a.filter((_, i) => i !== index))} className="absolute right-0 top-6 text-foreground-muted hover:text-error">
                               <Trash2 size={14} />
                             </button>
                             <div className="w-1/3">
                                <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Tên thuộc tính</label>
                                <input 
                                  className="form-input w-full font-medium" 
                                  value={attr.name} 
                                  onChange={e => {
                                    const next = [...attributes];
                                    next[index].name = e.target.value;
                                    setAttributes(next);
                                  }} 
                                  placeholder="Vd: Loại" 
                                />
                             </div>
                             <div className="w-2/3 pr-6">
                                <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Giá trị — Xong nhấn Enter</label>
                                <TagInput 
                                  values={attr.values}
                                  onChange={(newVals) => {
                                    const next = [...attributes];
                                    next[index].values = newVals;
                                    setAttributes(next);
                                  }}
                                  placeholder={attr.values.length === 0 ? "Vị gà, Vị bò..." : ""}
                                />
                             </div>
                          </div>
                       ))}
                       <button type="button" onClick={() => setAttributes(a => [...a, { name: '', values: [] }])} className="text-sm text-primary-500 font-semibold flex items-center gap-1 hover:text-primary-600 w-max mt-2">
                          <Plus size={16} /> Thêm thuộc tính khác
                       </button>
                    </div>
                 )}
              </div>

              {/* SECTION: ĐƠN VỊ QUY ĐỔI */}
              <div className={`border ${hasConversions ? 'border-success/50 shadow-md ring-1 ring-success/20' : 'border-border'} bg-background rounded-2xl overflow-hidden transition-all duration-300`}>
                 <div className="px-5 py-3 bg-background flex justify-between items-center cursor-pointer" onClick={() => setHasConversions(!hasConversions)}>
                    <div className="flex items-center gap-3">
                       <RefreshIcon size={16} className={hasConversions ? 'text-success' : 'text-foreground-muted'} />
                       <span className={`text-[12px] font-bold uppercase tracking-wider ${hasConversions ? 'text-success' : 'text-foreground-muted'}`}>Đơn vị quy đổi</span>
                       {!hasConversions && <span className="text-xs text-foreground-muted font-normal normal-case">— Túi {"->"} Thùng...</span>}
                    </div>
                    <CustomToggle variant="success" checked={hasConversions} onChange={(e) => { e.stopPropagation(); setHasConversions(!hasConversions) }} />
                 </div>

                 {hasConversions && (
                    <div className="p-5 border-t border-border flex flex-col gap-4 bg-background-secondary/10 relative">
                       {conversions.map((conv, index) => (
                          <div key={index} className="flex items-end gap-3 pb-4 border-b border-border/50 last:border-b-0 last:pb-0 relative">
                             <button type="button" onClick={() => setConversions(c => c.filter((_, i) => i !== index))} className="absolute right-0 top-8 text-foreground-muted hover:text-error">
                               <Trash2 size={14} />
                             </button>
                             <div className="w-1/4">
                                <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Áp dụng phiên bản</label>
                                <select 
                                  className="form-input w-full"
                                  value={conv.applyTo}
                                  onChange={e => { const n = [...conversions]; n[index].applyTo = e.target.value; setConversions(n) }}
                                >
                                  <option value="all">Tất cả phiên bản</option>
                                  {hasAttributes && attributes.flatMap(a => a.values).map(v => (
                                    <option key={v} value={v}>Chỉ: {v}</option>
                                  ))}
                                </select>
                             </div>
                             <div className="flex items-center gap-2">
                                <div className="w-16">
                                   <label className="block text-xs font-medium mb-1.5 text-foreground-muted">SL chính</label>
                                   <input type="number" className="form-input w-full text-center font-bold" value={conv.mainQty} onChange={e => { const n = [...conversions]; n[index].mainQty = Number(e.target.value); setConversions(n) }} />
                                </div>
                                <div className="w-24">
                                   <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Đơn vị chính</label>
                                   <input className="form-input w-full bg-background-tertiary" readOnly value={formData.unit} />
                                </div>
                             </div>
                             <div className="text-lg text-foreground-muted px-2 mb-1">=</div>
                             <div className="flex items-center gap-2 pr-6">
                                <div className="w-16">
                                   <label className="block text-xs font-medium mb-1.5 text-foreground-muted">SL quy đổi</label>
                                   <input type="number" className="form-input w-full text-center" value={conv.convQty} readOnly />
                                </div>
                                <div className="w-32">
                                   <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Đơn vị quy đổi</label>
                                   <input className="form-input w-full font-semibold" value={conv.convUnit} placeholder="Thùng" onChange={e => { const n = [...conversions]; n[index].convUnit = e.target.value; setConversions(n) }} />
                                </div>
                             </div>
                          </div>
                       ))}
                       <button type="button" onClick={() => setConversions(c => [...c, { applyTo: 'all', mainQty: 12, mainUnit: formData.unit, convQty: 1, convUnit: 'Thùng' }])} className="text-sm text-success font-semibold flex items-center gap-1 hover:text-success/80 w-max mt-2">
                          <Plus size={16} /> Thêm đơn vị khác
                       </button>
                    </div>
                 )}
              </div>

              {/* SECTION: BẢNG PHIÊN BẢN */}
              <div className="border border-border bg-background rounded-2xl overflow-hidden shadow-sm pt-4">
                 <div className="px-5 mb-3 flex items-center gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">Bảng phiên bản</span>
                    <span className="badge badge-primary px-2">{generatedVariants.length} phiên bản</span>
                 </div>
                 
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-background-tertiary/50">
                       <tr>
                          <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-winder w-14 text-center">Ảnh</th>
                          <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-winder">Tên phiên bản / đơn vị</th>
                          <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-winder w-32 border-l border-border/50">SKU</th>
                          <th className="py-2.5 px-4 text-[10px] font-bold text-foreground-muted uppercase tracking-winder w-28 text-right border-l border-border/50">Lượng (g)</th>
                       </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-border/50">
                       {generatedVariants.map((v, i) => (
                          <tr key={i} className={`group hover:bg-background-secondary/30 ${v.isConversion ? 'bg-background-tertiary/20' : ''}`}>
                             <td className="py-3 px-4 text-center relative">
                                {v.isConversion && <div className="absolute top-0 bottom-1/2 left-4 w-px border-l-2 border-border/50"></div>}
                                {v.isConversion && <div className="absolute top-1/2 left-4 w-2 h-px border-t-2 border-border/50"></div>}
                                <div className={`w-8 h-8 rounded shrink-0 mx-auto border border-dashed border-border flex items-center justify-center relative z-10 ${v.isConversion ? 'bg-background-tertiary' : 'bg-background hover:border-primary-500 cursor-pointer'}`}>
                                   <ImagePlus size={14} className="text-foreground-muted" />
                                </div>
                             </td>
                             <td className="py-3 px-4">
                                <div className="font-semibold text-foreground bg-background-tertiary/50 px-3 py-1.5 rounded-lg border border-border inline-flex w-full">
                                   {v.name}
                                </div>
                                {v.isConversion && (
                                   <div className="text-[10px] text-foreground-muted mt-1.5 ml-1">
                                      {v.conversionRate} {formData.unit} = 1 {v.unit}
                                   </div>
                                )}
                             </td>
                             <td className="py-3 px-4 border-l border-border/50">
                                <div className="bg-background-tertiary px-2 py-1.5 rounded text-xs border border-border inline-flex font-mono">{v.sku}</div>
                             </td>
                             <td className="py-3 px-4 border-l border-border/50">
                                <input className="form-input w-full text-right text-xs h-7 py-0 bg-transparent shadow-none focus:bg-background focus:ring-1" value={v.weight} readOnly />
                             </td>
                          </tr>
                       ))}
                       {generatedVariants.length === 0 && (
                          <tr>
                             <td colSpan={4} className="py-8 text-center text-foreground-muted text-sm">Chưa có phiên bản nào được tạo</td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background border-t border-border shrink-0">
          <button type="button" onClick={onClose} className="btn-outline h-10 px-6 rounded-xl font-medium">Hủy</button>
          <button type="submit" form="productForm" disabled={mutation.isPending} className="btn-primary liquid-button h-10 px-6 rounded-xl font-medium shadow-primary-500/20 shadow-lg">
            {mutation.isPending ? 'Đang lưu...' : (isEditing ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function BoxIcon({ size = 24, className = "" }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
}
function RefreshIcon({ size = 24, className = "" }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
}

// ── UI UI Components ──

function CustomToggle({ checked, onChange, variant = 'primary' }: { checked: boolean, onChange: (e: any) => void, variant?: 'primary' | 'success' }) {
  return (
    <div className="relative inline-flex items-center cursor-pointer" onClick={onChange}>
      <input type="checkbox" checked={checked} readOnly className="sr-only peer" />
      <div
        className="w-11 h-6 rounded-full transition-colors duration-200 relative
          after:content-[''] after:absolute after:top-0.5 after:left-[2px]
          after:bg-white after:border after:border-gray-300 after:rounded-full
          after:h-5 after:w-5 after:transition-all
          peer-checked:after:translate-x-full"
        style={{
          backgroundColor: checked
            ? (variant === 'success' ? 'var(--color-success, #10b981)' : 'var(--color-primary-500, #06b6d4)')
            : 'var(--color-border, #334155)'
        }}
      />
    </div>
  )
}

function TagInput({ values, onChange, placeholder }: { values: string[], onChange: (v: string[]) => void, placeholder?: string }) {
  const [input, setInput] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = input.trim()
      if (val && !values.includes(val)) {
        onChange([...values, val])
        setInput('')
      }
    } else if (e.key === 'Backspace' && !input && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  const removeTag = (tag: string) => {
    onChange(values.filter(v => v !== tag))
  }

  return (
    <div className="flex flex-wrap items-center gap-2 form-input p-1.5 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all min-h-[38px]">
      {values.map(v => (
        <span key={v} className="bg-primary-500/10 text-primary-500 text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1">
          {v}
          <button type="button" onClick={() => removeTag(v)} className="hover:text-primary-600"><X size={12} /></button>
        </span>
      ))}
      <input 
        className="flex-1 bg-transparent outline-none min-w-[100px] text-sm px-1" 
        value={input} 
        onChange={e => setInput(e.target.value)} 
        onKeyDown={handleKeyDown}
        placeholder={values.length === 0 ? placeholder : ""} 
      />
    </div>
  )
}
