import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { generateGroomingSessionCode as formatGroomingSessionCode } from '@petshop/shared'
import { assertBranchAccess, getScopedBranchIds, resolveWritableBranchId, type BranchScopedUser } from '../../common/utils/branch-scope.util.js'
import { resolveBranchIdentity } from '../../common/utils/branch-identity.util.js'
import { DatabaseService } from '../../database/database.service.js'
import { CalculateSpaPriceDto, CreateGroomingDto, UpdateGroomingDto } from './dto/grooming.dto.js'

@Injectable()
export class GroomingService {
  constructor(private readonly db: DatabaseService) { }

  private async generateSessionCode(date: Date, branchCode: string): Promise<string> {
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1)
    const codePrefix = formatGroomingSessionCode(date, branchCode, 0).slice(0, -3)

    const count = await this.db.groomingSession.count({
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
        sessionCode: {
          startsWith: codePrefix,
        },
      },
    })

    return formatGroomingSessionCode(date, branchCode, count + 1)
  }

  private mergeBranchScope(where: Record<string, any>, user?: BranchScopedUser, requestedBranchId?: string | null) {
    const scopedBranchIds = getScopedBranchIds(user, requestedBranchId)
    if (!scopedBranchIds) return where
    return { ...where, branchId: { in: scopedBranchIds } }
  }

  private async findAccessiblePet(petId: string, user?: BranchScopedUser) {
    const scopedBranchIds = getScopedBranchIds(user)
    const pet = await this.db.pet.findFirst({
      where: scopedBranchIds
        ? {
          id: petId,
          OR: [
            { branchId: { in: scopedBranchIds } },
            {
              AND: [
                { branchId: null },
                { customer: { is: { branchId: { in: scopedBranchIds } } } },
              ],
            },
          ],
        }
        : { id: petId },
      include: { customer: true },
    })

    if (!pet) {
      throw new BadRequestException('Khong tim thay thu cung')
    }

    return pet
  }


  private async buildSpaPricingPreview(dto: CalculateSpaPriceDto, user?: BranchScopedUser) {
    const pet = await this.findAccessiblePet(dto.petId, user)
    const species = (dto.species ?? pet.species)?.trim() || null
    const weight = Number(dto.weight ?? pet.weight)

    if (!Number.isFinite(weight)) {
      throw new BadRequestException('Thu cung can co can nang de tinh gia SPA')
    }

    const matchesSpecies = (value?: string | null) => !value || value.trim().toLowerCase() === species?.toLowerCase()
    const matchesCustomRange = (rule: { minWeight?: number | null; maxWeight?: number | null }) => {
      if (rule.minWeight === null || rule.minWeight === undefined) {
        return rule.maxWeight === null || rule.maxWeight === undefined
      }
      const maxWeight = rule.maxWeight === null || rule.maxWeight === undefined ? Number.POSITIVE_INFINITY : Number(rule.maxWeight)
      return weight >= Number(rule.minWeight) && weight < maxWeight
    }

    const bands = await this.db.serviceWeightBand.findMany({
      where: {
        serviceType: 'GROOMING',
        isActive: true,
        minWeight: { lte: weight },
        OR: [{ maxWeight: null }, { maxWeight: { gt: weight } }],
      },
      orderBy: [{ sortOrder: 'asc' }, { minWeight: 'asc' }],
    })
    const weightBand =
      bands.find((band) => band.species?.trim().toLowerCase() === species?.toLowerCase()) ??
      bands.find((band) => !band.species) ??
      null

    const weightBandedRules = weightBand
      ? await this.db.spaPriceRule.findMany({
        where: {
          packageCode: dto.packageCode,
          weightBandId: weightBand.id,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      : []

    let priceRule =
      weightBandedRules.find((rule) => matchesSpecies(rule.species)) ??
      weightBandedRules.find((rule) => !rule.species) ??
      null

    if (!priceRule) {
      const customRangeRules = await this.db.spaPriceRule.findMany({
        where: {
          packageCode: dto.packageCode,
          weightBandId: null,
          isActive: true,
        },
        orderBy: [{ minWeight: 'asc' }, { createdAt: 'desc' }],
      })

      const customWeightMatchedRules = customRangeRules.filter((rule) => matchesCustomRange(rule))
      priceRule =
        customWeightMatchedRules.find((rule) => matchesSpecies(rule.species)) ??
        customWeightMatchedRules.find((rule) => !rule.species) ??
        null
    }

    if (!priceRule) {
      if (weightBand) {
        throw new BadRequestException(`Chua cau hinh gia SPA ${dto.packageCode} cho hang can ${weightBand.label}`)
      }
      throw new BadRequestException(`Chua cau hinh gia SPA ${dto.packageCode} cho ${weight}kg`)
    }

    const effectiveWeightBand = weightBand ?? (priceRule.minWeight !== null || priceRule.maxWeight !== null
      ? {
        id: null,
        label: `${priceRule.minWeight ?? 0}-${priceRule.maxWeight ?? 'INF'}kg`,
        minWeight: priceRule.minWeight ?? 0,
        maxWeight: priceRule.maxWeight ?? null,
      }
      : null)

    const pricingSnapshot = {
      source: 'spa-price-rule',
      packageCode: dto.packageCode,
      species,
      weight,
      weightBandId: effectiveWeightBand?.id ?? null,
      weightBandLabel: effectiveWeightBand?.label ?? null,
      weightBandMin: effectiveWeightBand?.minWeight ?? null,
      weightBandMax: effectiveWeightBand?.maxWeight ?? null,
      priceRuleId: priceRule.id,
      price: priceRule.price,
      durationMinutes: priceRule.durationMinutes,
    }

    return {
      petId: pet.id,
      petName: pet.name,
      species,
      weight,
      packageCode: dto.packageCode,
      price: priceRule.price,
      durationMinutes: priceRule.durationMinutes,
      weightBand: effectiveWeightBand,
      pricingSnapshot,
    }
  }

  private normalizeExtraServices(extraServices?: Array<{ pricingRuleId?: string; sku?: string | null; name: string; price: number; quantity?: number; durationMinutes?: number | null }>) {
    return (extraServices ?? [])
      .map((service) => {
        const quantity = Number(service.quantity ?? 1)
        const price = Number(service.price ?? 0)
        return {
          pricingRuleId: service.pricingRuleId ?? null,
          sku: service.sku ?? null,
          name: service.name,
          price: Number.isFinite(price) ? price : 0,
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          durationMinutes: service.durationMinutes ?? null,
        }
      })
      .filter((service) => service.name?.trim())
  }

  private buildSessionPricingSnapshot(params: {
    baseSnapshot?: Record<string, any> | null
    mainPrice?: number | null
    extraServices?: Array<{ pricingRuleId?: string | null; sku?: string | null; name: string; price: number; quantity: number; durationMinutes?: number | null }>
  }) {
    const extraServices = params.extraServices ?? []
    const extraTotal = extraServices.reduce((sum, service) => sum + service.price * service.quantity, 0)
    const mainPrice = Number(params.mainPrice ?? 0)
    const totalPrice = mainPrice + extraTotal

    return {
      ...((params.baseSnapshot ?? {}) as Record<string, any>),
      mainPrice,
      extraServices,
      extraTotal,
      totalPrice,
    }
  }

  async calculatePrice(dto: CalculateSpaPriceDto, user?: BranchScopedUser): Promise<any> {
    const preview = await this.buildSpaPricingPreview(dto, user)
    return { success: true, data: preview }
  }

  async getPackages(species?: string): Promise<any> {
    const normalizedInput = species?.trim().toLowerCase() || null

    // Fetch all active rules — JS filter handles species case-insensitively
    const rules = await this.db.spaPriceRule.findMany({
      where: { isActive: true },
      select: { packageCode: true, species: true },
      orderBy: { packageCode: 'asc' },
    })

    // Keep rules that match the species (case-insensitive) OR have no species restriction
    const filtered = normalizedInput
      ? rules.filter(
        (r) => !r.species || r.species.trim().toLowerCase() === normalizedInput,
      )
      : rules

    // Deduplicate and return sorted packageCodes
    const seen = new Set<string>()
    const packages = filtered
      .filter((r) => {
        if (seen.has(r.packageCode)) return false
        seen.add(r.packageCode)
        return true
      })
      .map((r) => ({ code: r.packageCode, label: r.packageCode }))

    return { success: true, data: packages }
  }

  async create(dto: CreateGroomingDto, user?: BranchScopedUser, requestedBranchId?: string): Promise<any> {
    const pet = await this.findAccessiblePet(dto.petId, user)
    const writableBranchId = resolveWritableBranchId(user, dto.branchId ?? requestedBranchId)
    const branch = await resolveBranchIdentity(this.db, writableBranchId)
    const sessionDate = dto.startTime ? new Date(dto.startTime) : new Date()
    const pricingPreview = dto.packageCode
      ? await this.buildSpaPricingPreview(
        {
          petId: dto.petId,
          packageCode: dto.packageCode,
        },
        user,
      )
      : null
    const extraServices = this.normalizeExtraServices(dto.extraServices)
    const mainPrice = dto.price ?? pricingPreview?.price ?? null
    const extraTotal = extraServices.reduce((sum, service) => sum + service.price * service.quantity, 0)
    const sessionPrice = extraServices.length > 0 ? Number(mainPrice ?? 0) + extraTotal : mainPrice

    const session = await this.db.groomingSession.create({
      data: {
        sessionCode: await this.generateSessionCode(sessionDate, branch.code),
        petId: dto.petId,
        petName: pet.name,
        customerId: pet.customerId,
        branchId: branch.id,
        staffId: dto.staffId ?? user?.userId ?? null,
        serviceId: dto.serviceId ?? null,
        packageCode: dto.packageCode ?? null,
        weightAtBooking: pricingPreview?.weight ?? pet.weight ?? null,
        weightBandId: pricingPreview?.weightBand?.id ?? null,
        pricingSnapshot: this.buildSessionPricingSnapshot({
          baseSnapshot: pricingPreview?.pricingSnapshot ?? null,
          mainPrice,
          extraServices,
        }) as any,
        startTime: dto.startTime ? new Date(dto.startTime) : null,
        notes: dto.notes ?? null,
        price: sessionPrice,
        surcharge: dto.surcharge ?? 0,
        status: 'PENDING',
        ...(user?.userId ? {
          timeline: {
            create: {
              action: 'Tạo phiếu',
              toStatus: 'PENDING',
              note: dto.notes?.trim() || 'Khởi tạo phiếu',
              performedBy: user.userId,
            }
          }
        } : {}),
        assignedStaff: {
          connect: dto.staffIds?.map(id => ({ id })) ?? (dto.staffId ? [{ id: dto.staffId }] : []),
        },
      },
      include: {
        pet: {
          select: {
            id: true,
            petCode: true,
            name: true,
            species: true,
            breed: true,
            customer: { select: { id: true, fullName: true, phone: true } },
          },
        },
        staff: { select: { id: true, fullName: true, avatar: true } },
        assignedStaff: { select: { id: true, fullName: true, avatar: true } },
        order: { select: { id: true, orderNumber: true, status: true, paymentStatus: true, total: true, paidAmount: true, remainingAmount: true, staff: { select: { fullName: true } } } },
        branch: { select: { id: true, name: true, code: true } },
      },
    })

    return { success: true, data: { ...session, extraServices } }
  }

  async findAll(query?: any, user?: BranchScopedUser, requestedBranchId?: string): Promise<any> {
    const where = this.mergeBranchScope({}, user, requestedBranchId)

    if (query?.status) where.status = query.status
    if (query?.staffId) where.staffId = query.staffId
    if (query?.startDate || query?.endDate) {
      where.createdAt = {}
      if (query.startDate) where.createdAt.gte = new Date(query.startDate)
      if (query.endDate) where.createdAt.lte = new Date(query.endDate)
    }

    const sessions = await this.db.groomingSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        pet: {
          select: {
            id: true,
            petCode: true,
            name: true,
            species: true,
            breed: true,
            customer: { select: { id: true, fullName: true, phone: true } },
          },
        },
        staff: { select: { id: true, fullName: true, avatar: true } },
        assignedStaff: { select: { id: true, fullName: true, avatar: true } },
        order: { select: { id: true, orderNumber: true, status: true, paymentStatus: true, total: true, paidAmount: true, remainingAmount: true, staff: { select: { fullName: true } } } },
        branch: { select: { id: true, name: true, code: true } },
        orderItems: {
          select: {
            id: true,
            description: true,
            unitPrice: true,
            quantity: true,
            discountItem: true,
            type: true,
            serviceId: true,
            sku: true,
            petId: true,
            pricingSnapshot: true,
          },
        },
      },
    })

    return {
      success: true,
      data: sessions.map((session) => ({
        ...session,
        extraServices: Array.isArray((session.pricingSnapshot as any)?.extraServices)
          ? (session.pricingSnapshot as any).extraServices
          : [],
      })),
    }
  }

  async findOne(id: string, user?: BranchScopedUser): Promise<any> {
    const session = await this.db.groomingSession.findFirst({
      where: {
        OR: [
          { id },
          { sessionCode: { equals: id, mode: 'insensitive' } },
        ],
      },
      include: {
        pet: {
          select: {
            id: true,
            petCode: true,
            name: true,
            species: true,
            breed: true,
            customer: { select: { id: true, fullName: true, phone: true } },
          },
        },
        staff: { select: { id: true, fullName: true, avatar: true } },
        assignedStaff: { select: { id: true, fullName: true, avatar: true } },
        order: { select: { id: true, orderNumber: true, status: true, paymentStatus: true, total: true, paidAmount: true, remainingAmount: true, staff: { select: { fullName: true } } } },
        branch: { select: { id: true, name: true, code: true } },
        orderItems: {
          select: {
            id: true,
            description: true,
            unitPrice: true,
            quantity: true,
            discountItem: true,
            type: true,
            serviceId: true,
            sku: true,
            petId: true,
            pricingSnapshot: true,
          },
        },
        timeline: {
          include: { performedByUser: { select: { id: true, fullName: true, username: true } } },
          orderBy: { createdAt: 'desc' as const }
        },
      },
    })

    if (!session) throw new NotFoundException('Khong tim thay phien grooming')
    assertBranchAccess(session.branchId, user)
    return {
      success: true,
      data: {
        ...session,
        extraServices: Array.isArray((session.pricingSnapshot as any)?.extraServices)
          ? (session.pricingSnapshot as any).extraServices
          : [],
      },
    }
  }

  async findByCode(code: string, user?: BranchScopedUser): Promise<any> {
    const include = {
      pet: {
        select: {
          id: true,
          petCode: true,
          name: true,
          species: true,
          breed: true,
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      },
      staff: { select: { id: true, fullName: true, avatar: true } },
      assignedStaff: { select: { id: true, fullName: true, avatar: true } },
      order: { select: { id: true, orderNumber: true, status: true, paymentStatus: true, total: true, paidAmount: true, remainingAmount: true } },
      branch: { select: { id: true, name: true, code: true } },
      orderItems: {
        select: {
          id: true,
          description: true,
          unitPrice: true,
          quantity: true,
          discountItem: true,
          type: true,
          serviceId: true,
          sku: true,
          petId: true,
          pricingSnapshot: true,
        },
      },
      timeline: {
        include: { performedByUser: { select: { id: true, fullName: true, username: true } } },
        orderBy: { createdAt: 'desc' as const }
      },
    }

    const session = await this.db.groomingSession.findFirst({
      where: {
        OR: [
          { sessionCode: { equals: code, mode: 'insensitive' } },
          { id: code },
        ],
      },
      include,
    })

    if (!session) throw new NotFoundException('Khong tim thay phien grooming')
    assertBranchAccess(session.branchId, user)
    return {
      success: true,
      data: {
        ...session,
        extraServices: Array.isArray((session.pricingSnapshot as any)?.extraServices)
          ? (session.pricingSnapshot as any).extraServices
          : [],
      },
    }
  }

  async update(id: string, dto: UpdateGroomingDto, user?: BranchScopedUser, requestedBranchId?: string): Promise<any> {
    const session = await this.db.groomingSession.findFirst({
      where: {
        OR: [
          { id },
          { sessionCode: { equals: id, mode: 'insensitive' } },
        ],
      },
    })
    if (!session) throw new NotFoundException('Khong tim thay phien grooming')
    id = session.id; // Resolve to internal UUID
    assertBranchAccess(session.branchId, user)

    const dataToUpdate: any = { ...dto }
    delete dataToUpdate.branchId
    delete dataToUpdate.staffIds
    delete dataToUpdate.staffId  // don't overwrite legacy scalar via spread; handle explicitly below
    delete dataToUpdate.extraServices

    if (dto.staffIds !== undefined) {
      // Multi-staff: replace the junction table entries
      dataToUpdate.assignedStaff = {
        set: dto.staffIds.map((id) => ({ id })),
      }
      // Keep legacy staffId in sync with the primary staff (first in array)
      dataToUpdate.staffId = dto.staffIds[0] ?? null
    } else if (dto.staffId !== undefined) {
      // Fallback: single staff (legacy path)
      dataToUpdate.staffId = dto.staffId
    }

    if (dto.startTime) dataToUpdate.startTime = new Date(dto.startTime)
    if (dto.endTime) dataToUpdate.endTime = new Date(dto.endTime)

    if (dto.branchId !== undefined || requestedBranchId) {
      const writableBranchId = resolveWritableBranchId(user, dto.branchId ?? requestedBranchId)
      const branch = await resolveBranchIdentity(this.db, writableBranchId)
      dataToUpdate.branchId = branch.id
    }

    if (dto.status === 'COMPLETED' && !dto.endTime && !session.endTime) {
      dataToUpdate.endTime = new Date()
    }
    if (dto.status === 'IN_PROGRESS' && !dto.startTime && !session.startTime) {
      dataToUpdate.startTime = new Date()
    }

    if (dto.extraServices !== undefined) {
      const currentSnapshot = ((session.pricingSnapshot as Record<string, any> | null) ?? {}) as Record<string, any>
      const previousExtraTotal = Number(currentSnapshot.extraTotal ?? 0)
      const currentMainPrice = Number(currentSnapshot.mainPrice ?? (Number(session.price ?? 0) - previousExtraTotal))
      const mainPrice = dto.price !== undefined ? Number(dto.price) : currentMainPrice
      const extraServices = this.normalizeExtraServices(dto.extraServices)
      const extraTotal = extraServices.reduce((sum, service) => sum + service.price * service.quantity, 0)

      dataToUpdate.price = (Number.isFinite(mainPrice) ? mainPrice : 0) + extraTotal
      dataToUpdate.pricingSnapshot = this.buildSessionPricingSnapshot({
        baseSnapshot: currentSnapshot,
        mainPrice: Number.isFinite(mainPrice) ? mainPrice : 0,
        extraServices,
      }) as any
    }

    if (user?.userId) {
      dataToUpdate.timeline = {
        create: {
          action: dto.status && dto.status !== session.status ? 'Cập nhật trạng thái' : 'Cập nhật thông tin',
          fromStatus: session.status,
          toStatus: dto.status ?? session.status,
          note: dto.notes?.trim() || null,
          performedBy: user.userId,
        }
      }
    }

    const updated = await this.db.groomingSession.update({
      where: { id },
      data: dataToUpdate,
      include: {
        pet: {
          select: {
            id: true,
            petCode: true,
            name: true,
            species: true,
            breed: true,
            customer: { select: { id: true, fullName: true, phone: true } },
          },
        },
        staff: { select: { id: true, fullName: true, avatar: true } },
        assignedStaff: { select: { id: true, fullName: true, avatar: true } },
        order: { select: { id: true, orderNumber: true, status: true, paymentStatus: true, total: true, paidAmount: true, remainingAmount: true, staff: { select: { fullName: true } } } },
        branch: { select: { id: true, name: true, code: true } },
      },
    })

    return {
      success: true,
      data: {
        ...updated,
        extraServices: Array.isArray((updated.pricingSnapshot as any)?.extraServices)
          ? (updated.pricingSnapshot as any).extraServices
          : [],
      },
    }
  }

  async remove(id: string, user?: BranchScopedUser): Promise<any> {
    const session = await this.db.groomingSession.findFirst({
      where: {
        OR: [
          { id },
          { sessionCode: { equals: id, mode: 'insensitive' } },
        ],
      },
    })
    if (!session) throw new NotFoundException('Khong tim thay phien grooming')
    id = session.id; // Resolve to internal UUID
    assertBranchAccess(session.branchId, user)

    await this.db.groomingSession.delete({ where: { id } })
    return { success: true }
  }
}
