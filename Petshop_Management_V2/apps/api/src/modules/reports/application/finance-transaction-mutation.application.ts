import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { assertBranchAccess, resolveWritableBranchId, type BranchScopedUser } from '../../../common/utils/branch-scope.util.js'

type FinanceTransactionType = 'INCOME' | 'EXPENSE'
type ManualReferenceType = 'MANUAL' | 'ORDER' | 'STOCK_RECEIPT'
type TransactionEditScope = 'FULL' | 'NOTES_ONLY'

type TransactionCapability = {
  editScope: TransactionEditScope
  canDelete: boolean
  lockReason: string | null
}

type CreateTransactionInput = {
  type: FinanceTransactionType
  amount: number
  description: string
  category?: string
  paymentMethod?: string
  paymentAccountId?: string
  paymentAccountLabel?: string
  branchId?: string
  branchName?: string
  payerName?: string
  payerId?: string
  refType?: ManualReferenceType
  refId?: string
  refNumber?: string
  notes?: string
  tags?: string
  date?: string
  attachmentUrl?: string
}

type UpdateTransactionInput = Partial<CreateTransactionInput>

type FinanceMutationDeps = {
  buildVoucherNumber: (type: FinanceTransactionType, issuedAt: Date) => Promise<string>
  getTransactionCapability: (tx: { isManual?: boolean | null; source?: string | null; createdAt?: Date | string | null }) => TransactionCapability
  normalizeTransaction: (tx: any) => any
}

const MANUAL_REFERENCE_TYPES = ['MANUAL', 'ORDER', 'STOCK_RECEIPT'] as const
const NOTE_ONLY_FIELDS = ['notes'] as const

function normalizeManualReferenceType(refType?: string | null): ManualReferenceType {
  const normalized = (refType ?? 'MANUAL').trim().toUpperCase()
  if ((MANUAL_REFERENCE_TYPES as readonly string[]).includes(normalized)) {
    return normalized as ManualReferenceType
  }

  throw new BadRequestException('refType khong hop le')
}

async function resolveManualReference(
  db: any,
  params: {
    refType?: string | null | undefined
    refId?: string | null | undefined
    refNumber?: string | null | undefined
    user?: BranchScopedUser | undefined
  },
) {
  const refType = normalizeManualReferenceType(params.refType)
  const rawRefId = params.refId?.trim() || null
  const rawRefNumber = params.refNumber?.trim() || null

  if (refType === 'MANUAL') {
    return { refType: 'MANUAL' as const, refId: null, refNumber: null }
  }

  if (!rawRefId && !rawRefNumber) {
    throw new BadRequestException(
      refType === 'ORDER' ? 'Vui long nhap ma don hang de lien ket' : 'Vui long nhap ma phieu nhap de lien ket',
    )
  }

  if (refType === 'ORDER') {
    const orderWhere: Array<{ id: string } | { orderNumber: string }> = []
    if (rawRefId) orderWhere.push({ id: rawRefId })
    if (rawRefNumber) orderWhere.push({ orderNumber: rawRefNumber })
    const order = await db.order.findFirst({
      where: { OR: orderWhere },
      select: { id: true, orderNumber: true, branchId: true },
    })

    if (!order) {
      throw new NotFoundException('Khong tim thay don hang de lien ket')
    }

    assertBranchAccess(order.branchId, params.user)
    return { refType: 'ORDER' as const, refId: order.id, refNumber: order.orderNumber }
  }

  const receiptWhere: Array<{ id: string } | { receiptNumber: string }> = []
  if (rawRefId) receiptWhere.push({ id: rawRefId })
  if (rawRefNumber) receiptWhere.push({ receiptNumber: rawRefNumber })
  const receipt = await db.stockReceipt.findFirst({
    where: { OR: receiptWhere },
    select: { id: true, receiptNumber: true, branchId: true },
  })

  if (!receipt) {
    throw new NotFoundException('Khong tim thay phieu nhap de lien ket')
  }

  assertBranchAccess(receipt.branchId, params.user)
  return { refType: 'STOCK_RECEIPT' as const, refId: receipt.id, refNumber: receipt.receiptNumber }
}

