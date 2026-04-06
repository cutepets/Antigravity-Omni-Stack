'use client'

import { useMemo, useState } from 'react'
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
  Plus,
  Scale,
  Search,
  Settings,
  Tags,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { api } from '@/lib/api'

type DictionaryItem = {
  id: string
  name: string
  description?: string | null
  channel?: string | null
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
          TrÆ°á»›c
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
  title,
  subtitle,
  addLabel,
  icon: Icon,
}: {
  endpoint: string
  queryKey: string[]
  title: string
  subtitle: string
  addLabel: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

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

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post(endpoint, { name })
      return res.data
    },
    onSuccess: () => {
      toast.success(`ÄÃ£ thÃªm ${title.toLowerCase()}`)
      queryClient.invalidateQueries({ queryKey })
      setSearch('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || `KhÃ´ng thá»ƒ thÃªm ${title.toLowerCase()}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`${endpoint}/${id}`)
      return res.data
    },
    onSuccess: () => {
      toast.success(`ÄÃ£ xÃ³a ${title.toLowerCase()}`)
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || `KhÃ´ng thá»ƒ xÃ³a ${title.toLowerCase()}`)
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
            placeholder={`TÃ¬m ${title.toLowerCase()}...`}
            className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm outline-none transition-colors focus:border-primary-500"
          />
        </div>

        {search.trim() && !hasExactMatch && (
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
            {search.trim() ? 'KhÃ´ng tÃ¬m tháº¥y má»¥c phÃ¹ há»£p.' : `ChÆ°a cÃ³ ${title.toLowerCase()} nÃ o.`}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-2 text-sm"
              >
                <span className="truncate font-medium text-foreground">{item.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`XÃ³a "${item.name}"?`)) deleteMutation.mutate(item.id)
                  }}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryCard() {
  const queryClient = useQueryClient()
  const [draftName, setDraftName] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const endpoint = '/inventory/categories'
  const queryKey = ['settings', 'inventory', 'categories']

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get(endpoint)
      return (res.data.data ?? []) as DictionaryItem[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post(endpoint, { name })
      return res.data
    },
    onSuccess: () => {
      toast.success('ÄÃ£ thÃªm danh má»¥c')
      queryClient.invalidateQueries({ queryKey })
      setDraftName('')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await api.put(`${endpoint}/${id}`, { name })
      return res.data
    },
    onSuccess: () => {
      toast.success('ÄÃ£ cáº­p nháº­t danh má»¥c')
      queryClient.invalidateQueries({ queryKey })
      setEditingItemId(null)
      setEditingName('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`${endpoint}/${id}`)
      return res.data
    },
    onSuccess: () => {
      toast.success('ÄÃ£ xÃ³a danh má»¥c')
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div data-hotkey-scope className="overflow-hidden rounded-3xl border border-border/70 bg-background-secondary shadow-sm">
      <CardHeader title="Danh má»¥c" subtitle="Thá»©c Äƒn, vá»‡ sinh, thuá»‘c..." count={items.length} icon={Tags} />

      <div className="space-y-3 p-5">
        <div className="rounded-2xl border border-primary-500/30 bg-primary-500/5 p-2">
          <div className="flex items-center gap-2">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="ThÃªm má»›i..."
              className="h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
            />
            <button
              type="button"
              onClick={() => {
                const value = draftName.trim()
                if (!value) return toast.error('Vui lÃ²ng nháº­p tÃªn danh má»¥c')
                createMutation.mutate(value)
              }}
              data-hotkey-enter
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500 text-white"
            >
              {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-20 items-center justify-center text-foreground-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-5 text-sm text-foreground-muted">
            ChÆ°a cÃ³ danh má»¥c nÃ o.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-border/50">
              <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3 border-b border-border/50 bg-background-secondary px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground-muted">
                <span>TÃªn danh má»¥c</span>
                <span className="text-right">Thao tÃ¡c</span>
              </div>

              {pagedItems.map((item) => (
                <div key={item.id} className="border-b border-border/40 bg-background last:border-b-0">
                  {editingItemId === item.id ? (
                    <div className="flex items-center gap-2 px-4 py-3">
                      <input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className="h-10 flex-1 rounded-xl border border-border bg-background-secondary px-4 text-sm outline-none transition-colors focus:border-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => updateMutation.mutate({ id: item.id, name: editingName.trim() })}
                        data-hotkey-enter
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
                        data-hotkey-esc
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground-muted"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 px-4 py-3">
                      <div className="truncate text-sm font-medium text-foreground">{item.name}</div>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(item.id)
                            setEditingName(item.name)
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
                        >
                          <Plus size={14} className="rotate-45" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`XÃ³a "${item.name}"?`)) deleteMutation.mutate(item.id)
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <PaginationControls page={page} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </div>
    </div>
  )
}

function PriceBookCard() {
  const queryClient = useQueryClient()
  const endpoint = '/inventory/price-books'
  const queryKey = ['settings', 'inventory', 'price-books']
  const [draftName, setDraftName] = useState('')
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
      toast.success('ÄÃ£ thÃªm báº£ng giÃ¡')
      queryClient.invalidateQueries({ queryKey })
      setDraftName('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'KhÃ´ng thá»ƒ thÃªm báº£ng giÃ¡')
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
      toast.success('ÄÃ£ xÃ³a báº£ng giÃ¡')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'KhÃ´ng thá»ƒ xÃ³a báº£ng giÃ¡')
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
      toast.success('ÄÃ£ cáº­p nháº­t thá»© tá»± báº£ng giÃ¡')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'KhÃ´ng thá»ƒ cáº­p nháº­t thá»© tá»± báº£ng giÃ¡')
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
      <CardHeader title="Báº£ng giÃ¡ bÃ¡n" subtitle="GiÃ¡ láº», giÃ¡ sá»‰, giÃ¡ Ä‘áº¡i lÃ½..." count={orderedItems.length} icon={BadgeDollarSign} />

      <div className="space-y-3 p-5">
        <div className="rounded-2xl border border-primary-500/30 bg-primary-500/5 p-2">
          <div className="flex items-center gap-2">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="ThÃªm báº£ng giÃ¡..."
              className="h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
            />
            <button
              type="button"
              onClick={() => {
                const value = draftName.trim()
                if (!value) return toast.error('Vui lÃ²ng nháº­p tÃªn báº£ng giÃ¡')
                createMutation.mutate(value)
              }}
              data-hotkey-enter
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500 text-white"
            >
              {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-20 items-center justify-center text-foreground-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : orderedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-5 text-sm text-foreground-muted">
            ChÆ°a cÃ³ báº£ng giÃ¡ nÃ o.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-border/50">
              <div className="grid grid-cols-[72px_minmax(0,1fr)_88px_88px] gap-3 border-b border-border/50 bg-background-secondary px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground-muted">
                <span>Thá»© tá»±</span>
                <span>TÃªn báº£ng giÃ¡</span>
                <span className="text-center">Máº·c Ä‘á»‹nh</span>
                <span className="text-right">Thao tÃ¡c</span>
              </div>

              {pagedItems.map((item) => {
                const absoluteIndex = orderedItems.findIndex((candidate) => candidate.id === item.id)

                return (
                  <div key={item.id} className="grid grid-cols-[72px_minmax(0,1fr)_88px_88px] items-center gap-3 border-b border-border/40 bg-background px-4 py-3 last:border-b-0">
                    <div className="flex items-center gap-1">
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

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{item.name}</div>
                      <div className="truncate text-xs text-foreground-muted">KÃªnh {item.channel ?? 'GENERAL'} Â· Thá»© tá»± {absoluteIndex + 1}</div>
                    </div>

                    <div className="flex justify-center">
                      {absoluteIndex === 0 ? (
                        <span className="inline-flex rounded-full bg-primary-500/10 px-2.5 py-1 text-xs font-bold text-primary-400">
                          Máº·c Ä‘á»‹nh
                        </span>
                      ) : (
                        <span className="text-xs text-foreground-muted">-</span>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`XÃ³a "${item.name}"?`)) {
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

export default function InventorySettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 py-8 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/settings" className="inline-flex items-center font-medium text-foreground-muted transition-colors hover:text-primary-500">
              <ArrowLeft size={16} className="mr-2" />
              Quay láº¡i cÃ i Ä‘áº·t
            </Link>
            <span className="text-foreground-muted">/</span>
            <span className="font-medium text-foreground">Cáº¥u hÃ¬nh kho</span>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary-500/20 bg-primary-500/10 text-primary-500">
              <Settings size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground-base">Cáº¥u hÃ¬nh kho hÃ ng</h1>
              <p className="mt-1 text-sm text-foreground-muted">
                Quáº£n lÃ½ nhanh cÃ¡c danh má»¥c dÃ¹ng cho sáº£n pháº©m, quy Ä‘á»•i vÃ  báº£ng giÃ¡ bÃ¡n trong há»‡ thá»‘ng.
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/settings/customers"
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-background-secondary px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary-500 hover:text-primary-500"
        >
          <Users size={16} />
          Cáº¥u hÃ¬nh khÃ¡ch hÃ ng
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <TagDictionaryCard
          endpoint="/inventory/units"
          queryKey={['settings', 'inventory', 'units']}
          title="ÄÆ¡n vá»‹ bÃ¡n"
          subtitle="cÃ¡i, kg, há»™p, tÃºi..."
          addLabel="ThÃªm Ä‘Æ¡n vá»‹"
          icon={Scale}
        />
        <TagDictionaryCard
          endpoint="/inventory/brands"
          queryKey={['settings', 'inventory', 'brands']}
          title="NhÃ£n hiá»‡u"
          subtitle="Royal Canin, Pedigree, Whiskas..."
          addLabel="ThÃªm má»›i"
          icon={Package}
        />
        <CategoryCard />
        <PriceBookCard />
      </div>
    </div>
  )
}
