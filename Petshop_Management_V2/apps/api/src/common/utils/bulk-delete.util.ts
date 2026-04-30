import { BadRequestException, HttpException } from '@nestjs/common'

export interface BulkDeleteResult {
  success: true
  deletedIds: string[]
  blocked: Array<{ id: string; reason: string }>
}

const MAX_BULK_DELETE_IDS = 100
const MAX_BULK_UPDATE_IDS = 100

export function normalizeBulkDeleteIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) {
    throw new BadRequestException('ids phai la mang')
  }

  const normalized = [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))]

  if (normalized.length === 0) {
    throw new BadRequestException('Vui long chon it nhat mot ban ghi')
  }

  if (normalized.length > MAX_BULK_DELETE_IDS) {
    throw new BadRequestException(`Chi duoc xoa toi da ${MAX_BULK_DELETE_IDS} ban ghi moi lan`)
  }

  return normalized
}

export async function runBulkDelete(
  ids: string[],
  deleteOne: (id: string) => Promise<unknown>,
): Promise<BulkDeleteResult> {
  const deletedIds: string[] = []
  const blocked: BulkDeleteResult['blocked'] = []

  for (const id of ids) {
    try {
      await deleteOne(id)
      deletedIds.push(id)
    } catch (error: any) {
      const reason = error instanceof HttpException
        ? String(error.getResponse() && typeof error.getResponse() === 'object'
          ? (error.getResponse() as any).message ?? error.message
          : error.message)
        : error?.message || 'Khong the xoa ban ghi'
      blocked.push({ id, reason })
    }
  }

  return { success: true, deletedIds, blocked }
}

export function normalizeBulkUpdateIds(ids: unknown): string[] {
  const normalized = normalizeBulkDeleteIds(ids)

  if (normalized.length > MAX_BULK_UPDATE_IDS) {
    throw new BadRequestException(`Chi duoc cap nhat toi da ${MAX_BULK_UPDATE_IDS} ban ghi moi lan`)
  }

  return normalized
}

export function sanitizeBulkUpdatePayload<T extends Record<string, unknown>>(
  updates: unknown,
  allowedKeys: readonly string[],
): Partial<T> {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new BadRequestException('updates phai la object')
  }

  const payload: Record<string, unknown> = {}
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      payload[key] = (updates as Record<string, unknown>)[key]
    }
  }

  if (Object.keys(payload).length === 0) {
    throw new BadRequestException('Vui long chon it nhat mot truong can cap nhat')
  }

  return payload as Partial<T>
}
