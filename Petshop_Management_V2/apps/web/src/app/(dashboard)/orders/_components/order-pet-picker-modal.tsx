'use client'

import { PawPrint, X } from 'lucide-react'

interface OrderPetPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (payload: { petId: string; petName?: string }) => void
  pets: any[]
  title?: string
  description?: string
}

export function OrderPetPickerModal({
  isOpen,
  onClose,
  onConfirm,
  pets,
  title = 'Chon thu cung',
  description = 'Don grooming can gan voi thu cung cu the.',
}: OrderPetPickerModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">Grooming</p>
            <h2 className="mt-2 text-xl font-bold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-foreground-muted">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background-secondary text-foreground-muted transition-colors hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 px-6 py-5 sm:grid-cols-2">
          {pets.map((pet) => (
            <button
              key={pet.id}
              type="button"
              onClick={() => onConfirm({ petId: pet.id, petName: pet.name })}
              className="rounded-2xl border border-border bg-background-secondary/70 p-4 text-left transition-colors hover:border-primary-500/40 hover:bg-background"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
                  <PawPrint size={18} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{pet.name}</div>
                  <div className="mt-1 text-xs text-foreground-muted">
                    {[pet.species, pet.weight ? `${pet.weight} kg` : null].filter(Boolean).join(' • ') || 'Khong co thong tin'}
                  </div>
                </div>
              </div>
            </button>
          ))}
          {pets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-foreground-muted sm:col-span-2">
              Khach hang nay chua co thu cung de gan voi dich vu grooming.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
