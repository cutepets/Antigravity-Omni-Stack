'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pin, PinOff, PawPrint, Trash2 } from 'lucide-react'
import { loadTempsFromDB, TemperEntry, getTemperStyle } from './pet-settings-modal'
import { toast } from 'sonner'
import { petApi } from '@/lib/api/pet.api'
import { PetFormModal } from './pet-form-modal'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useRouter } from 'next/navigation'
import {
  DataListShell,
  DataListToolbar,
  DataListFilterPanel,
  DataListColumnPanel,
  DataListTable,
  DataListPagination,
  DataListBulkBar,
  TableCheckbox,
  filterSelectClass,
  toolbarSelectClass,
  useDataListCore,
  useDataListSelection,
} from '@petshop/ui/data-list'

import { UnifiedPetProfile } from '@/components/pet/UnifiedPetProfile'

type SpeciesFilter = '' | 'Chó' | 'Mèo' | 'Chim' | 'Khác'
type DisplayColumnId = 'avatar' | 'pet' | 'breed' | 'color' | 'owner' | 'weight' | 'dob' | 'allergies' | 'status' | 'petCode'
type PinFilterId = 'species'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string }> = [
  { id: 'avatar', label: 'Ảnh', width: 'w-14' },
  { id: 'pet', label: 'Thú cưng', sortable: true, minWidth: 'min-w-[120px]' },
  { id: 'breed', label: 'Giống', sortable: true, minWidth: 'min-w-[100px]' },
  { id: 'color', label: 'Màu', minWidth: 'min-w-[80px]' },
  { id: 'owner', label: 'Chủ sở hữu', sortable: true, minWidth: 'min-w-[120px]' },
  { id: 'weight', label: 'Cân nặng', sortable: true, minWidth: 'min-w-[90px]' },
  { id: 'dob', label: 'Ngày sinh', sortable: true, minWidth: 'min-w-[100px]' },
  { id: 'allergies', label: 'Dị ứng', minWidth: 'min-w-[130px]' },
  { id: 'status', label: 'Trạng thái', width: 'w-24' },
  { id: 'petCode', label: 'Mã PET', sortable: true, width: 'w-24' },
]