async function resolvePaymentAccount(db: any, paymentMethod?: string | null, paymentAccountId?: string | null) {
  const normalizedMethod = paymentMethod?.trim().toUpperCase() || null
  const normalizedAccountId = paymentAccountId?.trim() || null

  if (!normalizedAccountId) {
    return {
      paymentMethod: normalizedMethod,
      paymentAccountId: null,
      paymentAccountLabel: null,
    }
  }

  const account = await db.paymentMethod.findUnique({
    where: { id: normalizedAccountId },
    select: {
      id: true,
      name: true,
      type: true,
      isActive: true,
      bankName: true,
      accountNumber: true,
    },
  })

  if (!account || account.isActive !== true) {
    throw new BadRequestException('Phuong thuc thanh toan khong hop le hoac da ngung hoat dong')
  }

  const paymentAccountLabel =
    account.type === 'BANK' && (account.bankName || account.accountNumber)
      ? [account.name, account.bankName, account.accountNumber].filter(Boolean).join(' • ')
      : account.name

  return {
    paymentMethod: account.type as string,
    paymentAccountId: account.id as string,
    paymentAccountLabel,
  }
}

export async function createManualFinanceTransaction(
  db: any,
  deps: Pick<FinanceMutationDeps, 'buildVoucherNumber' | 'normalizeTransaction'>,
  dto: CreateTransactionInput,
  staffId: string,
  user?: BranchScopedUser,
  requestedBranchId?: string,
) {
  if (!dto.type) throw new BadRequestException('Thieu loai giao dich')
  if (!dto.description?.trim()) throw new BadRequestException('Mo ta giao dich la bat buoc')
  if (!Number.isFinite(Number(dto.amount)) || Number(dto.amount) <= 0) {
    throw new BadRequestException('So tien phai lon hon 0')
  }
  if (dto.refType && !(MANUAL_REFERENCE_TYPES as readonly string[]).includes(dto.refType)) {
    throw new BadRequestException('Phieu tao thu cong chi ho tro refType MANUAL')
  }

  const txDate = dto.date ? new Date(dto.date) : new Date()
  if (Number.isNaN(txDate.getTime())) {
    throw new BadRequestException('Ngay giao dich khong hop le')
  }

  const manualReference = await resolveManualReference(db, {
    refType: dto.refType,
    refId: dto.refId,
    refNumber: dto.refNumber,
    user,
  })
  const paymentAccount = await resolvePaymentAccount(db, dto.paymentMethod, dto.paymentAccountId)
  const writableBranchId = resolveWritableBranchId(user, dto.branchId ?? requestedBranchId)
  const branch = writableBranchId
    ? await db.branch.findUnique({
        where: { id: writableBranchId },
        select: { id: true, name: true },
      })
    : null

  if (writableBranchId && !branch) {
    throw new NotFoundException('Khong tim thay chi nhanh')
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const voucherNumber = await deps.buildVoucherNumber(dto.type, txDate)
    try {
      const tx = await db.transaction.create({
        data: {
          voucherNumber,
          type: dto.type,
          amount: Number(dto.amount),
          description: dto.description.trim(),
          category: dto.category?.trim() || null,
          paymentMethod: paymentAccount.paymentMethod ?? null,
          paymentAccountId: paymentAccount.paymentAccountId,
          paymentAccountLabel: paymentAccount.paymentAccountLabel,
          branchId: branch?.id ?? null,
          branchName: dto.branchName?.trim() || branch?.name || null,
          payerName: dto.payerName?.trim() || null,
          payerId: dto.payerId?.trim() || null,
          refType: manualReference.refType,
          refId: manualReference.refId,
          refNumber: manualReference.refNumber,
          notes: dto.notes?.trim() || null,
          tags: dto.tags?.trim() || null,
          attachmentUrl: dto.attachmentUrl?.trim() || null,
          source: 'MANUAL',
          isManual: true,
          staffId,
          date: txDate,
        } as any,
        include: {
          staff: { select: { id: true, fullName: true } },
          branch: { select: { id: true, name: true } },
        },
      })

      return { success: true, data: deps.normalizeTransaction(tx) }
    } catch (error: any) {
      if (error?.code !== 'P2002') {
        throw error
      }
    }
  }

  throw new Error('Khong the tao so chung tu duy nhat, vui long thu lai')
}

