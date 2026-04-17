'use client'

import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgeDollarSign,
  Check,
  ChevronRight,
  Loader2,
  Package,
  Pencil,
  Plus,
  Scale,
  Search,
  Settings,
  Settings as SettingsIcon,
  Star,
  Tags,
  Trash2,

  X,
} from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { api } from '@/lib/api'
import { useAuthorization } from '@/hooks/useAuthorization'

type DictionaryItem = {
  id: string
  name: string
  parentId?: string | null
  description?: string | null
  channel?: string | null
  targetSpecies?: string | null
  isDefault?: boolean | null
  isActive?: boolean | null
  sortOrder?: number | null
}

type CardHeaderProps = {
  title: string
  subtitle: string
  count: number
  icon: React.ComponentType<{ size?: number; className?: string }>
}

function CardHeader({ title, subtitle, count, icon: Icon }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground-base">{title}</h2>
          <p className="mt-1 text-sm text-foreground-muted">{subtitle}</p>
        </div>
      </div>
      <div className="inline-flex min-w-8 items-center justify-center rounded-full bg-primary-500/10 px-2.5 py-1 text-xs font-bold text-primary-500">
        {count}
      </div>
    </div>
  )
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

const PAGE_SIZE = 5

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
      <span className="text-xs text-foreground-muted">
        Trang {page}/{totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="inline-flex h-8 items-center rounded-xl border border-border px-3 text-xs font-semibold text-foreground transition-colors disabled:opacity-40 hover:border-primary-500 hover:text-primary-500"
        >
          Trước
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="inline-flex h-8 items-center rounded-xl border border-border px-3 text-xs font-semibold text-foreground transition-colors disabled:opacity-40 hover:border-primary-500 hover:text-primary-500"
        >
          Sau
        </button>
      </div>
    </div>
  )
}

