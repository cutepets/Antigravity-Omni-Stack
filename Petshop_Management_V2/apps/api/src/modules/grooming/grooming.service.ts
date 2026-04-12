import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { generateGroomingSessionCode as formatGroomingSessionCode } from '@petshop/shared'
import { assertBranchAccess, getScopedBranchIds, resolveWritableBranchId, type BranchScopedUser } from '../../common/utils/branch-scope.util.js'
import { resolveBranchIdentity } from '../../common/utils/branch-identity.util.js'
import { DatabaseService } from '../../database/database.service.js'
import { CalculateSpaPriceDto, CreateGroomingDto, UpdateGroomingDto } from './dto/grooming.dto.js'

@Injectable()
export class GroomingService {
  constructor(private readonly db: DatabaseService) {}

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

  private normalizeSpecies(value?: string | null) {
    return value?.trim().toLowerCase() || null
  }

  private async buildSpaPricingPreview(dto: CalculateSpaPriceDto, user?: BranchScopedUser) {
    const pet = await this.findAccessiblePet(dto.petId, user)
    const species = this.normalizeSpecies(dto.species ?? pet.species)
    const weight = Number(dto.weight ?? pet.weight)

    if (!Number.isFinite(weight)) {
      throw new BadRequestException('Thu cung can co can nang de tinh gia SPA')
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
      bands.find((band) => this.normalizeSpecies(band.species) === species) ??
      bands.find((band) => !band.species)

    if (!weightBand) {
      throw new BadRequestException(`Chua cau hinh hang can SPA cho ${weight}kg`)
    }

    const rules = await this.db.spaPriceRule.findMany({
      where: {
        packageCode: dto.packageCode,
        weightBandId: weightBand.id,
        isActive: true,
        OR: [{ species }, { species: null }],
      },
      orderBy: { createdAt: 'desc' },
    })
    const priceRule =
      rules.find((rule) => this.normalizeSpecies(rule.species) === species) ??
      rules.find((rule) => !rule.species)

    if (!priceRule) {
      throw new BadRequestException(`Chua cau hinh gia SPA ${dto.packageCode} cho hang can ${weightBand.label}`)
    }

    const pricingSnapshot = {
      source: 'spa-price-rule',
      packageCode: dto.packageCode,
      species,
      weight,
      weightBandId: weightBand.id,
      weightBandLabel: weightBand.label,
      weightBandMin: weightBand.minWeight,
      weightBandMax: weightBand.maxWeight,
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
      weightBand: {
        id: weightBand.id,
        label: weightBand.label,
        minWeight: weightBand.minWeight,
        maxWeight: weightBand.maxWeight,
      },
      pricingSnapshot,
    }
  }

  async calculatePrice(dto: CalculateSpaPriceDto, user?: BranchScopedUser): Promise<any> {
    const preview = await this.buildSpaPricingPreview(dto, user)
    return { success: true, data: preview }
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

    const session = await this.db.groomingSession.create({
      data: {
        sessionCode: await this.generateSessionCode(sessionDate, branch.code),
        petId: dto.petId,
        petName: pet.name,
        customerId: pet.customerId,
        branchId: branch.id,
        staffId: dto.staffId ?? null,
        serviceId: dto.serviceId ?? null,
        packageCode: dto.packageCode ?? null,
        weightAtBooking: pricingPreview?.weight ?? pet.weight ?? null,
        weightBandId: pricingPreview?.weightBand.id ?? null,
        ...(pricingPreview ? { pricingSnapshot: pricingPreview.pricingSnapshot } : {}),
        startTime: dto.startTime ? new Date(dto.startTime) : null,
        notes: dto.notes ?? null,
        price: dto.price ?? pricingPreview?.price ?? null,
        status: 'PENDING',
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
        order: { select: { id: true, orderNumber: true } },
      },
    })

    return { success: true, data: session }
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
        order: { select: { id: true, orderNumber: true } },
      },
    })

    return { success: true, data: sessions }
  }

  async findOne(id: string, user?: BranchScopedUser): Promise<any> {
    const session = await this.db.groomingSession.findUnique({
      where: { id },
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
        order: { select: { id: true, orderNumber: true } },
      },
    })

    if (!session) throw new NotFoundException('Khong tim thay phien grooming')
    assertBranchAccess(session.branchId, user)
    return { success: true, data: session }
  }

  async update(id: string, dto: UpdateGroomingDto, user?: BranchScopedUser, requestedBranchId?: string): Promise<any> {
    const session = await this.db.groomingSession.findUnique({ where: { id } })
    if (!session) throw new NotFoundException('Khong tim thay phien grooming')
    assertBranchAccess(session.branchId, user)

    const dataToUpdate: any = { ...dto }
    delete dataToUpdate.branchId

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
        order: { select: { id: true, orderNumber: true } },
      },
    })

    return { success: true, data: updated }
  }

  async remove(id: string, user?: BranchScopedUser): Promise<any> {
    const session = await this.db.groomingSession.findUnique({ where: { id } })
    if (!session) throw new NotFoundException('Khong tim thay phien grooming')
    assertBranchAccess(session.branchId, user)

    await this.db.groomingSession.delete({ where: { id } })
    return { success: true }
  }
}
