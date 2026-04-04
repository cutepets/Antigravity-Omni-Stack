'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Pencil, Trash2, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { petApi } from '@/lib/api/pet.api'
import { PetFormModal } from './pet-form-modal'
import { PetSettingsModal } from './pet-settings-modal'
import { customToast as toast } from '@/components/ui/toast-with-copy'

export function PetList() {
  const [q, setQ] = useState('')
  const [species, setSpecies] = useState('')
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [editingPet, setEditingPet] = useState<any>(null)

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['pets', q, species, page],
    queryFn: () => petApi.getPets({ q, species, page, limit: 10 }),
  })

  const deleteMutation = useMutation({
    mutationFn: petApi.deletePet,
    onSuccess: () => {
      toast.success('Đã xoá thú cưng')
      queryClient.invalidateQueries({ queryKey: ['pets'] })
    },
    onError: () => toast.error('Không thể xoá thú cưng này'),
  })

  const pets = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="card overflow-hidden p-0">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border flex-wrap">
        {/* Filters */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              placeholder="Tìm theo tên bé, mã..."
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1) }}
              className="form-input pl-9"
            />
          </div>
          <select
            value={species}
            onChange={e => { setSpecies(e.target.value); setPage(1) }}
            className="form-input w-auto min-w-[140px]"
          >
            <option value="">Tất cả giống</option>
            <option value="Chó">🐕 Chó</option>
            <option value="Mèo">🐈 Mèo</option>
            <option value="Chim">🐦 Chim</option>
            <option value="Khác">🐾 Khác</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="btn-outline h-9 px-4 rounded-xl text-sm"
          >
            <Settings size={15} /> Cài đặt
          </button>
          <button
            onClick={() => { setEditingPet(null); setIsModalOpen(true) }}
            className="btn-primary liquid-button h-9 px-4 rounded-xl text-sm"
          >
            <Plus size={15} /> Thêm thú cưng
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="w-full overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã Pet</th>
              <th>Thú cưng</th>
              <th>Chủ sở hữu</th>
              <th>Thông tin</th>
              <th className="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-foreground-muted text-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-6 w-6 rounded-full border-2 border-border border-t-primary-500 animate-spin" />
                    Đang tải dữ liệu...
                  </div>
                </td>
              </tr>
            ) : pets.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-foreground-muted">
                    <span className="text-4xl opacity-30">🐾</span>
                    <p className="text-sm">Không tìm thấy thú cưng nào</p>
                  </div>
                </td>
              </tr>
            ) : (
              pets.map((p: any) => (
                <tr key={p.id}>
                  {/* Mã Pet */}
                  <td>
                    <span className="font-mono text-xs font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-md">
                      {p.petCode}
                    </span>
                  </td>

                  {/* Thú cưng */}
                  <td>
                    <div className="flex items-center gap-1.5 font-semibold text-foreground text-sm">
                      {p.name}
                      {p.gender === 'MALE' && <span className="text-info">♂</span>}
                      {p.gender === 'FEMALE' && <span className="text-accent-500">♀</span>}
                      {p.isActive === false && (
                        <span className="badge-error text-[10px] py-0">Ngừng HĐ</span>
                      )}
                    </div>
                    <div className="text-xs text-foreground-muted mt-0.5">
                      {p.species}{p.breed ? ` · ${p.breed}` : ''}{p.color ? ` (${p.color})` : ''}
                    </div>
                  </td>

                  {/* Chủ sở hữu */}
                  <td>
                    <div className="text-sm font-medium text-foreground">{p.customer?.fullName}</div>
                    <div className="text-xs text-foreground-muted mt-0.5">{p.customer?.phone}</div>
                  </td>

                  {/* Thông tin */}
                  <td>
                    <div className="text-xs text-foreground-muted space-y-0.5">
                      <div>Cân nặng: {p.weight ? `${p.weight} kg` : '—'}</div>
                      {p.microchipId && <div>Chip: {p.microchipId}</div>}
                      {p.temperament && <div>Tính cách: {p.temperament}</div>}
                      {p.allergies && <div className="text-error">Dị ứng: {p.allergies}</div>}
                    </div>
                  </td>

                  {/* Thao tác */}
                  <td className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => { setEditingPet(p); setIsModalOpen(true) }}
                        title="Sửa"
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary text-primary-500 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Bạn có chắc xoá thú cưng này?')) {
                            deleteMutation.mutate(p.id)
                          }
                        }}
                        title="Xoá"
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-error/30 bg-error/10 hover:bg-error/20 text-error transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-foreground-muted">
            Trang {meta.page} / {meta.totalPages} · Tổng {meta.total} bé
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={page === meta.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <PetFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialData={editingPet}
        />
      )}

      {isSettingsOpen && (
        <PetSettingsModal
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  )
}

