import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { BadRequestException } from '@nestjs/common'
import { generateGroomingSessionCode as formatGroomingSessionCode } from '@petshop/shared'
import { DatabaseService } from '../../../../../database/database.service.js'
import { resolveBranchIdentity } from '../../../../../common/utils/branch-identity.util.js'
import { getScopedBranchIds, resolveWritableBranchId, type BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'
import { CreateGroomingCommand } from './create-grooming.command.js'
import type { CalculateSpaPriceDto } from '../../../dto/grooming.dto.js'

@CommandHandler(CreateGroomingCommand)
export class CreateGroomingHandler implements ICommandHandler<CreateGroomingCommand> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ dto, actor, requestedBranchId }: CreateGroomingCommand) {
        const user = actor as BranchScopedUser | undefined

        const pet = await this.findAccessiblePet(dto.petId, user)
        const writableBranchId = resolveWritableBranchId(user, dto.branchId ?? requestedBranchId)
        const branch = await resolveBranchIdentity(this.db, writableBranchId)
        const sessionDate = dto.startTime ? new Date(dto.startTime) : new Date()

        const pricingPreview = dto.packageCode
            ? await this.buildSpaPricingPreview({ petId: dto.petId, packageCode: dto.packageCode }, user)
            : null

        const session = await this.db.groomingSession.create({
            data: {
                sessionCode: await this.generateSessionCode(sessionDate, branch.code),
                petId: dto.petId,
                petName: pet.name,
                customerId: pet.customerId,
                branchId: branch.id,
                staffId: dto.staffId ?? actor?.userId ?? null,
                serviceId: dto.serviceId ?? null,
                packageCode: dto.packageCode ?? null,
                weightAtBooking: pricingPreview?.weight ?? pet.weight ?? null,
                weightBandId: pricingPreview?.weightBand?.id ?? null,
                ...(pricingPreview ? { pricingSnapshot: pricingPreview.pricingSnapshot } : {}),
                startTime: dto.startTime ? new Date(dto.startTime) : null,
                notes: dto.notes ?? null,
                price: dto.price ?? pricingPreview?.price ?? null,
                surcharge: dto.surcharge ?? 0,
                status: 'PENDING',
                ...(actor?.userId ? {
                    timeline: {
                        create: {
                            action: 'Tạo phiếu',
                            toStatus: 'PENDING',
                            note: dto.notes?.trim() || 'Khởi tạo phiếu',
                            performedBy: actor.userId,
                        }
                    }
                } : {}),
                assignedStaff: {
                    connect: dto.staffIds?.map(id => ({ id })) ?? (dto.staffId ? [{ id: dto.staffId }] : []),
                },
            },
            include: this.sessionInclude,
        })

