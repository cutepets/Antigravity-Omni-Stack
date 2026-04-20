import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { DatabaseService } from '../../../../../database/database.service.js'
import { GetGroomingPackagesQuery } from './get-grooming-packages.query.js'

@QueryHandler(GetGroomingPackagesQuery)
export class GetGroomingPackagesHandler implements IQueryHandler<GetGroomingPackagesQuery> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ species }: GetGroomingPackagesQuery) {
        const normalizedInput = species?.trim().toLowerCase() || null

        const rules = await this.db.spaPriceRule.findMany({
            where: { isActive: true },
            select: { packageCode: true, species: true },
            orderBy: { packageCode: 'asc' },
        })

        const filtered = normalizedInput
            ? rules.filter((r) => !r.species || r.species.trim().toLowerCase() === normalizedInput)
            : rules

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
}
