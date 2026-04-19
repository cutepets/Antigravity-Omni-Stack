'use client'
import Image from 'next/image';

import { useState, useEffect, useMemo, useRef } from 'react'
import { X, Save, ImagePlus, Plus, Trash2, ChevronDown, ChevronUp, Tag, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { buildProductVariantName, resolveProductVariantLabels } from '@petshop/shared'
import { inventoryApi } from '@/lib/api/inventory.api'
import { toast } from 'sonner'
import { NumericFormat } from 'react-number-format'
import { VariantTable } from './variant-table'


interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  initialData?: any
  onSuccess: () => void
}

type PriceBookValueMap = Record<string, number>

interface VariantOverride {
  sku?: string
  barcode?: string
  priceBookPrices?: PriceBookValueMap
  costPrice?: number
}

interface VariantDefinition {
  key: string
  isConversion: boolean
  parentKey: string | null
  name: string
  displayName: string
  variantLabel: string | null
  unitLabel: string | null
  imageKey: string
  sku: string
  barcode: string
  unit: string
  attrs: string[]
  conversionRate?: number
  conversionUnit?: string
  weight: number
  image: string | null
  priceBookPrices: Record<string, number>
}

interface ParsedConversion {
  rate?: number
  unit?: string
  sourceSku?: string
}

interface ConversionDraft {
  applyTo: string
  mainQty: number
  mainUnit: string
  convQty: number
  convUnit: string
}

const removeAccents = (str: string) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

const sanitizeSku = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const generateSKU = (name: string) => {
  if (!name) return '';
  return name.split(/\s+/).map(word => {
    return sanitizeSku(word.charAt(0));
  }).join('');
}

const cartesian = (arrays: string[][]) => {
  if (arrays.length === 0) return [[]] as string[][];
  return arrays.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat() as string[])), [[]] as string[][]);
}

const parseJson = <T,>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const createVariantKey = ({
  attrs,
  isConversion,
  conversionUnit,
}: {
  attrs: string[]
  isConversion: boolean
  conversionUnit?: string
}) => {
  const attrsKey = attrs.length > 0 ? attrs.map((attr) => sanitizeSku(attr)).join('_') : 'BASE'
  return `${isConversion ? 'CONV' : 'BASE'}__${attrsKey}__${sanitizeSku(conversionUnit || 'ROOT') || 'ROOT'}`
}

const createVariantIdentityKey = (variantLabel?: string | null, unitLabel?: string | null) =>
  `${sanitizeSku(variantLabel || 'BASE') || 'BASE'}__${sanitizeSku(unitLabel || 'ROOT') || 'ROOT'}`

const buildDisplayVariantName = (productName: string, variantLabel?: string | null, unitLabel?: string | null) =>
  buildProductVariantName(productName || 'SP', variantLabel, unitLabel) || productName || 'SP'

const roundMoney = (value: number) => Math.round(Number.isFinite(value) ? value : 0)

const scalePriceBookPrices = (prices: PriceBookValueMap, multiplier: number) =>
  Object.fromEntries(
    Object.entries(prices).map(([priceBookId, value]) => [
      priceBookId,
      roundMoney(Number(value || 0) * multiplier),
    ]),
  ) as PriceBookValueMap

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(reader.result?.toString() || ''))
    reader.addEventListener('error', () => reject(new Error('Không thể đọc file ảnh')))
    reader.readAsDataURL(file)
  })