        return { success: true, data: session }
    }

    private readonly sessionInclude = {
        pet: {
            select: {
                id: true, petCode: true, name: true, species: true, breed: true,
                customer: { select: { id: true, fullName: true, phone: true } },
            },
        },
        staff: { select: { id: true, fullName: true, avatar: true } },
        assignedStaff: { select: { id: true, fullName: true, avatar: true } },
        order: { select: { id: true, orderNumber: true } },
        branch: { select: { id: true, name: true, code: true } },
    } as const

    private async generateSessionCode(date: Date, branchCode: string): Promise<string> {
        const start = new Date(date.getFullYear(), date.getMonth(), 1)
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 1)
        const codePrefix = formatGroomingSessionCode(date, branchCode, 0).slice(0, -3)

        const count = await this.db.groomingSession.count({
            where: { createdAt: { gte: start, lt: end }, sessionCode: { startsWith: codePrefix } },
        })
        return formatGroomingSessionCode(date, branchCode, count + 1)
    }

    private async findAccessiblePet(petId: string, user?: BranchScopedUser) {
        const scopedBranchIds = getScopedBranchIds(user)
        const pet = await this.db.pet.findFirst({
            where: scopedBranchIds
                ? {
                    id: petId,
                    OR: [
                        { branchId: { in: scopedBranchIds } },
                        { AND: [{ branchId: null }, { customer: { is: { branchId: { in: scopedBranchIds } } } }] },
                    ],
                }
                : { id: petId },
            include: { customer: true },
        })
        if (!pet) throw new BadRequestException('Không tìm thấy thú cưng')
        return pet
    }

    private async buildSpaPricingPreview(dto: CalculateSpaPriceDto, user?: BranchScopedUser) {
        const pet = await this.findAccessiblePet(dto.petId, user)
        const species = (dto.species ?? pet.species)?.trim() || null
        const weight = Number(dto.weight ?? pet.weight)

        if (!Number.isFinite(weight)) throw new BadRequestException('Thú cưng cần có cân nặng để tính giá SPA')

        const matchesSpecies = (value?: string | null) => !value || value.trim().toLowerCase() === species?.toLowerCase()
        const matchesCustomRange = (rule: { minWeight?: number | null; maxWeight?: number | null }) => {
            if (rule.minWeight === null || rule.minWeight === undefined) return rule.maxWeight === null || rule.maxWeight === undefined
            const maxWeight = rule.maxWeight === null || rule.maxWeight === undefined ? Number.POSITIVE_INFINITY : Number(rule.maxWeight)
            return weight >= Number(rule.minWeight) && weight < maxWeight
        }

        const bands = await this.db.serviceWeightBand.findMany({
            where: { serviceType: 'GROOMING', isActive: true, minWeight: { lte: weight }, OR: [{ maxWeight: null }, { maxWeight: { gt: weight } }] },
            orderBy: [{ sortOrder: 'asc' }, { minWeight: 'asc' }],
        })
        const weightBand =
            bands.find((band) => band.species?.trim().toLowerCase() === species?.toLowerCase()) ??
            bands.find((band) => !band.species) ?? null

        const weightBandedRules = weightBand
            ? await this.db.spaPriceRule.findMany({ where: { packageCode: dto.packageCode, weightBandId: weightBand.id, isActive: true }, orderBy: { createdAt: 'desc' } })
            : []

        let priceRule =
            weightBandedRules.find((rule) => matchesSpecies(rule.species)) ??
            weightBandedRules.find((rule) => !rule.species) ?? null

        if (!priceRule) {
            const customRangeRules = await this.db.spaPriceRule.findMany({
                where: { packageCode: dto.packageCode, weightBandId: null, isActive: true },
                orderBy: [{ minWeight: 'asc' }, { createdAt: 'desc' }],
            })
            const customWeightMatchedRules = customRangeRules.filter((rule) => matchesCustomRange(rule))
            priceRule =
                customWeightMatchedRules.find((rule) => matchesSpecies(rule.species)) ??
                customWeightMatchedRules.find((rule) => !rule.species) ?? null
        }

        if (!priceRule) {
            if (weightBand) throw new BadRequestException(`Chưa cấu hình giá SPA ${dto.packageCode} cho hạng cân ${weightBand.label}`)
            throw new BadRequestException(`Chưa cấu hình giá SPA ${dto.packageCode} cho ${weight}kg`)
        }

        const effectiveWeightBand = weightBand ?? (priceRule.minWeight !== null || priceRule.maxWeight !== null
            ? { id: null, label: `${priceRule.minWeight ?? 0}-${priceRule.maxWeight ?? 'INF'}kg`, minWeight: priceRule.minWeight ?? 0, maxWeight: priceRule.maxWeight ?? null }
            : null)

        return {
            petId: pet.id, petName: pet.name, species, weight, packageCode: dto.packageCode,
            price: priceRule.price, durationMinutes: priceRule.durationMinutes, weightBand: effectiveWeightBand,
            pricingSnapshot: {
                source: 'spa-price-rule', packageCode: dto.packageCode, species, weight,
                weightBandId: effectiveWeightBand?.id ?? null, weightBandLabel: effectiveWeightBand?.label ?? null,
                weightBandMin: effectiveWeightBand?.minWeight ?? null, weightBandMax: effectiveWeightBand?.maxWeight ?? null,
                priceRuleId: priceRule.id, price: priceRule.price, durationMinutes: priceRule.durationMinutes,
            },
        }
    }
}
