import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject, NotFoundException } from '@nestjs/common'
import { FindPetQuery } from './find-pet.query.js'
import { PET_REPOSITORY, type IPetRepository } from '../../../domain/ports/pet.repository.js'
import { DatabaseService } from '../../../../../database/database.service.js'

/**
 * Query Handler: FindPetQuery — Phase 2 (upgraded)
 * Returns full pet detail with medical history and service history:
 * - weightLogs, vaccinations, timeline (last 50)
 * - groomingSessions, hotelStays (last 20 each)
 */
@QueryHandler(FindPetQuery)
export class FindPetHandler implements IQueryHandler<FindPetQuery> {
    constructor(
        @Inject(PET_REPOSITORY)
        private readonly petRepo: IPetRepository,
        private readonly db: DatabaseService,
    ) { }

    async execute({ id }: FindPetQuery) {
        // Verify pet exists via domain repo (id or petCode)
        const petEntity = await this.petRepo.findById(id)
        if (!petEntity) throw new NotFoundException('Không tìm thấy thú cưng')

        // Fetch full detail with all relations from DB directly
        const pet = await this.db.pet.findUnique({
            where: { id: petEntity.id },
            include: {
                customer: { select: { id: true, fullName: true, phone: true } },
                weightLogs: { orderBy: { date: 'desc' }, take: 10 },
                vaccinations: { orderBy: { date: 'desc' }, take: 20 },
                timeline: { orderBy: { createdAt: 'desc' }, take: 50 },
                groomingSessions: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    select: {
                        id: true,
                        sessionCode: true,
                        status: true,
                        notes: true,
                        startTime: true,
                        createdAt: true,
                    },
                },
                hotelStays: {
                    orderBy: { checkIn: 'desc' },
                    take: 20,
                    select: {
                        id: true,
                        stayCode: true,
                        status: true,
                        checkIn: true,
                        checkOut: true,
                        lineType: true,
                    },
                },
            },
        })

        if (!pet) throw new NotFoundException('Không tìm thấy thú cưng')

        return { success: true, data: pet }
    }
}