const SPECIES_OPTIONS: { value: SpeciesFilter; label: string }[] = [
  { value: 'Chó', label: 'Chó' },
  { value: 'Mèo', label: 'Mèo' },
  { value: 'Chim', label: 'Chim' },
  { value: 'Khác', label: 'Khác' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(['pet', 'owner', 'petCode'])

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null

function getEmoji(s?: string) {
  if (s === 'Chó') return '🐕'
  if (s === 'Mèo') return '🐱'
  return '🐾'
}

function getPetIdFromLocation() {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const queryPetId = params.get('petId')
  if (queryPetId) return queryPetId

  const legacyMatch = window.location.pathname.match(/^\/pet\/([^/?#]+)/)
  return legacyMatch ? decodeURIComponent(legacyMatch[1]) : null
}

export function PetList() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [viewingPetCode, setViewingPetCode] = useState<string | null>(() => getPetIdFromLocation())

  const { hasPermission, isLoading: isAuthLoading } = useAuthorization()
  const canReadPets   = hasPermission('pet.read')
  const canCreatePet  = hasPermission('pet.create')
  const canDeletePet  = hasPermission('pet.delete')

  const [q, setQ]             = useState('')
  const [species, setSpecies] = useState<SpeciesFilter>('')
  const [page, setPage]       = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [q, species])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPet, setEditingPet] = useState<any>(null)

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((c) => c.id),
    initialVisibleColumns: ['avatar', 'pet', 'breed', 'owner', 'weight', 'dob', 'petCode'],
    initialTopFilterVisibility: { species: true },
    storageKey: 'pet-list-columns-v2',
  })
  const { topFilterVisibility, columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  useEffect(() => {
    if (isAuthLoading) return
    if (!canReadPets) router.replace('/dashboard')
  }, [canReadPets, isAuthLoading, router])

  useEffect(() => {
    const syncPetFromUrl = () => setViewingPetCode(getPetIdFromLocation())

    syncPetFromUrl()
    window.addEventListener('popstate', syncPetFromUrl)
    return () => window.removeEventListener('popstate', syncPetFromUrl)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['pets', q, species, page, pageSize],
    queryFn: () => petApi.getPets({ q, species, page, limit: pageSize }),
  })

  const { data: temperConfig = [] } = useQuery<TemperEntry[]>({
    queryKey: ['pet-settings', 'tempers'],
    queryFn: loadTempsFromDB,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const rawPets = data?.data ?? []
  const meta = data?.meta

  const sortedPets = useMemo(() => {
    if (!columnSort.columnId || !columnSort.direction) return rawPets

    const dir = columnSort.direction === 'asc' ? 1 : -1
    return [...rawPets].sort((a: any, b: any) => {
      let cmp = 0
      switch (columnSort.columnId) {
        case 'pet':
          cmp = (a.name || '').localeCompare(b.name || '', 'vi')
          break
        case 'owner':
          cmp = (a.customer?.fullName || '').localeCompare(b.customer?.fullName || '', 'vi')
          break
        case 'petCode':
          cmp = (a.petCode || '').localeCompare(b.petCode || '', 'vi')
          break
        default:
          cmp = 0
      }
      return cmp * dir
    })
  }, [rawPets, columnSort])

  const total = meta?.total ?? 0
  const totalPages = meta?.totalPages ?? 1
  const visibleRangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const visibleRangeEnd = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + rawPets.length)

  // Selection
  const visiblePetRowIds = useMemo(
    () => sortedPets.map((p: any) => `pet:${p.id}`),
    [sortedPets]
  )

  const {
    selectedRowIds,
    toggleRowSelection,
    toggleSelectAllVisible,
    clearSelection,
    allVisibleSelected,
  } = useDataListSelection(visiblePetRowIds)

  const selectedPetIds = useMemo(() => {
    return Array.from(selectedRowIds)
      .filter((id) => id.startsWith('pet:'))
      .map((id) => id.replace('pet:', ''))
  }, [selectedRowIds])

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => petApi.deletePet(id)))
    },
    onSuccess: () => {
      toast.success('Đã xóa các thú cưng đã chọn')
      queryClient.invalidateQueries({ queryKey: ['pets'] })
      clearSelection()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể xóa một hoặc nhiều thú cưng đã chọn')
    },
  })

  const clearFilters = () => {
    setSpecies('')
    setQ('')
    setPage(1)
  }

  const openPetDetail = (petKey: string) => {
    window.history.pushState(null, '', `/pets?petId=${encodeURIComponent(petKey)}`)
    setViewingPetCode(petKey)
    void queryClient.prefetchQuery({
      queryKey: ['pet', petKey],
      queryFn: () => petApi.getPet(petKey),
      staleTime: 30 * 1000,
    })
  }

  const tableColumns = orderedVisibleColumns.map((colId) => {
    const c = COLUMN_OPTIONS.find((opt) => opt.id === colId)!
    return { ...c, id: colId as DisplayColumnId }
  })

  if (isAuthLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-foreground-muted text-sm gap-3">
        <div className="h-5 w-5 rounded-full border-2 border-border border-t-primary-500 animate-spin" />
        Đang kiểm tra quyền truy cập...
      </div>
    )
  }

  if (!canReadPets) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted text-sm">Đang chuyển hướng...</div>
  }

  return (
    <DataListShell>
      <DataListToolbar
        searchValue={q}
        onSearchChange={(v) => { setQ(v); setPage(1) }}
        searchPlaceholder="Tìm tên, mã PET, SĐT chủ..."
        filterSlot={
          <>
            {topFilterVisibility.species && (
              <select
                value={species}
                onChange={(e) => { setSpecies(e.target.value as SpeciesFilter); setPage(1) }}
                className={`${toolbarSelectClass} min-w-[140px] appearance-none leading-none h-8 my-auto text-sm`}
              >
                <option value="">Tất cả giống loài</option>
                {SPECIES_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </>
        }
        columnPanelContent={
          <DataListColumnPanel
            columns={COLUMN_OPTIONS}
            columnOrder={columnOrder}
            visibleColumns={visibleColumns}
            sortInfo={columnSort}
            sortableColumns={SORTABLE_COLUMNS}
            draggingColumnId={draggingColumnId}
            onToggle={(id) => dataListState.toggleColumn(id as DisplayColumnId)}
            onReorder={(src, tgt) => dataListState.reorderColumn(src as DisplayColumnId, tgt as DisplayColumnId)}
            onToggleSort={(id) => dataListState.toggleColumnSort(id as DisplayColumnId)}
            onDragStart={(id) => dataListState.setDraggingColumnId(id as DisplayColumnId)}
            onDragEnd={() => dataListState.setDraggingColumnId(null)}
          />
        }
        extraActions={
          <div className="flex items-center gap-2">
            {canCreatePet && (
              <button
                type="button"
                onClick={() => { setEditingPet(null); setIsModalOpen(true) }}
                className="inline-flex h-9 sm:h-10 items-center justify-center gap-2 rounded-xl bg-primary-500 px-3 sm:px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                <Plus size={16} />
                Thêm thú cưng
              </button>
            )}
          </div>
        }
      />

      <DataListFilterPanel onClearAll={clearFilters}>
        <label className="space-y-2">
          <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
            <span className="inline-flex items-center gap-2">
              <PawPrint size={14} className="text-primary-500" />
              Giống loài
            </span>
            <button
              type="button"
              onClick={() => dataListState.toggleTopFilterVisibility('species')}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                topFilterVisibility.species ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {topFilterVisibility.species ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          </span>
          <select
            value={species}
            onChange={(e) => { setSpecies(e.target.value as SpeciesFilter); setPage(1) }}
            className={filterSelectClass}
          >
            <option value="">Tất cả giống loài</option>
            {SPECIES_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </DataListFilterPanel>

      <DataListTable
        columns={tableColumns}
        isLoading={isLoading}
        isEmpty={sortedPets.length === 0}
        emptyText="Không tìm thấy thú cưng."
        allSelected={allVisibleSelected}
        onSelectAll={toggleSelectAllVisible}
        bulkBar={
          selectedPetIds.length > 0 && canDeletePet ? (
            <DataListBulkBar
              selectedCount={selectedPetIds.length}
              onClear={clearSelection}
            >
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Xóa ${selectedPetIds.length} thú cưng đã chọn?`)) {
                    bulkDeleteMutation.mutate(selectedPetIds)
                  }
                }}
                disabled={bulkDeleteMutation.isPending}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-semibold text-red-500 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Trash2 size={15} />
                Xóa
              </button>
            </DataListBulkBar>
          ) : undefined
        }
      >
        {sortedPets.map((p: any) => {
          const rowId = `pet:${p.id}`
          const isSelected = selectedRowIds.has(rowId)
          
          return (
            <tr
              key={p.id}
              onClick={() => openPetDetail(p.petCode || p.id)}
              className="group cursor-pointer hover:bg-background-tertiary/60 transition-colors"
            >
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <TableCheckbox
                  checked={isSelected}
                  onCheckedChange={(checked, shiftKey) => toggleRowSelection(rowId, shiftKey)}
                />
              </td>

              {orderedVisibleColumns.map((colId) => {
                if (colId === 'avatar') {
                  return (
                    <td key={colId} className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary-400/20 to-primary-600/20 border border-primary-500/15 flex items-center justify-center text-lg overflow-hidden shrink-0">
                        {p.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          getEmoji(p.species)
                        )}
                      </div>
                    </td>
                  )
                }
                if (colId === 'pet') {
                  const tCfg = temperConfig.find(tc => tc.name === p.temperament)
                  const cInfo = tCfg ? getTemperStyle(tCfg.color) : null
                  return (
                    <td key={colId} className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground text-sm">
                        {p.name}
                        {p.gender === 'MALE' && <span className="text-info text-xs">♂</span>}
                        {p.gender === 'FEMALE' && <span className="text-pink-400 text-xs">♀</span>}
                        {p.temperament && cInfo && (
                          <div className={`ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest border ${cInfo.bg} ${cInfo.text} ${cInfo.border}`} title={p.temperament}>
                            {p.temperament}
                          </div>
                        )}
                        {p.temperament && !cInfo && (
                          <div className={`ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest border bg-gray-500/10 text-gray-500 border-gray-500/20`} title={p.temperament}>
                            {p.temperament}
                          </div>
                        )}
                      </div>
                    </td>
                  )
                }
                if (colId === 'breed') {
                  return (
                    <td key={colId} className="px-3 py-2.5">
                      <div className="text-sm font-medium text-foreground-muted">
                        {p.species}{p.breed ? ` - ${p.breed}` : ''}
                      </div>
                    </td>
                  )
                }
                if (colId === 'color') {
                  return (
                    <td key={colId} className="px-3 py-2.5">
                      <div className="text-sm text-foreground-muted">
                        {p.color || '—'}
                      </div>
                    </td>
                  )
                }
                if (colId === 'owner') {
                  return (
                    <td key={colId} className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {p.customer?.fullName ? (
                           <div className="w-6 h-6 rounded bg-linear-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                             {p.customer.fullName.charAt(0).toUpperCase()}
                           </div>
                        ) : null}
                        <div className="text-sm text-foreground space-x-1">
                          <span className="font-medium">{p.customer?.fullName || '-'}</span>
                          {p.customer?.phone && (
                            <span className="text-foreground-muted text-xs block xl:inline">({p.customer.phone})</span>
                          )}
                        </div>
                      </div>
                    </td>
                  )
                }
                if (colId === 'weight') {
                  return (
                    <td key={colId} className="px-3 py-2.5">
                      <div className="text-sm font-medium text-foreground">
                        {p.weight ? `${p.weight} kg` : '—'}
                      </div>
                    </td>
                  )
                }
                if (colId === 'dob') {
                  return (
                    <td key={colId} className="px-3 py-2.5">
                      <div className="text-sm text-foreground-muted">
                        {p.dateOfBirth ? fmt(p.dateOfBirth) : '—'}
                      </div>
                    </td>
                  )
                }
                if (colId === 'allergies') {
                  return (
                    <td key={colId} className="px-3 py-2.5">
                      {p.allergies ? (
                        <span className="text-sm text-error truncate" title={p.allergies}>{p.allergies}</span>
                      ) : '—'}
                    </td>
                  )
                }
                if (colId === 'status') {
                  return (
                    <td key={colId} className="px-3 py-2.5">
                      {p.isActive !== false ? (
                        <span className="badge-success">Hoạt động</span>
                      ) : (
                        <span className="badge-error">Ngừng HĐ</span>
                      )}
                    </td>
                  )
                }
                if (colId === 'petCode') {
                  return (
                    <td key={colId} className="px-3 py-2.5">
                      <span className="font-mono text-xs font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-md">
                        {p.petCode}
                      </span>
                    </td>
                  )
                }
                return <td key={colId} className="px-3 py-2.5"></td>
              })}
            </tr>
          )
        })}
      </DataListTable>

      <div className="-mt-3">
        <div className="rounded-b-2xl border border-t-0 border-border bg-card/95">
          <DataListPagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            total={total}
            rangeStart={visibleRangeStart}
            rangeEnd={visibleRangeEnd}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
            totalItemText={
              <p className="shrink-0 text-xs text-foreground-muted">
                Tổng <strong className="text-foreground">{total}</strong> thú cưng
                {q && <span> · tìm kiếm &quot;{q}&quot;</span>}
              </p>
            }
          />
        </div>
      </div>

      {isModalOpen && (
        <PetFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialData={editingPet}
        />
      )}

      {viewingPetCode && (
        <UnifiedPetProfile
          petId={viewingPetCode}
          isOpen={true}
          hideSuggestions={true}
          onClose={() => {
            window.history.pushState(null, '', `/pets`)
            setViewingPetCode(null)
          }}
        />
      )}
    </DataListShell>
  )
}
