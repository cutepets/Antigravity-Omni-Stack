import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { BadRequestException } from '@nestjs/common'
import { DatabaseService } from '../../../../../database/database.service.js'
import { getScopedBranchIds, type BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'
import { CalculateGroomingPriceQuery } from './calculate-grooming-price.query.js'
import type { CalculateSpaPriceDto } from '../../../dto/grooming.dto.js'

@QueryHandler(CalculateGroomingPriceQuery)
export class CalculateGroomingPriceHandler implements IQueryHandler<CalculateGroomingPriceQuery> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ dto, actor }: CalculateGroomingPriceQuery) {
        const user = actor as BranchScopedUser | undefined
        const preview = await this.buildSpaPricingPreview(dto, user)
        return { success: true, data: preview }
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

    async buildSpaPricingPreview(dto: CalculateSpaPriceDto, user?: BranchScopedUser) {
        const pet = await this.findAccessiblePet(dto.petId, user)
        const species = (dto.species ?? pet.species)?.trim() || null
        const weight = Number(dto.weight ?? pet.weight)

        if (!Number.isFinite(weight)) throw new BadRequestException('Thú cưng cần có cân nặng để tính giá SPA')

        const matchesSpecies = (value?: string | null) => !value || value.trim().toLowerCase() === species?.toLowerCase()
        const matchesCustomRange = (rule: { minWeight?: number | null; maxWeight?: number | null }) => {
            if (rule.minWeight === null || rule.minWeight === undefined) return rule.maxWeight === null || rule.maxWeight === undefined
            const maxWeight = rule.maxWeight == null ? Number.POSITIVE_INFINITY : Number(rule.maxWeight)
            return weight >= Number(rule.minWeight) && weight < maxWeight
        }

        const bands = await this.db.serviceWeightBand.findMany({
            where: { serviceType: 'GROOMING', isActive: true, minWeight: { lte: weight }, OR: [{ maxWeight: null }, { maxWeight: { gt: weight } }] },
            orderBy: [{ sortOrder: 'asc' }, { minWeight: 'asc' }],
        })
        const weightBand =
            bands.find((b) => b.species?.trim().toLowerCase() === species?.toLowerCase()) ??
            bands.find((b) => !b.species) ?? null

        const weightBandedRules = weightBand
            ? await this.db.spaPriceRule.findMany({ where: { packageCode: dto.packageCode, weightBandId: weightBand.id, isActive: true }, orderBy: { createdAt: 'desc' } })
            : []

        let priceRule =
            weightBandedRules.find((r) => matchesSpecies(r.species)) ??
            weightBandedRules.find((r) => !r.species) ?? null

        if (!priceRule) {
            const fallbackRules = await this.db.spaPriceRule.findMany({
                where: { packageCode: dto.packageCode, weightBandId: null, isActive: true },
                orderBy: [{ minWeight: 'asc' }, { createdAt: 'desc' }],
            })
            const matched = fallbackRules.filter((r) => matchesCustomRange(r))
            priceRule = matched.find((r) => matchesSpecies(r.species)) ?? matched.find((r) => !r.species) ?? null
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
