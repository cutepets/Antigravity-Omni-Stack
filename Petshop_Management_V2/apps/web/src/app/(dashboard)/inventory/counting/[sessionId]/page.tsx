import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { stockCountApi } from '@/lib/api/stock-count.api'

export const metadata: Metadata = {
  title: 'Chi tiết phiếu kiểm kho | Petshop',
  description: 'Xem chi tiết các ca kiểm kho trong tuần',
}

export default async function SessionDetailPage({ params }: { params: { sessionId: string } }) {
  // Server-side fetch
  let session: any = null
  try {
    const res = await stockCountApi.getSession(params.sessionId)
    session = (res as any)?.data ?? null
  } catch {
    notFound()
  }

  if (!session) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">
          Phiếu kiểm: Tuần {session.weekNumber}/{session.year}
        </h2>
        <p className="text-sm text-foreground-muted">
          Chi nhánh: {session.branch?.name ?? '—'} · Trạng thái: {session.status}
        </p>
      </div>

      {/* Shift Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {session.shifts?.map((shift: any) => (
          <ShiftCard key={shift.id} shift={shift} />
        ))}
      </div>
    </div>
  )
}

function ShiftCard({ shift }: { shift: any }) {
  const shiftLabel = shift.shift?.replace('_', ' | Ca ') ?? ''
  const statusColors: Record<string, string> = {
    DRAFT: 'border-blue-300 bg-blue-50',
    SUBMITTED: 'border-amber-300 bg-amber-50',
    APPROVED: 'border-emerald-300 bg-emerald-50',
    REJECTED: 'border-red-300 bg-red-50',
  }

  return (
    <div
      className={`rounded-xl border p-3 text-center transition-colors hover:shadow-md ${statusColors[shift.status] ?? 'border-border bg-card'}`}
    >
      <div className="text-xs font-semibold text-foreground">
        {shiftLabel}
      </div>
      <div className="mt-1 text-xs text-foreground-muted">
        {shift.countedItems}/{shift.totalItems} sản phẩm
      </div>
      <div className="mt-2 text-[10px] uppercase font-bold text-foreground-muted">
        {shift.status}
      </div>
    </div>
  )
}
