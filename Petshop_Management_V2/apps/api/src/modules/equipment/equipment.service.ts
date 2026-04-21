import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { JwtPayload } from '@petshop/shared'
import { DatabaseService } from '../../database/database.service.js'
import {
  assertBranchAccess,
  getScopedBranchIds,
  resolveWritableBranchId,
  type BranchScopedUser,
} from '../../common/utils/branch-scope.util.js'
import { getNextSequentialCode } from '../../common/utils/sequential-code.util.js'

export type EquipmentStatus = 'IN_USE' | 'STANDBY' | 'MAINTENANCE' | 'BROKEN' | 'LIQUIDATED'

export interface FindEquipmentDto {
  search?: string
  status?: EquipmentStatus
  categoryId?: string
  branchId?: string
  locationPresetId?: string
  warrantyWindowDays?: number
  includeArchived?: boolean
  page?: number
  limit?: number
}

export interface ResolveEquipmentScanDto {
  code: string
}

export interface CreateEquipmentDto {
  code?: string
  name: string
  model?: string
  categoryId?: string | null
  status?: EquipmentStatus
  imageUrl?: string | null
  serialNumber?: string | null
  purchaseDate?: string | Date | null
  inServiceDate?: string | Date | null
  warrantyUntil?: string | Date | null
  purchaseValue?: number | null
  branchId?: string | null
  locationPresetId?: string | null
  holderName?: string | null
  note?: string | null
}

export interface UpdateEquipmentDto extends Omit<Partial<CreateEquipmentDto>, 'code'> {}

export interface CreateEquipmentCategoryDto {
  name: string
  description?: string | null
  sortOrder?: number
  isActive?: boolean
}

export interface UpdateEquipmentCategoryDto extends Partial<CreateEquipmentCategoryDto> {}

export interface CreateEquipmentLocationPresetDto {
  branchId?: string | null
  name: string
  description?: string | null
  sortOrder?: number
  isActive?: boolean
}

export interface UpdateEquipmentLocationPresetDto extends Partial<CreateEquipmentLocationPresetDto> {}

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>

const EQUIPMENT_CODE_RE = /^TB\d{4,6}$/
const DEFAULT_WARRANTY_WINDOW_DAYS = 30

@Injectable()
export class EquipmentService {
  constructor(private readonly db: DatabaseService) {}

  private normalizeCode(code: string) {
    return String(code ?? '').trim().toUpperCase()
  }

  private ensureValidCode(code: string) {
    if (!EQUIPMENT_CODE_RE.test(code)) {
      throw new BadRequestException('Ma thiet bi khong hop le')
    }
  }