function TagDictionaryCard({
  endpoint,
  queryKey,
  syncQueryKeys = [],
  title,
  subtitle,
  addLabel,
  icon: Icon,
  canCreate,
  canUpdate,
  canDelete,
}: {
  endpoint: string
  queryKey: string[]
  syncQueryKeys?: string[][]
  title: string
  subtitle: string
  addLabel: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get(endpoint)
      return (res.data.data ?? []) as DictionaryItem[]
    },
  })

  const filteredItems = useMemo(() => {
    const keyword = normalizeText(search)
    if (!keyword) return items
    return items.filter((item) => normalizeText(item.name).includes(keyword))
  }, [items, search])

  const hasExactMatch = items.some((item) => normalizeText(item.name) === normalizeText(search))

  const invalidateDictionaryQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      ...syncQueryKeys.map((key) => queryClient.invalidateQueries({ queryKey: key })),
    ])
  }

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post(endpoint, { name })
      return res.data
    },
    onSuccess: async () => {
      toast.success(`Đã thêm ${title.toLowerCase()}`)
      await invalidateDictionaryQueries()
      setSearch('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || `Không thể thêm ${title.toLowerCase()}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await api.put(`${endpoint}/${id}`, { name })
      return res.data
    },
    onSuccess: async () => {
      toast.success('Đã cập nhật')
      await invalidateDictionaryQueries()
      setEditingItemId(null)
      setEditingName('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể cập nhật')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`${endpoint}/${id}`)
      return res.data
    },
    onSuccess: async () => {
      toast.success(`Đã xóa ${title.toLowerCase()}`)
      await invalidateDictionaryQueries()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || `Không thể xóa ${title.toLowerCase()}`)
    },
  })

  const submitCreate = () => {
    const value = search.trim()
    if (!value) return
    createMutation.mutate(value)
  }

  return (
    <div data-hotkey-scope className="overflow-hidden rounded-3xl border border-border/70 bg-background-secondary shadow-sm">
      <CardHeader title={title} subtitle={subtitle} count={items.length} icon={Icon} />

      <div className="space-y-3 p-5">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Tìm ${title.toLowerCase()}...`}
            className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm outline-none transition-colors focus:border-primary-500"
          />
        </div>

        {canCreate && search.trim() && !hasExactMatch && (
          <button
            type="button"
            onClick={submitCreate}
            disabled={createMutation.isPending}
            data-hotkey-enter
            className="inline-flex items-center gap-2 rounded-2xl border border-primary-500/30 bg-primary-500/10 px-4 py-2 text-sm font-semibold text-primary-400 transition-colors hover:bg-primary-500/15 disabled:opacity-60"
          >
            {createMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {addLabel} &quot;{search.trim()}&quot;
          </button>
        )}

        {isLoading ? (
          <div className="flex h-20 items-center justify-center text-foreground-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-5 text-sm text-foreground-muted">
            {search.trim() ? 'Không tìm thấy mục phù hợp.' : `Chưa có ${title.toLowerCase()} nào.`}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-2 text-sm"
              >
                {editingItemId === item.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && editingName.trim()) {
                          updateMutation.mutate({ id: item.id, name: editingName.trim() })
                        }
                        if (event.key === 'Escape') {
                          setEditingItemId(null)
                          setEditingName('')
                        }
                      }}
                      className="h-7 w-28 rounded-lg bg-background-secondary px-2 text-sm outline-none focus:ring-1 focus:ring-primary-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (editingName.trim()) updateMutation.mutate({ id: item.id, name: editingName.trim() })
                      }}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-primary-500 transition-colors hover:bg-primary-500/10"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemId(null)
                        setEditingName('')
                      }}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="truncate font-medium text-foreground">{item.name}</span>
                    {canUpdate ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItemId(item.id)
                          setEditingName(item.name)
                        }}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-background-secondary hover:text-primary-500"
                      >
                        <Pencil size={11} />
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Xóa "${item.name}"?`)) deleteMutation.mutate(item.id)
                        }}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                      >
                        <X size={12} />
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryCard({
  canCreate,
  canUpdate,
  canDelete,
}: {
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}) {
  const queryClient = useQueryClient()
  const [draftName, setDraftName] = useState('')
  const [draftSpecies, setDraftSpecies] = useState<'DOG' | 'CAT' | 'BOTH' | 'OTHER'>('DOG')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const endpoint = '/inventory/categories'
  const queryKey = ['settings', 'inventory', 'categories']

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get(endpoint)
      return (res.data.data ?? []) as DictionaryItem[]
    },
  })

  // We group them by target species.
  const SPECIES_LIST = [
    { value: 'DOG', label: 'Chó' },
    { value: 'CAT', label: 'Mèo' },
    { value: 'BOTH', label: 'Chó & Mèo' },
    { value: 'OTHER', label: 'Khác' },
  ]

  const createMutation = useMutation({
    mutationFn: async ({ name, targetSpecies }: { name: string; targetSpecies: string }) => {
      const res = await api.post(endpoint, { name, targetSpecies, parentId: null })
      return res.data
    },
    onSuccess: () => {
      toast.success('Đã thêm danh mục')
      queryClient.invalidateQueries({ queryKey })
      setDraftName('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể thêm danh mục')
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await api.put(`${endpoint}/${id}`, { name })
      return res.data
    },
    onSuccess: () => {
      toast.success('Đã cập nhật danh mục')
      queryClient.invalidateQueries({ queryKey })
      setEditingItemId(null)
      setEditingName('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể cập nhật danh mục')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`${endpoint}/${id}`)
      return res.data
    },
    onSuccess: () => {
      toast.success('Đã xóa danh mục')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể xóa danh mục')
    }
  })

  return (
    <div data-hotkey-scope className="flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-background-secondary shadow-sm mb-6">
      <CardHeader title="Danh mục sản phẩm" subtitle="Phân loại theo loài" count={items.length} icon={Tags} />
      
      <div className="flex-1 space-y-3 p-5 overflow-y-auto">
        {canCreate && (
          <div className="rounded-2xl border border-primary-500/30 bg-primary-500/5 p-2">
            <div className="flex items-center gap-2">
              <select 
                value={draftSpecies} 
                onChange={e => setDraftSpecies(e.target.value as any)}
                className="h-11 w-28 shrink-0 rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary-500"
              >
                {SPECIES_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && draftName.trim()) {
                    createMutation.mutate({ name: draftName.trim(), targetSpecies: draftSpecies })
                  }
                }}
                placeholder="Thêm danh mục mới..."
                className="h-11 flex-1 min-w-0 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
              />
              <button
                type="button"
                disabled={createMutation.isPending}
                onClick={() => {
                  if (draftName.trim()) {
                    createMutation.mutate({ name: draftName.trim(), targetSpecies: draftSpecies })
                  }
                }}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors"
              >
                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-5 pt-2">
          {isLoading ? (
            <div className="flex h-20 items-center justify-center text-foreground-muted">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 px-4 py-8 text-center text-sm text-foreground-muted">
              Chưa có danh mục nào.
            </div>
          ) : (
            SPECIES_LIST.map(sp => {
              const list = items.filter(b => b.targetSpecies === sp.value || (!b.targetSpecies && sp.value === 'OTHER'))
              if (list.length === 0) return null
              return (
                <div key={sp.value} className="space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground-muted">{sp.label}</h4>
                  <div className="flex flex-wrap gap-2">
                    {list.map(b => (
                      <div key={b.id} className="group inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5 text-sm transition-colors hover:border-primary-500/30">
                        {editingItemId === b.id ? (
                          <div className="flex items-center gap-1">
                            <input 
                              value={editingName} 
                              onChange={e => setEditingName(e.target.value)}
                              onKeyDown={e => { 
                                if (e.key === 'Enter') {
                                  if (editingName.trim()) updateMutation.mutate({ id: b.id, name: editingName.trim() })
                                }
                                if (e.key === 'Escape') setEditingItemId(null) 
                              }}
                              className="h-7 w-32 rounded bg-background-secondary px-2 text-sm outline-none focus:ring-1 focus:ring-primary-500" 
                              autoFocus 
                            />
                            <button 
                              onClick={() => {
                                if (editingName.trim()) updateMutation.mutate({ id: b.id, name: editingName.trim() })
                              }} 
                              className="text-primary-500 hover:text-primary-400"
                            >
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditingItemId(null)} className="text-foreground-muted hover:text-foreground">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="truncate font-medium text-foreground">{b.name}</span>
                            <div className="-mr-1.5 ml-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canUpdate && (
                                <button 
                                  onClick={() => { setEditingItemId(b.id); setEditingName(b.name) }}
                                  className="flex h-5 w-5 items-center justify-center rounded-full text-foreground-muted hover:bg-background-secondary hover:text-primary-500"
                                >
                                  <Pencil size={11} />
                                </button>
                              )}
                              {canDelete && (
                                <button 
                                  onClick={() => {
                                    if (confirm(`Xóa danh mục "${b.name}"?`)) deleteMutation.mutate(b.id)
                                  }}
                                  className="flex h-5 w-5 items-center justify-center rounded-full text-foreground-muted hover:bg-red-500/10 hover:text-red-500"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}


function PriceBookCard({
  canRead,
  canManage,
}: {
  canRead: boolean
  canManage: boolean
}) {
  const queryClient = useQueryClient()
  const endpoint = '/inventory/price-books'
  const queryKey = ['settings', 'inventory', 'price-books']
  const [draftName, setDraftName] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get(endpoint)
      return (res.data.data ?? []) as DictionaryItem[]
    },
  })

  const orderedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER
        const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER
        if (leftOrder !== rightOrder) return leftOrder - rightOrder
        return left.name.localeCompare(right.name, 'vi')
      }),
    [items]
  )

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post(endpoint, {
        name,
        channel: 'GENERAL',
        sortOrder: orderedItems.length,
        isDefault: orderedItems.length === 0,
        isActive: true,
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Đã thêm bảng giá')
      queryClient.invalidateQueries({ queryKey })
      setDraftName('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể thêm bảng giá')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await api.put(`${endpoint}/${id}`, {
        name,
        isActive: true,
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Đã cập nhật bảng giá')
      queryClient.invalidateQueries({ queryKey })
      setEditingItemId(null)
      setEditingName('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể cập nhật bảng giá')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async ({ id, remainingItems }: { id: string; remainingItems: DictionaryItem[] }) => {
      await api.delete(`${endpoint}/${id}`)

      if (remainingItems.length > 0) {
        await Promise.all(
          remainingItems.map((item, index) =>
            api.put(`${endpoint}/${item.id}`, {
              name: item.name,
              channel: item.channel ?? 'GENERAL',
              sortOrder: index,
              isDefault: index === 0,
              isActive: item.isActive ?? true,
            })
          )
        )
      }
    },
    onSuccess: () => {
      toast.success('Đã xóa bảng giá')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể xóa bảng giá')
    },
  })

  const reorderMutation = useMutation({
    mutationFn: async (nextItems: DictionaryItem[]) => {
      await Promise.all(
        nextItems.map((item, index) =>
          api.put(`${endpoint}/${item.id}`, {
            name: item.name,
            channel: item.channel ?? 'GENERAL',
            sortOrder: index,
            isDefault: index === 0,
            isActive: item.isActive ?? true,
          })
        )
      )
    },
    onSuccess: () => {
      toast.success('Đã cập nhật thứ tự bảng giá')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể cập nhật thứ tự bảng giá')
    },
  })

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= orderedItems.length) return
    const next = [...orderedItems]
    const [current] = next.splice(index, 1)
    next.splice(targetIndex, 0, current)
    reorderMutation.mutate(next)
  }

  const totalPages = Math.max(1, Math.ceil(orderedItems.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const pagedItems = orderedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div data-hotkey-scope className="overflow-hidden rounded-3xl border border-border/70 bg-background-secondary shadow-sm">
      <CardHeader title="Bảng giá bán" subtitle="Giá lẻ, giá sỉ, giá đại lý..." count={orderedItems.length} icon={BadgeDollarSign} />

      <div className="space-y-3 p-5">
        {canManage ? (
          <div className="rounded-2xl border border-primary-500/30 bg-primary-500/5 p-2">
          <div className="flex items-center gap-2">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Thêm bảng giá..."
              className="h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
            />
            <button
              type="button"
              onClick={() => {
                const value = draftName.trim()
                if (!value) return toast.error('Vui lòng nhập tên bảng giá')
                createMutation.mutate(value)
              }}
              data-hotkey-enter
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500 text-white"
            >
              {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
          </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex h-20 items-center justify-center text-foreground-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : !canRead ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-5 text-sm text-foreground-muted">
            Bạn không có quyền xem bảng giá.
          </div>
        ) : orderedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-5 text-sm text-foreground-muted">
            Chưa có bảng giá nào.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-border/50">
              {pagedItems.map((item) => {
                const absoluteIndex = orderedItems.findIndex((candidate) => candidate.id === item.id)

                return (
                  <div key={item.id} className="border-b border-border/40 last:border-b-0">
                    {editingItemId === item.id && canManage ? (
                      <div className="flex items-center gap-2 bg-background-secondary/50 px-4 py-3">
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateMutation.mutate({ id: item.id, name: editingName.trim() })
                            } else if (e.key === 'Escape') {
                              setEditingItemId(null)
                              setEditingName('')
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => updateMutation.mutate({ id: item.id, name: editingName.trim() })}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-white"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(null)
                            setEditingName('')
                          }}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground-muted transition-colors hover:bg-background"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 bg-background px-4 py-3 last:border-b-0">
                        {canManage ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveItem(absoluteIndex, -1)}
                              disabled={absoluteIndex === 0 || reorderMutation.isPending}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-foreground-muted transition-colors disabled:opacity-40 hover:text-foreground"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveItem(absoluteIndex, 1)}
                              disabled={absoluteIndex === orderedItems.length - 1 || reorderMutation.isPending}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-foreground-muted transition-colors disabled:opacity-40 hover:text-foreground"
                            >
                              <ArrowDown size={13} />
                            </button>
                          </div>
                        ) : null}

                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <div className="truncate text-sm font-semibold text-foreground">{item.name}</div>
                          {absoluteIndex === 0 && (
                            <Star size={16} fill="currentColor" className="text-amber-400 shrink-0" />
                          )}
                        </div>

                        {canManage ? (
                          <div className="flex justify-end gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItemId(item.id)
                                setEditingName(item.name)
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Xóa "${item.name}"?`)) {
                                  deleteMutation.mutate({
                                    id: item.id,
                                    remainingItems: orderedItems.filter((candidate) => candidate.id !== item.id),
                                  })
                                }
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <PaginationControls page={page} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </div>
    </div>
  )
}


interface InventorySettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function InventorySettingsDrawer({ isOpen, onClose }: InventorySettingsDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const { hasPermission } = useAuthorization()
  const canReadProducts = hasPermission('product.read')
  const canCreateProducts = hasPermission('product.create')
  const canUpdateProducts = hasPermission('product.update')
  const canDeleteProducts = hasPermission('product.delete')
  const canManagePricing = hasPermission('settings.pricing_policy.manage')
  const canOpenDrawer = canReadProducts || canManagePricing

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen && !canOpenDrawer) {
      onClose()
    }
  }, [canOpenDrawer, isOpen, onClose])

  if (!mounted || !canOpenDrawer) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[900px] max-w-screen glass-panel border-l border-white/10 z-50 overflow-y-auto flex flex-col"
            style={{ boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4)' }}
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-background/70 backdrop-blur-xl z-10">
              <div className="flex items-center gap-3 text-primary-400">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-500">
                  <SettingsIcon size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-lg text-foreground-base">Cấu hình kho hàng</h2>
                  <p className="text-sm text-foreground-muted">Quản lý danh mục, quy đổi và bảng giá</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 text-foreground-muted transition-colors"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 space-y-8 pb-12">
              <div className="grid gap-5 xl:grid-cols-2">
                {canReadProducts ? (
                  <TagDictionaryCard
                    endpoint="/inventory/units"
                    queryKey={['settings', 'inventory', 'units']}
                    syncQueryKeys={[['units']]}
                    title="Đơn vị bán"
                    subtitle="cái, kg, hộp, túi..."
                    addLabel="Thêm đơn vị"
                    icon={Scale}
                    canCreate={canCreateProducts}
                    canUpdate={canUpdateProducts}
                    canDelete={canDeleteProducts}
                  />
                ) : null}
                {canReadProducts ? (
                  <TagDictionaryCard
                    endpoint="/inventory/brands"
                    queryKey={['settings', 'inventory', 'brands']}
                    syncQueryKeys={[['brands']]}
                    title="Nhãn hiệu"
                    subtitle="Royal Canin, Pedigree, Whiskas..."
                    addLabel="Thêm mới"
                    icon={Package}
                    canCreate={canCreateProducts}
                    canUpdate={canUpdateProducts}
                    canDelete={canDeleteProducts}
                  />
                ) : null}
                {canReadProducts ? (
                  <CategoryCard canCreate={canCreateProducts} canUpdate={canUpdateProducts} canDelete={canDeleteProducts} />
                ) : null}
                <PriceBookCard canRead={canReadProducts || canManagePricing} canManage={canManagePricing} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
