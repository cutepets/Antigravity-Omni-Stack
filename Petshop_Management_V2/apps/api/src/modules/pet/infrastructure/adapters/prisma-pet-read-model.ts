import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../../../database/database.service.js'
import type {
  ActivePetServicesView,
  IPetReadModel,
} from '../../application/ports/pet-read-model.port.js'

@Injectable()
export class PrismaPetReadModel implements IPetReadModel {
  constructor(private readonly db: DatabaseService) {}

  async getPetDetail(petId: string): Promise<Record<string, unknown> | null> {
    return this.db.pet.findUnique({
      where: { id: petId },
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
    }) as Promise<Record<string, unknown> | null>
  }

  async getActivePetServices(petId: string): Promise<ActivePetServicesView> {
    const [groomingSessions, hotelStays] = await Promise.all([
      this.db.groomingSession.findMany({
        where: { petId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        select: { id: true, sessionCode: true, status: true, orderId: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.db.hotelStay.findMany({
        where: { petId, status: { in: ['BOOKED', 'CHECKED_IN'] } },
        select: { id: true, stayCode: true, status: true, orderId: true, checkIn: true, estimatedCheckOut: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    return {
      groomingSessions: groomingSessions as Array<Record<string, unknown>>,
      hotelStays: hotelStays as Array<Record<string, unknown>>,
    }
  }
}
