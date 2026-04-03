import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import { CreateGroomingDto, UpdateGroomingDto } from './dto/grooming.dto.js'

@Injectable()
export class GroomingService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateGroomingDto) {
    const pet = await this.db.pet.findUnique({
      where: { id: dto.petId },
      include: { customer: true }
    })

    if (!pet) throw new BadRequestException('Không tìm thấy thú cưng')

    const session = await this.db.groomingSession.create({
      data: {
        petId: dto.petId,
        petName: pet.name,
        customerId: pet.customerId,
        staffId: dto.staffId ?? null,
        serviceId: dto.serviceId ?? null,
        startTime: dto.startTime ? new Date(dto.startTime) : null,
        notes: dto.notes ?? null,
        status: 'PENDING'
      },
      include: {
        pet: true,
        staff: { select: { id: true, fullName: true, avatar: true } }
      }
    })

    return { success: true, data: session }
  }

  async findAll(query?: any) {
    const where: any = {}
    
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
          include: { customer: { select: { fullName: true, phone: true } } }
        },
        staff: { select: { id: true, fullName: true, avatar: true } }
      }
    })

    return { success: true, data: sessions }
  }

  async findOne(id: string) {
    const session = await this.db.groomingSession.findUnique({
      where: { id },
      include: {
        pet: true,
        staff: { select: { id: true, fullName: true, avatar: true } }
      }
    })
    
    if (!session) throw new NotFoundException('Không tìm thấy phiên Grooming')
    return { success: true, data: session }
  }

  async update(id: string, dto: UpdateGroomingDto) {
    const session = await this.db.groomingSession.findUnique({ where: { id } })
    if (!session) throw new NotFoundException('Không tìm thấy phiên Grooming')

    const dataToUpdate: any = { ...dto }
    if (dto.startTime) dataToUpdate.startTime = new Date(dto.startTime)
    if (dto.endTime) dataToUpdate.endTime = new Date(dto.endTime)

    // Automatically set endTime if status changes to COMPLETED and endTime is not provided
    if (dto.status === 'COMPLETED' && !dto.endTime && !session.endTime) {
        dataToUpdate.endTime = new Date()
    }

    const updated = await this.db.groomingSession.update({
      where: { id },
      data: dataToUpdate,
      include: {
        pet: {
          include: { customer: { select: { fullName: true, phone: true } } }
        },
        staff: { select: { id: true, fullName: true, avatar: true } }
      }
    })

    return { success: true, data: updated }
  }

  async remove(id: string) {
    const session = await this.db.groomingSession.findUnique({ where: { id } })
    if (!session) throw new NotFoundException('Không tìm thấy phiên Grooming')

    await this.db.groomingSession.delete({ where: { id } })
    return { success: true }
  }
}