export async function updateFinanceTransaction(
  db: any,
  deps: Pick<FinanceMutationDeps, 'getTransactionCapability' | 'normalizeTransaction'>,
  id: string,
  dto: UpdateTransactionInput,
  user?: BranchScopedUser,
  requestedBranchId?: string,
) {
  const existing = await db.transaction.findUnique({ where: { id } as any })
  if (!existing) {
    throw new NotFoundException('Khong tim thay phieu thu/chi')
  }

  assertBranchAccess(existing.branchId, user)
  const capability = deps.getTransactionCapability(existing)
  const changedKeys = Object.entries(dto)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key)
  const hasRestrictedChange =
    capability.editScope !== 'FULL' &&
    changedKeys.some((key) => !(NOTE_ONLY_FIELDS as readonly string[]).includes(key))

  if (hasRestrictedChange) {
    throw new ForbiddenException(capability.lockReason ?? 'Phieu nay chi duoc cap nhat ghi chu')
  }

  if (dto.amount !== undefined && (!Number.isFinite(Number(dto.amount)) || Number(dto.amount) <= 0)) {
    throw new BadRequestException('So tien phai lon hon 0')
  }

  let txDate: Date | undefined
  if (dto.date !== undefined) {
    txDate = new Date(dto.date)
    if (Number.isNaN(txDate.getTime())) {
      throw new BadRequestException('Ngay giao dich khong hop le')
    }
  }

  const allowCoreEdit = capability.editScope === 'FULL'
  const writableBranchId =
    allowCoreEdit && (dto.branchId !== undefined || requestedBranchId)
      ? resolveWritableBranchId(user, dto.branchId ?? requestedBranchId)
      : null
  const shouldUpdateManualReference =
    allowCoreEdit && (dto.refType !== undefined || dto.refId !== undefined || dto.refNumber !== undefined)

  const branch = writableBranchId
    ? await db.branch.findUnique({
        where: { id: writableBranchId },
        select: { id: true, name: true },
      })
    : null

  if (writableBranchId && !branch) {
    throw new NotFoundException('Khong tim thay chi nhanh')
  }

  const manualReference = shouldUpdateManualReference
    ? await resolveManualReference(db, {
        refType: dto.refType ?? existing.refType ?? 'MANUAL',
        refId: dto.refId,
        refNumber: dto.refNumber,
        user,
      })
    : null
  const shouldUpdatePaymentAccount =
    allowCoreEdit && (dto.paymentMethod !== undefined || dto.paymentAccountId !== undefined || dto.paymentAccountLabel !== undefined)
  const paymentAccount = shouldUpdatePaymentAccount
    ? await resolvePaymentAccount(db, dto.paymentMethod ?? existing.paymentMethod, dto.paymentAccountId)
    : null

  const updated = await db.transaction.update({
    where: { id } as any,
    data: {
      ...(allowCoreEdit && dto.amount !== undefined ? { amount: Number(dto.amount) } : {}),
      ...(allowCoreEdit && dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(allowCoreEdit && dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
      ...(paymentAccount
        ? {
            paymentMethod: paymentAccount.paymentMethod ?? null,
            paymentAccountId: paymentAccount.paymentAccountId,
            paymentAccountLabel: paymentAccount.paymentAccountLabel,
          }
        : {}),
      ...(allowCoreEdit && (dto.branchId !== undefined || requestedBranchId) ? { branchId: branch?.id ?? null } : {}),
      ...(allowCoreEdit && (dto.branchId !== undefined || dto.branchName !== undefined || requestedBranchId)
        ? { branchName: dto.branchName?.trim() || branch?.name || null }
        : {}),
      ...(allowCoreEdit && dto.payerName !== undefined ? { payerName: dto.payerName?.trim() || null } : {}),
      ...(allowCoreEdit && dto.payerId !== undefined ? { payerId: dto.payerId?.trim() || null } : {}),
      ...(manualReference
        ? {
            refType: manualReference.refType,
            refId: manualReference.refId,
            refNumber: manualReference.refNumber,
          }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      ...(allowCoreEdit && dto.tags !== undefined ? { tags: dto.tags?.trim() || null } : {}),
      ...(allowCoreEdit && dto.attachmentUrl !== undefined ? { attachmentUrl: dto.attachmentUrl?.trim() || null } : {}),
      ...(allowCoreEdit && txDate ? { date: txDate } : {}),
    } as any,
    include: {
      staff: { select: { id: true, fullName: true } },
      branch: { select: { id: true, name: true } },
    },
  })

  return { success: true, data: deps.normalizeTransaction(updated) }
}

export async function removeFinanceTransaction(
  db: any,
  deps: Pick<FinanceMutationDeps, 'getTransactionCapability'>,
  id: string,
  user?: BranchScopedUser,
) {
  const existing = await db.transaction.findUnique({ where: { id } as any })
  if (!existing) {
    throw new NotFoundException('Khong tim thay phieu thu/chi')
  }

  assertBranchAccess(existing.branchId, user)
  const capability = deps.getTransactionCapability(existing)
  if (!capability.canDelete) {
    throw new ForbiddenException(capability.lockReason ?? 'Phieu nay khong the xoa')
  }
  await db.transaction.delete({ where: { id } as any })
  return { success: true, message: 'Da xoa phieu thu/chi thu cong' }
}
