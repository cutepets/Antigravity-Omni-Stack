'use client'

import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import type { Customer } from '@petshop/shared'
import { customerApi } from '@/lib/api/customer.api'
import { financeApi, type CreateFinanceTransactionInput, type FinanceTransaction } from '@/lib/api/finance.api'
import { toast } from 'sonner'

interface BranchOption {
  id: string
  name: string
}

interface CreateTransactionModalProps {
  branches: BranchOption[]
  transaction?: FinanceTransaction | null
  onClose: () => void
}

function buildInitialForm(transaction?: FinanceTransaction | null): CreateFinanceTransactionInput {
  return {
    type: transaction?.type ?? 'INCOME',
    amount: transaction?.amount ?? 0,
    description: transaction?.description ?? '',
    paymentMethod: transaction?.paymentMethod ?? 'CASH',
    branchId: transaction?.branchId ?? '',
    payerName: transaction?.payerName ?? '',
    payerId: transaction?.payerId ?? undefined,
    notes: transaction?.notes ?? '',
    category: transaction?.category ?? undefined,
    refType: 'MANUAL',
    tags: transaction?.tags ?? undefined,
    date: transaction?.date ?? undefined,
  }
}

export function CreateTransactionModal({ branches, transaction, onClose }: CreateTransactionModalProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CreateFinanceTransactionInput>(() => buildInitialForm(transaction))
  const [customerSearch, setCustomerSearch] = useState('')
  const deferredCustomerSearch = useDeferredValue(customerSearch)
  const customerPanelRef = useRef<HTMLDivElement | null>(null)
  const isEditing = Boolean(transaction)

  useEffect(() => {
    setForm(buildInitialForm(transaction))
  }, [transaction])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerPanelRef.current && !customerPanelRef.current.contains(event.target as Node)) {
        setCustomerSearch('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: customers = [] } = useQuery({
    queryKey: ['finance', 'customer-search', deferredCustomerSearch],
    queryFn: async () => {
      const response = await customerApi.getCustomers({ search: deferredCustomerSearch, limit: 8 })
      return response.data ?? []
    },
    enabled: deferredCustomerSearch.trim().length >= 2,
    staleTime: 10_000,
  })

  const saveTransaction = useMutation({
    mutationFn: () => {
      const payload: CreateFinanceTransactionInput = {
        ...form,
        amount: Number(form.amount),
      }

      if (transaction) {
        return financeApi.update(transaction.id, payload)
      }

      return financeApi.create(payload)
    },
    onSuccess: () => {
      toast.success(transaction ? 'Da cap nhat phieu thu chi' : 'Da tao phieu thu chi')
      queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] })
      onClose()
    },
    onError: () => {
      toast.error(transaction ? 'Khong the cap nhat phieu thu chi' : 'Khong the tao phieu thu chi')
    },
  })

  const canSubmit = Number(form.amount) > 0 && form.description.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-3xl border border-border bg-background-base p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{isEditing ? 'Chinh sua phieu thu chi' : 'Tao phieu thu chi'}</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {isEditing ? 'Cap nhat manual voucher trong so quy hien tai.' : 'Manual voucher se vao so quy ngay sau khi luu.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground-muted transition-colors hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-foreground-muted">Loai phieu</span>
            <select
              value={form.type}
              onChange={(event) =>
                setForm((current: CreateFinanceTransactionInput) => ({ ...current, type: event.target.value as 'INCOME' | 'EXPENSE' }))
              }
              className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
            >
              <option value="INCOME">Phieu thu</option>
              <option value="EXPENSE">Phieu chi</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm text-foreground-muted">So tien</span>
            <input
              type="number"
              min={0}
              value={form.amount || ''}
              onChange={(event) => setForm((current: CreateFinanceTransactionInput) => ({ ...current, amount: Number(event.target.value) }))}
              className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-foreground-muted">Hinh thuc thanh toan</span>
            <select
              value={form.paymentMethod ?? ''}
              onChange={(event) => setForm((current: CreateFinanceTransactionInput) => ({ ...current, paymentMethod: event.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
            >
              <option value="CASH">Tien mat</option>
              <option value="BANK">Chuyen khoan</option>
              <option value="MOMO">MoMo</option>
              <option value="CARD">The</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm text-foreground-muted">Chi nhanh</span>
            <select
              value={form.branchId ?? ''}
              onChange={(event) =>
                setForm((current: CreateFinanceTransactionInput) => ({ ...current, branchId: event.target.value || undefined }))
              }
              className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
            >
              <option value="">Tat ca he thong</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block space-y-2">
          <span className="text-sm text-foreground-muted">Mo ta</span>
          <input
            value={form.description}
            onChange={(event) => setForm((current: CreateFinanceTransactionInput) => ({ ...current, description: event.target.value }))}
            className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
            placeholder="Vi du: Thu bo sung, chi nha cung cap, hoan tien..."
          />
        </label>

        <div ref={customerPanelRef} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-foreground-muted">Nguoi nop/nhan</span>
            <input
              value={form.payerName ?? ''}
              onChange={(event) => {
                const value = event.target.value
                setForm((current: CreateFinanceTransactionInput) => ({ ...current, payerName: value, payerId: undefined }))
                setCustomerSearch(value)
              }}
              className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
              placeholder="Nhap ten khach hang hoac doi tac"
            />
            {deferredCustomerSearch.trim().length >= 2 && customers.length > 0 ? (
              <div className="rounded-2xl border border-border bg-background-secondary p-2">
                {customers.map((customer: Customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => {
                      setForm((current: CreateFinanceTransactionInput) => ({
                        ...current,
                        payerName: customer.fullName,
                        payerId: customer.id,
                      }))
                      setCustomerSearch('')
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-background-tertiary"
                  >
                    <span>{customer.fullName}</span>
                    <span className="text-xs text-foreground-muted">{customer.phone}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm text-foreground-muted">Ghi chu</span>
            <input
              value={form.notes ?? ''}
              onChange={(event) => setForm((current: CreateFinanceTransactionInput) => ({ ...current, notes: event.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none focus:border-primary-500"
              placeholder="Ghi chu noi bo"
            />
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
          >
            Dong
          </button>
          <button
            type="button"
            disabled={!canSubmit || saveTransaction.isPending}
            onClick={() => saveTransaction.mutate()}
            className="inline-flex h-11 items-center rounded-xl bg-primary-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveTransaction.isPending ? 'Dang luu...' : isEditing ? 'Luu cap nhat' : 'Luu giao dich'}
          </button>
        </div>
      </div>
    </div>
  )
}
