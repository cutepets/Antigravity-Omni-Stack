import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import { CreatePetDto } from './dto/create-pet.dto.js'
import { UpdatePetDto } from './dto/update-pet.dto.js'
import { FindPetsDto } from './dto/find-pets.dto.js'
import { Prisma } from '@petshop/database'

@Injectable()
export class PetService {
  constructor(private readonly db: DatabaseService) {}

  private async generatePetCode(): Promise<string> {
    const lastPet = await this.db.pet.findFirst({
      orderBy: { petCode: 'desc' },
      select: { petCode: true },
    })

    if (!lastPet || !lastPet.petCode.startsWith('PET-')) {
      return 'PET-000001'
    }

    const lastNumber = parseInt(lastPet.petCode.replace('PET-', ''), 10)
    const nextNumber = lastNumber + 1
    return `PET-${nextNumber.toString().padStart(6, '0')}`
  }

  async create(createPetDto: CreatePetDto) {
    const { customerId, ...petData } = createPetDto

    const customer = await this.db.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      throw new BadRequestException('Khách hàng không tồn tại')
    }

    const petCode = await this.generatePetCode()

    const pet = await this.db.pet.create({
      data: {
        ...petData,
        petCode,
        customerId,
        dateOfBirth: petData.dateOfBirth ? new Date(petData.dateOfBirth) : null,
      },
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true }
        }
      }
    })

    return { success: true, data: pet }
  }

  async findAll(query: FindPetsDto) {
    const { q, species, gender, customerId, page = 1, limit = 10 } = query
    const skip = (page - 1) * limit

    const where: Prisma.PetWhereInput = {
      ...(species && { species }),
      ...(gender && { gender }),
      ...(customerId && { customerId }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { petCode: { contains: q, mode: 'insensitive' } },
          { microchipId: { contains: q, mode: 'insensitive' } },
        ],
      }),
    }

    const [total, data] = await Promise.all([
      this.db.pet.count({ where }),
      this.db.pet.findMany({
        where,
        skip: Number(skip),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      }),
    ])

    return {
      success: true,
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async findOne(id: string) {
    const pet = await this.db.pet.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        weightLogs: { orderBy: { date: 'desc' }, take: 5 },
        vaccinations: { orderBy: { date: 'desc' } },
      },
    })
    
    if (!pet) throw new NotFoundException('Không tìm thấy thú cưng')
    return { success: true, data: pet }
  }

  async update(id: string, updatePetDto: UpdatePetDto) {
    const pet = await this.db.pet.findUnique({ where: { id } })
    if (!pet) throw new NotFoundException('Không tìm thấy thú cưng')

    if (updatePetDto.customerId && updatePetDto.customerId !== pet.customerId) {
        const customer = await this.db.customer.findUnique({
          where: { id: updatePetDto.customerId },
        })
        if (!customer) throw new BadRequestException('Khách hàng mới không tồn tại')
    }

    const dataToUpdate: any = { ...updatePetDto }
    if (dataToUpdate.dateOfBirth) {
        dataToUpdate.dateOfBirth = new Date(dataToUpdate.dateOfBirth)
    }

    const updated = await this.db.pet.update({
      where: { id },
      data: dataToUpdate,
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      }
    })

    return { success: true, data: updated }
  }

  async remove(id: string) {
    const pet = await this.db.pet.findUnique({ where: { id } })
    if (!pet) throw new NotFoundException('Không tìm thấy thú cưng')

    await this.db.pet.delete({ where: { id } })
    return { success: true }
  }
}