export function ProductFormModal({ isOpen, onClose, initialData, onSuccess }: ProductFormModalProps) {
  const isEditing = !!initialData
  const queryClient = useQueryClient()

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => inventoryApi.getCategories() })
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: () => inventoryApi.getBrands() })
  const { data: unitsRes } = useQuery({ queryKey: ['units'], queryFn: () => inventoryApi.getUnits() })
  const { data: priceBooksRes } = useQuery({ queryKey: ['priceBooks'], queryFn: () => inventoryApi.getPriceBooks() })

  const units = unitsRes?.data || []
  const priceBooks = priceBooksRes?.data || []
  const retailPriceBook = priceBooks.find((pb: any) => pb.name.toLowerCase().includes('lẻ') || pb.name.toLowerCase() === 'retail price')

  const [formData, setFormData] = useState({
    name: '', sku: '', barcode: '',
    category: '', brand: '', unit: '', importName: '', targetSpecies: '',
    price: 0, costPrice: 0, vat: 0, weight: 0, minStock: 5, tags: '',
    isActive: true, priceBookPrices: {} as Record<string, number>, lastCountShift: ''
  })
  const [productImage, setProductImage] = useState<string | null>(null)
  const [variantImages, setVariantImages] = useState<Record<string, string | null>>({})
  const [variantOverrides, setVariantOverrides] = useState<Record<string, VariantOverride>>({})

  // === Attributes ===
  const [hasAttributes, setHasAttributes] = useState(false)
  const [attributes, setAttributes] = useState<{ name: string, values: string[] }[]>([
    { name: 'Loại', values: [] }
  ])

  // === Conversions ===
  const [hasConversions, setHasConversions] = useState(false)
  const [conversions, setConversions] = useState<ConversionDraft[]>([
    { applyTo: 'all', mainQty: 12, mainUnit: '', convQty: 1, convUnit: '' }
  ])

  // Initial load
  useEffect(() => {
    if (initialData && isOpen) {
      let initialPriceBookPrices = parseJson<PriceBookValueMap>(initialData.priceBookPrices, {})
      if (Array.isArray(initialData.variants) && initialData.variants.length > 0 && Object.keys(initialPriceBookPrices).length === 0) {
        const baseVariant = initialData.variants.find((v: any) => {
          const conversion = parseJson<{ unit?: string }>(v.conversions, {})
          return !conversion?.unit
        }) || initialData.variants[0];
        initialPriceBookPrices = parseJson<PriceBookValueMap>(baseVariant.priceBookPrices, {})
      }
      const parsedAttributes = parseJson<{ name: string; values: string[] }[]>(initialData.attributes, [])
      const parsedConversions: ParsedConversion[] = Array.isArray(initialData.variants)
        ? initialData.variants
          .map((variant: any) => parseJson<ParsedConversion | null>(variant.conversions, null))
          .filter((conversion: ParsedConversion | null): conversion is ParsedConversion => Boolean(conversion?.unit))
        : []
      const uniqueConversions: ConversionDraft[] = Array.from(
        new Map(
          parsedConversions.map((conversion: ParsedConversion) => {
            const mainQty = Number(conversion.rate) || 1
            const convUnit = `${conversion.unit || ''}`.trim()
            return [
              `${mainQty}__${convUnit}`,
              { applyTo: 'all', mainQty, mainUnit: initialData.unit || '', convQty: 1, convUnit },
            ] as const
          }),
        ).values(),
      )

      setFormData({
        name: initialData.name || '',
        sku: initialData.groupCode || initialData.sku || '',
        barcode: initialData.barcode || '',
        category: initialData.category || '',
        targetSpecies: initialData.targetSpecies || '',
        brand: initialData.brand || '',
        unit: initialData.unit || '',
        importName: initialData.importName || '',
        price: initialData.price || 0,
        costPrice: initialData.costPrice || 0,
        vat: initialData.vat || 0,
        weight: initialData.weight || 0,
        minStock: initialData.minStock || 5,
        tags: initialData.tags || '',
        isActive: initialData.isActive ?? true,
        priceBookPrices: initialPriceBookPrices,
        lastCountShift: initialData.lastCountShift || ''
      })
      setProductImage(initialData.image || null)
      setVariantImages({})
      setVariantOverrides({})
      setHasAttributes(parsedAttributes.length > 0)
      setAttributes(parsedAttributes.length > 0 ? parsedAttributes : [{ name: 'Loại', values: [] }])
      setHasConversions(uniqueConversions.length > 0)
      setConversions(
        uniqueConversions.length > 0
          ? uniqueConversions
          : [{ applyTo: 'all', mainQty: 12, mainUnit: initialData.unit || '', convQty: 1, convUnit: '' }],
      )
    } else if (isOpen) {
      setFormData({
        name: '', sku: '', barcode: '',
        category: '', brand: '', unit: '', importName: '', targetSpecies: '',
        price: 0, costPrice: 0, vat: 0, weight: 0, minStock: 5, tags: '',
        isActive: true, priceBookPrices: {}, lastCountShift: ''
      })
      setProductImage(null)
      setVariantImages({})
      setVariantOverrides({})
      setHasAttributes(false)
      setAttributes([{ name: 'Loại', values: [] }])
      setHasConversions(false)
      setConversions([{ applyTo: 'all', mainQty: 12, mainUnit: '', convQty: 1, convUnit: '' }])
    }
  }, [initialData, isOpen])

  // Automatically update unit of conversions when main unit changes
  useEffect(() => {
    setConversions(c => c.map(item => ({ ...item, mainUnit: formData.unit })))
  }, [formData.unit])

  // Auto Generate Variants
  const variantDefinitions = useMemo<VariantDefinition[]>(() => {
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
    const result: VariantDefinition[] = []

    baseCombo.forEach((bc, idx) => {
      const baseKey = createVariantKey({ attrs: bc.attrs, isConversion: false })
      const baseSku = formData.sku ? `${sanitizeSku(formData.sku)}${idx > 0 ? idx : ''}` : `SKU${idx}`
      const variantLabel = bc.attrs.length > 0 ? bc.attrs.join(' - ') : null
      const baseDisplayName = buildDisplayVariantName(formData.name || 'SP', variantLabel, null)

      // Add Base
      result.push({
        key: baseKey,
        isConversion: false,
        parentKey: null,
        name: baseDisplayName,
        displayName: baseDisplayName,
        variantLabel,
        unitLabel: null,
        imageKey: baseKey,
        sku: baseSku,
        barcode: '',
        unit: formData.unit,
        attrs: bc.attrs,
        weight: formData.weight,
        image: null,
        priceBookPrices: {}
      })

      // Add Conversions
      if (hasConversions) {
        conversions
          .filter(c => `${c.convUnit || ''}`.trim())
          .filter(c => c.applyTo === 'all' || (hasAttributes && bc.attrs.includes(c.applyTo)))
          .forEach((conv) => {
            const unitLabel = `${conv.convUnit || ''}`.trim() || null
            const conversionName = buildDisplayVariantName(formData.name || 'SP', variantLabel, unitLabel)
            const conversionKey = createVariantKey({ attrs: bc.attrs, isConversion: true, conversionUnit: conv.convUnit })
            const conversionSku = `${baseSku}${sanitizeSku(conv.convUnit).slice(0, 4) || 'QD'}`
            result.push({
              key: conversionKey,
              isConversion: true,
              parentKey: baseKey,
              name: conversionName,
              displayName: conversionName,
              variantLabel,
              unitLabel,
              imageKey: conversionKey,
              sku: conversionSku,
              barcode: '',
              unit: conv.convUnit,
              attrs: bc.attrs,
              conversionRate: conv.mainQty,
              conversionUnit: conv.convUnit,
              weight: formData.weight * conv.mainQty,
              image: null,
              priceBookPrices: {}
            })
          })
      }
    })

    return result
  }, [formData, hasAttributes, attributes, hasConversions, conversions])

  const basePrice = retailPriceBook ? Number(formData.priceBookPrices[retailPriceBook.id] || 0) : Number(formData.price)

  const initialVariantMap = useMemo(() => {
    if (!isEditing || !Array.isArray(initialData?.variants)) return {} as Record<string, any>

    const remainingVariants = [...initialData.variants]
    return variantDefinitions.reduce((acc, variantDefinition) => {
      const exactSkuIndex = variantDefinition.sku
        ? remainingVariants.findIndex((variant: any) => variant.sku === variantDefinition.sku)
        : -1
      const nameMatchIndex = exactSkuIndex >= 0 ? -1 : remainingVariants.findIndex((variant: any) => variant.name === variantDefinition.name)
      const identityMatchIndex =
        exactSkuIndex >= 0 || nameMatchIndex >= 0
          ? -1
          : remainingVariants.findIndex((variant: any) => {
            const resolvedLabels = resolveProductVariantLabels(initialData?.name, variant)
            return (
              createVariantIdentityKey(resolvedLabels.variantLabel, resolvedLabels.unitLabel) ===
              createVariantIdentityKey(variantDefinition.variantLabel, variantDefinition.unitLabel)
            )
          })
      const typeMatchIndex =
        exactSkuIndex >= 0 || nameMatchIndex >= 0 || identityMatchIndex >= 0
          ? -1
          : remainingVariants.findIndex((variant: any) => {
            const conversion = parseJson<{ unit?: string } | null>(variant.conversions, null)
            return Boolean(conversion?.unit) === variantDefinition.isConversion
          })
      const matchedIndex = [exactSkuIndex, nameMatchIndex, identityMatchIndex, typeMatchIndex].find((index) => index >= 0) ?? -1

      if (matchedIndex < 0) return acc

      const [matchedVariant] = remainingVariants.splice(matchedIndex, 1)
      const resolvedLabels = resolveProductVariantLabels(initialData?.name, matchedVariant)
      acc[variantDefinition.key] = {
        sku: matchedVariant.sku || variantDefinition.sku,
        barcode: matchedVariant.barcode || '',
        priceBookPrices: parseJson<PriceBookValueMap>(matchedVariant.priceBookPrices, {}),
        image: matchedVariant.image || null,
        costPrice: Number(matchedVariant.costPrice) || 0,
        variantLabel: resolvedLabels.variantLabel,
        unitLabel: resolvedLabels.unitLabel,
      }
      return acc
    }, {} as Record<string, any>)
  }, [initialData, isEditing, variantDefinitions])

  const generatedVariants = useMemo(() => {
    return variantDefinitions.map((variantDefinition) => {
      const initialVariant = initialVariantMap[variantDefinition.key]
      const override = variantOverrides[variantDefinition.key]
      const multiplier = variantDefinition.isConversion ? Number(variantDefinition.conversionRate || 1) : 1
      const parentInitialVariant = variantDefinition.parentKey ? initialVariantMap[variantDefinition.parentKey] : null
      const parentOverride = variantDefinition.parentKey ? variantOverrides[variantDefinition.parentKey] : null
      const parentPriceBookPrices = {
        ...formData.priceBookPrices,
        ...(parentInitialVariant?.priceBookPrices ?? {}),
        ...(parentOverride?.priceBookPrices ?? {}),
      }
      const defaultPriceBookPrices = variantDefinition.isConversion
        ? scalePriceBookPrices(parentPriceBookPrices, multiplier)
        : formData.priceBookPrices
      const parentCostPrice = Number(parentOverride?.costPrice ?? parentInitialVariant?.costPrice ?? formData.costPrice ?? 0)
      const defaultCostPrice = variantDefinition.isConversion
        ? roundMoney(parentCostPrice * multiplier)
        : Number(formData.costPrice ?? 0)
      const initialPriceBookPrices = initialVariant?.priceBookPrices ?? {}
      const effectiveInitialPriceBookPrices = variantDefinition.isConversion
        ? Object.fromEntries(
          Object.entries(initialPriceBookPrices).filter(([priceBookId, value]) => {
            const parentValue = Number(parentPriceBookPrices[priceBookId] ?? 0)
            const initialValue = Number(value ?? 0)
            return !(multiplier !== 1 && parentValue > 0 && initialValue === parentValue)
          }),
        )
        : initialPriceBookPrices
      const initialCostPrice = initialVariant?.costPrice === undefined || initialVariant?.costPrice === null
        ? undefined
        : Number(initialVariant.costPrice)
      const shouldUseInitialCostPrice =
        initialCostPrice !== undefined &&
        !(
          variantDefinition.isConversion &&
          multiplier !== 1 &&
          ((parentCostPrice > 0 && initialCostPrice === parentCostPrice) ||
            (initialCostPrice <= 0 && defaultCostPrice > 0))
        )
      const mergedPriceBookPrices = {
        ...defaultPriceBookPrices,
        ...effectiveInitialPriceBookPrices,
        ...(override?.priceBookPrices ?? {}),
      }
      const explicitImage = variantImages[variantDefinition.imageKey]

      return {
        ...variantDefinition,
        variantLabel: variantDefinition.variantLabel ?? initialVariant?.variantLabel ?? null,
        unitLabel: variantDefinition.unitLabel ?? initialVariant?.unitLabel ?? null,
        displayName: buildDisplayVariantName(
          formData.name || 'SP',
          variantDefinition.variantLabel ?? initialVariant?.variantLabel,
          variantDefinition.unitLabel ?? initialVariant?.unitLabel,
        ),
        name: buildDisplayVariantName(
          formData.name || 'SP',
          variantDefinition.variantLabel ?? initialVariant?.variantLabel,
          variantDefinition.unitLabel ?? initialVariant?.unitLabel,
        ),
        sku: override?.sku ?? initialVariant?.sku ?? variantDefinition.sku,
        barcode: override?.barcode ?? initialVariant?.barcode ?? '',
        image: explicitImage !== undefined ? explicitImage : (initialVariant?.image ?? null),
        priceBookPrices: mergedPriceBookPrices,
        costPrice: override?.costPrice ?? (shouldUseInitialCostPrice ? initialCostPrice : undefined) ?? defaultCostPrice,
      }
    })
  }, [formData.name, formData.costPrice, formData.priceBookPrices, initialVariantMap, variantDefinitions, variantImages, variantOverrides])

  const variantSkuByKey = useMemo(
    () =>
      Object.fromEntries(
        generatedVariants.map((variant) => [variant.key, variant.sku]),
      ) as Record<string, string>,
    [generatedVariants],
  )

  const buildVariantPayload = (variant: any) => ({
    name: variant.name,
    variantLabel: variant.variantLabel || undefined,
    unitLabel: variant.unitLabel || undefined,
    sku: variant.sku || undefined,
    barcode: variant.barcode || undefined,
    price: retailPriceBook
      ? Number(variant.priceBookPrices?.[retailPriceBook.id] || 0)
      : roundMoney(basePrice * (variant.isConversion ? Number(variant.conversionRate || 1) : 1)),
    image: variant.image || undefined,
    conversions: variant.isConversion
      ? JSON.stringify({
          rate: variant.conversionRate,
          unit: variant.conversionUnit,
          sourceSku: variant.parentKey ? variantSkuByKey[variant.parentKey] : undefined,
        })
      : undefined,
    priceBookPrices: Object.keys(variant.priceBookPrices || {}).length > 0 ? JSON.stringify(variant.priceBookPrices) : undefined,
    costPrice: Number(variant.costPrice) || undefined,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      // Tách variants ra khỏi payload — Prisma nested write cần xử lý riêng
      const basePayload = {
        name: formData.name,
        groupCode: formData.sku || undefined,
        barcode: formData.barcode || undefined,
        category: formData.category || undefined,
        targetSpecies: formData.targetSpecies || undefined,
        brand: formData.brand || undefined,
        unit: formData.unit,
        importName: formData.importName || undefined,
        price: basePrice,
        costPrice: Number(formData.costPrice) || undefined,
        vat: Number(formData.vat),
        weight: Number(formData.weight) || undefined,
        minStock: Number(formData.minStock),
        tags: formData.tags || undefined,
        isActive: formData.isActive,
        image: productImage || undefined,
        attributes: hasAttributes ? JSON.stringify(attributes) : undefined,
        lastCountShift: formData.lastCountShift || undefined,
      }

      const variantPayload = generatedVariants.map(buildVariantPayload)

      if (isEditing) {
        // 1. Update thông tin cơ bản
        await inventoryApi.updateProduct(initialData.id, basePayload)

        const unmatchedExisting = Array.isArray(initialData.variants) ? [...initialData.variants] : []
        const matchedVariants = variantPayload.map((payload) => {
          const skuMatchIndex = payload.sku ? unmatchedExisting.findIndex((variant: any) => variant.sku === payload.sku) : -1
          const nameMatchIndex = skuMatchIndex >= 0 ? -1 : unmatchedExisting.findIndex((variant: any) => variant.name === payload.name)
          const identityMatchIndex =
            skuMatchIndex >= 0 || nameMatchIndex >= 0
              ? -1
              : unmatchedExisting.findIndex((variant: any) => {
                const resolvedLabels = resolveProductVariantLabels(initialData?.name, variant)
                return (
                  createVariantIdentityKey(resolvedLabels.variantLabel, resolvedLabels.unitLabel) ===
                  createVariantIdentityKey(payload.variantLabel, payload.unitLabel)
                )
              })
          const matchedIndex =
            skuMatchIndex >= 0
              ? skuMatchIndex
              : nameMatchIndex >= 0
                ? nameMatchIndex
                : identityMatchIndex

          if (matchedIndex >= 0) {
            const [matchedVariant] = unmatchedExisting.splice(matchedIndex, 1)
            return { existingVariant: matchedVariant, payload }
          }

          return { existingVariant: undefined, payload }
        })

        const variantsToUpdate = matchedVariants.filter((item) => item.existingVariant)
        const variantsToCreate = matchedVariants.filter((item) => !item.existingVariant).map((item) => item.payload)

        if (variantsToUpdate.length > 0) {
          await Promise.all(
            variantsToUpdate.map((item) => inventoryApi.updateVariant(item.existingVariant.id, item.payload))
          )
        }

        if (variantsToCreate.length > 0) {
          await inventoryApi.batchCreateVariants(initialData.id, { variants: variantsToCreate })
        }

        if (unmatchedExisting.length > 0) {
          await Promise.all(
            unmatchedExisting.map((variant: any) => inventoryApi.deleteVariant(variant.id))
          )
        }

        return { success: true }
      } else {
        // Tạo mới: gửi dạng nested create
        const payload: any = { ...basePayload }
        if (variantPayload.length > 0) {
          payload.variants = {
            create: variantPayload
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

    if (!formData.name) return toast.error('Vui lòng nhập Tên sản phẩm')
    if (!formData.sku) return toast.error('Vui lòng nhập Mã nhóm SP')
    if (!formData.unit) return toast.error('Vui lòng nhập Đơn vị bán')

    // Check required Giá lẻ
    const giaLeBook = priceBooks.find((pb: any) => pb.name.toLowerCase().includes('lẻ') || pb.name.toLowerCase() === 'retail price')
    if (giaLeBook && !formData.priceBookPrices[giaLeBook.id]) {
      return toast.error('Vui lòng nhập Giá lẻ ở Bảng giá')
    }

    if (generatedVariants.some((variant) => !variant.sku)) {
      return toast.error('Mỗi phiên bản cần có SKU hợp lệ')
    }

    mutation.mutate()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData(f => ({ ...f, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setFormData(f => {
        let finalValue = value;
        if (name === 'sku') {
          finalValue = sanitizeSku(finalValue)
        }
        const newData = { ...f, [name]: type === 'number' ? Number(finalValue) : finalValue }
        if (name === 'name' && !isEditing && !newData.sku) {
          newData.sku = generateSKU(value)
        }
        return newData;
      })
    }
  }

  const handleImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccessAction: (image: string) => void
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      const image = await fileToDataUrl(file)
      onSuccessAction(image)
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải ảnh, vui lòng thử lại')
    }
  }

  const updateVariantOverride = (variantKey: string, updater: (current: VariantOverride) => VariantOverride) => {
    setVariantOverrides((current) => ({
      ...current,
      [variantKey]: updater(current[variantKey] ?? {}),
    }))
  }

  const handleVariantSkuChange = (variantKey: string, value: string) => {
    updateVariantOverride(variantKey, (current) => ({ ...current, sku: sanitizeSku(value) }))
  }

  const handleVariantBarcodeChange = (variantKey: string, value: string) => {
    updateVariantOverride(variantKey, (current) => ({ ...current, barcode: value.replace(/\s+/g, '') }))
  }

  const handleVariantCostPriceChange = (variantKey: string, value: number) => {
    updateVariantOverride(variantKey, (current) => ({ ...current, costPrice: value }))
  }

  const handleVariantPriceBookChange = (variantKey: string, priceBookId: string, value: number) => {
    updateVariantOverride(variantKey, (current) => ({
      ...current,
      priceBookPrices: {
        ...(current.priceBookPrices ?? initialVariantMap[variantKey]?.priceBookPrices ?? {}),
        [priceBookId]: value,
      },
    }))
  }

  const clearVariantImage = (imageKey: string) => {
    setVariantImages((current) => ({ ...current, [imageKey]: null }))
  }

  // --- Render Options ---
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pb-20 pt-10">
      <div className="fixed inset-0 bg-background-base/80 backdrop-blur-sm" />
      <div className="card p-0 relative w-full flex flex-col max-w-[98vw] h-full max-h-[96vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-background flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-500">
              <BoxIcon size={18} />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {isEditing ? "Cập nhật sản phẩm" : "Thêm sản phẩm"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="btn-outline h-9 px-4 rounded-lg font-medium text-sm">Hủy</button>
            <button type="submit" form="productForm" disabled={mutation.isPending} className="btn-primary liquid-button h-9 px-4 rounded-lg font-medium text-sm shadow-primary-500/20 shadow-lg">
              {mutation.isPending ? 'Đang lưu...' : (isEditing ? 'Cập nhật' : 'Thêm mới')}
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto bg-background-secondary/30 relative">
          <form id="productForm" onSubmit={handleSubmit} className="p-6 flex flex-col gap-6 w-full max-w-[1600px] mx-auto">

            {/* SECTION: THÔNG TIN CHUNG */}
            <div className="border border-border bg-background rounded-2xl shadow-sm relative z-20">
              <div className="px-5 py-3 border-b border-border bg-background-tertiary/50 text-[11px] font-bold uppercase tracking-wider text-foreground-muted">Thông tin chung</div>
              <div className="p-5 flex gap-6">
                {/* Left: Avatar */}
                <div className="w-32 shrink-0">
                  <label className="group relative flex h-32 w-32 cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-border bg-background-secondary transition-colors hover:border-primary-500 hover:bg-background-tertiary">
                    {productImage ? (
                      <Image src={productImage} alt={formData.name || 'Sản phẩm'} className="h-full w-full object-cover" width={400} height={400} unoptimized />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-foreground-muted">
                        <ImagePlus size={24} className="mb-2" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Tải ảnh</span>
                      </div>
                    )}
                    <div className="absolute inset-0 hidden items-center justify-center bg-background-base/65 text-[10px] font-bold uppercase tracking-wider text-white group-hover:flex">
                      {productImage ? 'Đổi ảnh' : 'Chọn ảnh'}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageChange(e, setProductImage)}
                    />
                  </label>
                  {productImage && (
                    <button
                      type="button"
                      onClick={() => setProductImage(null)}
                      className="mt-2 text-xs font-medium text-foreground-muted transition-colors hover:text-error"
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>

                {/* Right: Info */}
                <div className="flex-1 flex flex-col gap-4">
                  {/* Hàng 1: Tên sản phẩm + Dùng cho + Danh mục */}
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Tên sản phẩm <span className="text-error">*</span></label>
                      <input required name="name" value={formData.name} onChange={handleChange} className="form-input w-full font-semibold" placeholder="thức ăn cho mèo Canin 1kg" />
                    </div>
                    <div className="w-28 shrink-0">
                      <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Dùng cho</label>
                      <select
                        name="targetSpecies"
                        value={formData.targetSpecies}
                        onChange={handleChange}
                        className="form-input w-full px-3 text-foreground-base bg-background-secondary border-border"
                      >
                        <option value="" disabled hidden>-- Chọn --</option>
                        <option value="DOG">Chó</option>
                        <option value="CAT">Mèo</option>
                        <option value="BOTH">Chó & Mèo</option>
                        <option value="OTHER">Khác</option>
                      </select>
                    </div>
                    <div className="w-56 shrink-0">
                      <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Danh mục</label>
                      <SearchableCreatableSelect
                        options={(categories?.data || [])
                          .filter((c: any) => {
                            if (!formData.targetSpecies) return true;
                            const cTarget = c.targetSpecies || 'OTHER';
                            if (formData.targetSpecies === cTarget) return true;
                            if (formData.targetSpecies === 'DOG' || formData.targetSpecies === 'CAT') return cTarget === 'BOTH';
                            if (formData.targetSpecies === 'BOTH') return cTarget === 'DOG' || cTarget === 'CAT';
                            return false;
                          })
                          .filter((c: any, index: number, self: any[]) =>
                            index === self.findIndex((t) => t.name.trim().toLowerCase() === c.name.trim().toLowerCase())
                          )
                        }
                        value={formData.category}
                        onChange={v => setFormData(f => ({ ...f, category: v }))}
                        placeholder="Tìm hoặc thêm..."
                        onAdd={async (search) => {
                          await inventoryApi.createCategory({ name: search, targetSpecies: formData.targetSpecies || 'OTHER' })
                          queryClient.invalidateQueries({ queryKey: ['categories'] })
                        }}
                      />
                    </div>
                  </div>
                  {/* Hàng 2: Tên nhập hàng + Nhãn hiệu */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Tên nhập hàng <span className="italic font-normal">(không bắt buộc)</span></label>
                      <input name="importName" value={formData.importName} onChange={handleChange} className="form-input w-full" placeholder="Phục vụ đối soát với hoá đơn nhập kho..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Nhãn hiệu</label>
                      <SearchableCreatableSelect
                        options={brands?.data || []}
                        value={formData.brand}
                        onChange={v => setFormData(f => ({ ...f, brand: v }))}
                        placeholder="Tìm hoặc thêm..."
                        onAdd={async (search) => {
                          await inventoryApi.createBrand({ name: search })
                          queryClient.invalidateQueries({ queryKey: ['brands'] })
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-3 pt-2">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Mã nhóm SP</label>
                      <input name="sku" value={formData.sku} onChange={handleChange} className="form-input w-full text-xs uppercase" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Mã vạch</label>
                      <input name="barcode" value={formData.barcode} onChange={handleChange} className="form-input w-full text-xs" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Đơn vị bán <span className="text-error">*</span></label>
                      <SearchableCreatableSelect
                        options={units}
                        value={formData.unit}
                        onChange={v => setFormData(f => ({ ...f, unit: v }))}
                        placeholder="Vd: Cái"
                        onAdd={async (search) => {
                          await inventoryApi.createUnit({ name: search })
                          queryClient.invalidateQueries({ queryKey: ['units'] })
                        }}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Trọng lượng (g)</label>
                      <NumericFormat
                        value={formData.weight}
                        onValueChange={(values) => {
                          setFormData((prev: any) => ({ ...prev, weight: values.floatValue ?? '' }))
                        }}
                        thousandSeparator="."
                        decimalSeparator=","
                        allowNegative={false}
                        className="form-input w-full text-xs"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Tồn min</label>
                      <input type="number" name="minStock" value={formData.minStock} onChange={handleChange} className="form-input w-full text-xs" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Ca kiểm kho</label>
                      <div className="flex gap-1.5">
                        <select
                          value={formData.lastCountShift?.split('_')[0] || ''}
                          onChange={e => {
                            const day = e.target.value;
                            if (!day) {
                              handleChange({ target: { name: 'lastCountShift', value: '' } } as any);
                            } else {
                              const shift = formData.lastCountShift?.split('_')[1] || 'A';
                              handleChange({ target: { name: 'lastCountShift', value: `${day}_${shift}` } } as any);
                            }
                          }}
                          className="form-input w-1/2 text-xs px-1.5 text-foreground-base bg-background-secondary border-border"
                        >
                          <option value="">T.cả</option>
                          <option value="MON">T2</option>
                          <option value="TUE">T3</option>
                          <option value="WED">T4</option>
                          <option value="THU">T5</option>
                          <option value="FRI">T6</option>
                          <option value="SAT">T7</option>
                        </select>
                        <select
                          value={formData.lastCountShift?.split('_')[1] || ''}
                          onChange={e => {
                            const shift = e.target.value;
                            if (!shift) {
                              handleChange({ target: { name: 'lastCountShift', value: '' } } as any);
                            } else {
                              const day = formData.lastCountShift?.split('_')[0] || 'MON';
                              handleChange({ target: { name: 'lastCountShift', value: `${day}_${shift}` } } as any);
                            }
                          }}
                          className="form-input w-1/2 text-xs px-1.5 text-foreground-base bg-background-secondary border-border disabled:opacity-50"
                          disabled={!formData.lastCountShift?.split('_')[0]}
                        >
                          <option value="">-</option>
                          <option value="A">Ca A</option>
                          <option value="B">Ca B</option>
                          <option value="C">Ca C</option>
                          <option value="D">Ca D</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION: BẢNG GIÁ */}
            <div className="border border-border bg-background rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-border bg-background-tertiary/50 text-[11px] font-bold uppercase tracking-wider text-foreground-muted">Bảng Giá</div>
              <div className="p-5 flex gap-4 items-center flex-wrap">
                <div className="w-48">
                  <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Giá nhập</label>
                  <PriceInput value={formData.costPrice} onChange={(val: number) => setFormData(f => ({ ...f, costPrice: val }))} />
                </div>
                {priceBooks.map((pb: any) => {
                  const isGiaLe = pb.name.toLowerCase().includes('lẻ')
                  return (
                    <div className="w-48" key={pb.id}>
                      <label className="block text-xs font-medium mb-1.5 text-foreground-muted">
                        {pb.name} {isGiaLe && <span className="text-error">*</span>}
                      </label>
                      <PriceInput
                        required={isGiaLe}
                        value={formData.priceBookPrices[pb.id] || 0}
                        onChange={(val: number) => setFormData(f => ({
                          ...f,
                          priceBookPrices: { ...f.priceBookPrices, [pb.id]: val }
                        }))}
                      />
                    </div>
                  )
                })}

              </div>
            </div>

            {/* SECTION: THUỘC TÍNH PHIÊN BẢN */}
            <div className="grid grid-cols-2 gap-6 w-full items-start">
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
              <div className={`border ${hasConversions ? 'border-success/50 shadow-md ring-1 ring-success/20' : 'border-border'} bg-background rounded-2xl relative z-10 transition-all duration-300`}>
                <div className={`px-5 py-3 bg-background flex justify-between items-center cursor-pointer ${hasConversions ? 'rounded-t-2xl' : 'rounded-2xl'}`} onClick={() => setHasConversions(!hasConversions)}>
                  <div className="flex items-center gap-3">
                    <RefreshIcon size={16} className={hasConversions ? 'text-success' : 'text-foreground-muted'} />
                    <span className={`text-[12px] font-bold uppercase tracking-wider ${hasConversions ? 'text-success' : 'text-foreground-muted'}`}>Đơn vị quy đổi</span>
                    {!hasConversions && <span className="text-xs text-foreground-muted font-normal normal-case">— Túi {"->"} Thùng...</span>}
                  </div>
                  <CustomToggle variant="success" checked={hasConversions} onChange={(e) => { e.stopPropagation(); setHasConversions(!hasConversions) }} />
                </div>

                {hasConversions && (
                  <div className="p-5 border-t border-border flex flex-col gap-4 bg-background-secondary/10 relative rounded-b-2xl">
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
                          <div className="w-40">
                            <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Đơn vị quy đổi <span className="text-error">*</span></label>
                            <SearchableCreatableSelect
                              options={units}
                              value={conv.convUnit}
                              onChange={v => { const n = [...conversions]; n[index].convUnit = v; setConversions(n) }}
                              placeholder="Vd: Thùng"
                              onAdd={async (search) => {
                                await inventoryApi.createUnit({ name: search })
                                queryClient.invalidateQueries({ queryKey: ['units'] })
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setConversions(c => [...c, { applyTo: 'all', mainQty: 12, mainUnit: formData.unit, convQty: 1, convUnit: '' }])} className="text-sm text-success font-semibold flex items-center gap-1 hover:text-success/80 w-max mt-2">
                      <Plus size={16} /> Thêm đơn vị khác
                    </button>
                  </div>
                )}
              </div>
            </div>

            <VariantTable
              generatedVariants={generatedVariants}
              priceBooks={priceBooks}
              formData={formData}
              productImage={productImage}
              handleImageChange={handleImageChange}
              setVariantImages={setVariantImages}
              clearVariantImage={clearVariantImage}
              handleVariantSkuChange={handleVariantSkuChange}
              handleVariantBarcodeChange={handleVariantBarcodeChange}
              handleVariantCostPriceChange={handleVariantCostPriceChange}
              handleVariantPriceBookChange={handleVariantPriceBookChange}
            />
          </form>
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

  const commitTag = () => {
    const nextValues = input
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)
      .filter(v => !values.includes(v))

    if (nextValues.length > 0) {
      onChange([...values, ...nextValues])
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitTag()
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
        onBlur={commitTag}
        placeholder={values.length === 0 ? placeholder : ""}
      />
    </div>
  )
}

export function PriceInput({ value, onChange, placeholder, className, required = false }: any) {
  const [displayValue, setDisplayValue] = useState(value ? Number(value).toLocaleString('vi-VN') : '')

  useEffect(() => {
    setDisplayValue(value ? Number(value).toLocaleString('vi-VN') : (value === 0 ? '0' : ''))
  }, [value])

  const handleBlur = () => {
    const parsed = Number(displayValue.replace(/[^0-9]/g, ''))
    setDisplayValue(parsed ? parsed.toLocaleString('vi-VN') : (displayValue === '0' ? '0' : ''))
    onChange(parsed || 0)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const rawValue = val.replace(/[^0-9]/g, '')
    setDisplayValue(rawValue ? Number(rawValue).toLocaleString('vi-VN') : "")
    onChange(Number(rawValue) || 0)
  }

  return (
    <div className="relative">
      <input
        type="text"
        className={`form-input w-full text-right pr-9 font-semibold text-primary-500 ${className || ''}`}
        placeholder={placeholder}
        required={required}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground-muted">đ</span>
    </div>
  )
}

function SearchableCreatableSelect({
  options, value, onChange, placeholder, onAdd
}: {
  options: { id: string, name: string }[], value: string, onChange: (v: string) => void, placeholder?: string, onAdd: (v: string) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()))
  const exactMatch = options.find(o => o.name.toLowerCase() === search.toLowerCase())

  const handleAdd = async () => {
    if (!search || exactMatch) return
    setIsAdding(true)
    try {
      await onAdd(search)
      onChange(search)
      setSearch('')
      setIsOpen(false)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <div
        className="form-input flex items-center justify-between cursor-pointer min-h-[38px] text-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={value ? "text-foreground font-semibold" : "text-foreground-muted"}>{value || placeholder || "Chọn..."}</span>
        <ChevronDown size={14} className="text-foreground-muted" />
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border shadow-lg rounded-xl overflow-hidden flex flex-col">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              className="form-input w-full bg-background-secondary border-none h-8 text-sm"
              placeholder="Tìm hoặc thêm..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(opt => (
              <div
                key={opt.id}
                className="px-3 py-2 cursor-pointer hover:bg-background-secondary text-sm"
                onClick={() => { onChange(opt.name); setIsOpen(false); setSearch('') }}
              >
                {opt.name}
              </div>
            ))}
            {search && !exactMatch && (
              <div
                className="px-3 py-2 cursor-pointer text-primary-500 font-medium hover:bg-primary-500/10 flex items-center gap-2 text-sm"
                onClick={handleAdd}
              >
                {isAdding ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Thêm &quot;{search}&quot;
              </div>
            )}
            {filtered.length === 0 && !search && (
              <div className="px-3 py-3 text-center text-xs text-foreground-muted">Không có dữ liệu</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