  private toDate(value?: string | Date | null) {
    if (value === undefined) return undefined
    if (value === null) return null
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Gia tri ngay khong hop le')
    }
    return date
  }

  private async ensureCategory(categoryId?: string | null) {
    if (!categoryId) return null
    const category = await this.db.equipmentCategory.findUnique({
      where: { id: categoryId },
    } as any)

    if (!category || category.isActive === false) {
      throw new BadRequestException('Loai thiet bi khong hop le')
    }

    return category
  }

  private async ensureLocationPreset(locationPresetId?: string | null) {
    if (!locationPresetId) return null
    const locationPreset = await this.db.equipmentLocationPreset.findUnique({
      where: { id: locationPresetId },
    } as any)

    if (!locationPreset || locationPreset.isActive === false) {
      throw new BadRequestException('Vi tri thiet bi khong hop le')
    }

    return locationPreset
  }

  private buildHistoryDiff(before: Record<string, unknown> | null, after: Record<string, unknown>) {
    if (!before) {
      return { before: null, after }
    }

    const changedEntries = Object.entries(after).reduce<Record<string, { before: unknown; after: unknown }>>((acc, [key, value]) => {
      const previousValue = before[key]
      const previousComparable = previousValue instanceof Date ? previousValue.toISOString() : previousValue
      const nextComparable = value instanceof Date ? value.toISOString() : value
      if (previousComparable !== nextComparable) {
        acc[key] = { before: previousComparable, after: nextComparable }
      }
      return acc
    }, {})

    return { changed: changedEntries }
  }

  private buildHistorySummary(action: string, equipment: { code: string; name?: string | null }) {
    if (action === 'CREATED') return `Tao thiet bi ${equipment.code}`
    if (action === 'ARCHIVED') return `Luu tru thiet bi ${equipment.code}`
    return `Cap nhat thiet bi ${equipment.code}`
  }

  private buildEquipmentWhere(query: FindEquipmentDto, user?: AccessUser) {
    const where: Record<string, unknown> = {}
    const scopedBranchIds = getScopedBranchIds(user as BranchScopedUser | undefined, query.branchId ?? null)

    if (!query.includeArchived) {
      where['archivedAt'] = null
    }
    if (scopedBranchIds) {
      where['branchId'] = scopedBranchIds.length === 1 ? scopedBranchIds[0] : { in: scopedBranchIds }
    }
    if (query.status) where['status'] = query.status
    if (query.categoryId) where['categoryId'] = query.categoryId
    if (query.locationPresetId) where['locationPresetId'] = query.locationPresetId

    if (query.search?.trim()) {
      const search = query.search.trim()
      where['OR'] = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { holderName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const warrantyWindowDays = Number(query.warrantyWindowDays ?? DEFAULT_WARRANTY_WINDOW_DAYS)
    if (!Number.isNaN(warrantyWindowDays) && warrantyWindowDays > 0) {
      const today = new Date()
      const until = new Date()
      until.setDate(until.getDate() + warrantyWindowDays)
      if (query.warrantyWindowDays !== undefined) {
        where['warrantyUntil'] = { gte: today, lte: until }
      }
    }

    return where
  }

  private equipmentInclude() {
    return {
      branch: { select: { id: true, code: true, name: true } },
      category: { select: { id: true, name: true, description: true } },
      locationPreset: { select: { id: true, name: true, branchId: true } },
      createdBy: { select: { id: true, fullName: true, staffCode: true } },
      updatedBy: { select: { id: true, fullName: true, staffCode: true } },
    }
  }

  async suggestNextCode() {
    const code = await getNextSequentialCode(this.db, {
      table: 'equipments',
      column: 'code',
      prefix: 'TB',
      padLength: 4,
    })

    return { success: true, data: { code } }
  }

  async resolveScan(dto: ResolveEquipmentScanDto, user?: AccessUser) {
    const code = this.normalizeCode(dto.code)
    this.ensureValidCode(code)

    const equipment = await this.db.equipment.findFirst({
      where: {
        code,
      },
    } as any)

    if (!equipment) {
      return {
        success: true,
        data: {
          found: false,
          draft: {
            code,
          },
        },
      }
    }

    assertBranchAccess(equipment.branchId, user as BranchScopedUser | undefined)

    return {
      success: true,
      data: {
        found: true,
        equipment,
      },
    }
  }

  async findAll(query: FindEquipmentDto, user?: AccessUser) {
    const page = Math.max(1, Number(query.page ?? 1))
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)))
    const skip = (page - 1) * limit
    const where = this.buildEquipmentWhere(query, user)

    const [items, total] = await Promise.all([
      this.db.equipment.findMany({
        where,
        include: this.equipmentInclude(),
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      } as any),
      this.db.equipment.count({ where } as any),
    ])

    return {
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async findByCode(code: string, user?: AccessUser) {
    const normalizedCode = this.normalizeCode(code)
    this.ensureValidCode(normalizedCode)

    const equipment = await this.db.equipment.findFirst({
      where: { code: normalizedCode },
      include: {
        ...this.equipmentInclude(),
        history: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            actor: {
              select: {
                id: true,
                fullName: true,
                staffCode: true,
              },
            },
          },
        },
      },
    } as any)

    if (!equipment) {
      throw new NotFoundException('Khong tim thay thiet bi')
    }

    assertBranchAccess(equipment.branchId, user as BranchScopedUser | undefined)

    return { success: true, data: equipment }
  }

  async getHistory(id: string, user?: AccessUser) {
    const equipment = await this.db.equipment.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    } as any)

    if (!equipment) {
      throw new NotFoundException('Khong tim thay thiet bi')
    }

    assertBranchAccess(equipment.branchId, user as BranchScopedUser | undefined)

    const history = await this.db.equipmentHistory.findMany({
      where: { equipmentId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
            staffCode: true,
          },
        },
      },
    } as any)

    return { success: true, data: history }
  }

  async createEquipment(dto: CreateEquipmentDto, user?: AccessUser) {
    const branchId = resolveWritableBranchId(user as BranchScopedUser | undefined, dto.branchId ?? null)
    if (!branchId) {
      throw new BadRequestException('Chi nhanh la bat buoc')
    }
    const code = this.normalizeCode(dto.code || (await this.suggestNextCode()).data.code)
    this.ensureValidCode(code)

    const [existing, category, locationPreset] = await Promise.all([
      this.db.equipment.findFirst({ where: { code } } as any),
      this.ensureCategory(dto.categoryId ?? null),
      this.ensureLocationPreset(dto.locationPresetId ?? null),
    ])

    if (existing) {
      throw new ConflictException('Ma thiet bi da ton tai')
    }
    if (locationPreset && locationPreset.branchId !== branchId) {
      throw new BadRequestException('Vi tri phai thuoc cung chi nhanh voi thiet bi')
    }

    const createData = {
      code,
      name: dto.name?.trim(),
      model: dto.model?.trim() || null,
      categoryId: category?.id ?? null,
      status: dto.status ?? 'IN_USE',
      imageUrl: dto.imageUrl?.trim() || null,
      serialNumber: dto.serialNumber?.trim() || null,
      purchaseDate: this.toDate(dto.purchaseDate),
      inServiceDate: this.toDate(dto.inServiceDate),
      warrantyUntil: this.toDate(dto.warrantyUntil),
      purchaseValue: dto.purchaseValue ?? null,
      branchId,
      locationPresetId: locationPreset?.id ?? null,
      holderName: dto.holderName?.trim() || null,
      note: dto.note?.trim() || null,
      createdById: user?.userId ?? null,
      updatedById: user?.userId ?? null,
    }

    const equipment = await this.db.$transaction(async (tx: any) => {
      const created = await tx.equipment.create({
        data: createData,
        include: this.equipmentInclude(),
      })

      await tx.equipmentHistory.create({
        data: {
          equipmentId: created.id,
          action: 'CREATED',
          summary: this.buildHistorySummary('CREATED', created),
          diffJson: this.buildHistoryDiff(null, createData as Record<string, unknown>),
          actorId: user?.userId ?? null,
        },
      })

      await tx.activityLog.create({
        data: {
          userId: user?.userId ?? null,
          action: 'EQUIPMENT_CREATED',
          target: 'EQUIPMENT',
          targetId: created.id,
          details: {
            code: created.code,
            name: created.name,
            branchId: created.branchId,
          },
        },
      })

      return created
    })

    return { success: true, data: equipment }
  }

  async updateEquipment(id: string, dto: UpdateEquipmentDto, user?: AccessUser) {
    const existing = await this.db.equipment.findUnique({
      where: { id },
    } as any)

    if (!existing) {
      throw new NotFoundException('Khong tim thay thiet bi')
    }
    assertBranchAccess(existing.branchId, user as BranchScopedUser | undefined)

    const branchId =
      dto.branchId !== undefined
        ? resolveWritableBranchId(user as BranchScopedUser | undefined, dto.branchId ?? null)
        : existing.branchId
    if (!branchId) {
      throw new BadRequestException('Chi nhanh la bat buoc')
    }

    const [category, locationPreset] = await Promise.all([
      dto.categoryId !== undefined ? this.ensureCategory(dto.categoryId ?? null) : existing.categoryId ? { id: existing.categoryId } : null,
      dto.locationPresetId !== undefined ? this.ensureLocationPreset(dto.locationPresetId ?? null) : existing.locationPresetId ? { id: existing.locationPresetId, branchId } : null,
    ])

    if (locationPreset && locationPreset.branchId !== branchId) {
      throw new BadRequestException('Vi tri phai thuoc cung chi nhanh voi thiet bi')
    }

    const updateData = {
      name: dto.name?.trim() ?? existing.name,
      model: dto.model !== undefined ? dto.model?.trim() || null : existing.model,
      categoryId: dto.categoryId !== undefined ? category?.id ?? null : existing.categoryId,
      status: dto.status ?? existing.status,
      imageUrl: dto.imageUrl !== undefined ? dto.imageUrl?.trim() || null : existing.imageUrl,
      serialNumber: dto.serialNumber !== undefined ? dto.serialNumber?.trim() || null : existing.serialNumber,
      purchaseDate: dto.purchaseDate !== undefined ? this.toDate(dto.purchaseDate) : existing.purchaseDate,
      inServiceDate: dto.inServiceDate !== undefined ? this.toDate(dto.inServiceDate) : existing.inServiceDate,
      warrantyUntil: dto.warrantyUntil !== undefined ? this.toDate(dto.warrantyUntil) : existing.warrantyUntil,
      purchaseValue: dto.purchaseValue !== undefined ? dto.purchaseValue ?? null : existing.purchaseValue,
      branchId,
      locationPresetId: dto.locationPresetId !== undefined ? locationPreset?.id ?? null : existing.locationPresetId,
      holderName: dto.holderName !== undefined ? dto.holderName?.trim() || null : existing.holderName,
      note: dto.note !== undefined ? dto.note?.trim() || null : existing.note,
      updatedById: user?.userId ?? null,
    }

    const equipment = await this.db.$transaction(async (tx: any) => {
      const updated = await tx.equipment.update({
        where: { id },
        data: updateData,
        include: this.equipmentInclude(),
      })

      await tx.equipmentHistory.create({
        data: {
          equipmentId: updated.id,
          action: 'UPDATED',
          summary: this.buildHistorySummary('UPDATED', updated),
          diffJson: this.buildHistoryDiff(existing, updateData as Record<string, unknown>),
          actorId: user?.userId ?? null,
        },
      })

      await tx.activityLog.create({
        data: {
          userId: user?.userId ?? null,
          action: 'EQUIPMENT_UPDATED',
          target: 'EQUIPMENT',
          targetId: updated.id,
          details: {
            code: updated.code,
            name: updated.name,
          },
        },
      })

      return updated
    })

    return { success: true, data: equipment }
  }

  async archiveEquipment(id: string, user?: AccessUser) {
    const existing = await this.db.equipment.findUnique({
      where: { id },
    } as any)

    if (!existing) {
      throw new NotFoundException('Khong tim thay thiet bi')
    }
    assertBranchAccess(existing.branchId, user as BranchScopedUser | undefined)

    const equipment = await this.db.$transaction(async (tx: any) => {
      const archived = await tx.equipment.update({
        where: { id },
        data: {
          archivedAt: new Date(),
          updatedById: user?.userId ?? null,
        },
        include: this.equipmentInclude(),
      })

      await tx.equipmentHistory.create({
        data: {
          equipmentId: archived.id,
          action: 'ARCHIVED',
          summary: this.buildHistorySummary('ARCHIVED', archived),
          diffJson: {
            changed: {
              archivedAt: {
                before: existing.archivedAt,
                after: archived.archivedAt,
              },
            },
          },
          actorId: user?.userId ?? null,
        },
      })

      await tx.activityLog.create({
        data: {
          userId: user?.userId ?? null,
          action: 'EQUIPMENT_ARCHIVED',
          target: 'EQUIPMENT',
          targetId: archived.id,
          details: {
            code: archived.code,
            name: archived.name,
          },
        },
      })

      return archived
    })

    return { success: true, data: equipment }
  }

  async getCategories() {
    const items = await this.db.equipmentCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    } as any)
    return { success: true, data: items }
  }

  async createCategory(dto: CreateEquipmentCategoryDto) {
    const item = await this.db.equipmentCategory.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    } as any)
    return { success: true, data: item }
  }

  async updateCategory(id: string, dto: UpdateEquipmentCategoryDto) {
    const item = await this.db.equipmentCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    } as any)
    return { success: true, data: item }
  }

  async getLocations(branchId: string | undefined, user?: AccessUser) {
    const scopedBranchIds = getScopedBranchIds(user as BranchScopedUser | undefined, branchId ?? null)
    const items = await this.db.equipmentLocationPreset.findMany({
      where: scopedBranchIds
        ? {
            branchId: scopedBranchIds.length === 1 ? scopedBranchIds[0] : { in: scopedBranchIds },
          }
        : undefined,
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: [{ branchId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    } as any)
    return { success: true, data: items }
  }

  async createLocation(dto: CreateEquipmentLocationPresetDto, user?: AccessUser) {
    const branchId = resolveWritableBranchId(user as BranchScopedUser | undefined, dto.branchId ?? null)
    if (!branchId) {
      throw new BadRequestException('Chi nhanh la bat buoc')
    }
    const item = await this.db.equipmentLocationPreset.create({
      data: {
        branchId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    } as any)
    return { success: true, data: item }
  }

  async updateLocation(id: string, dto: UpdateEquipmentLocationPresetDto, user?: AccessUser) {
    const existing = await this.db.equipmentLocationPreset.findUnique({
      where: { id },
    } as any)

    if (!existing) {
      throw new NotFoundException('Khong tim thay vi tri thiet bi')
    }
    assertBranchAccess(existing.branchId, user as BranchScopedUser | undefined)

    const branchId =
      dto.branchId !== undefined
        ? resolveWritableBranchId(user as BranchScopedUser | undefined, dto.branchId ?? null)
        : existing.branchId
    if (!branchId) {
      throw new BadRequestException('Chi nhanh la bat buoc')
    }

    const item = await this.db.equipmentLocationPreset.update({
      where: { id },
      data: {
        branchId,
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    } as any)
    return { success: true, data: item }
  }
}
