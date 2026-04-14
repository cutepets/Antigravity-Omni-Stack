import { prisma, Pet, Prisma } from '@petshop/database'

export interface FindPetOptions {
  search?: string
  page?: number
  limit?: number
  species?: string
  customerId?: string
}

export class PetRepository {
  async findMany(options: FindPetOptions = {}) {
    const { search, page = 1, limit = 20, species, customerId } = options
    
    const where: Prisma.PetWhereInput = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { breed: { contains: search } },
      ]
    }
    
    if (species) where.species = species
    if (customerId) where.customerId = customerId

    const [data, total] = await Promise.all([
      prisma.pet.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pet.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findById(id: string) {
    return prisma.pet.findUnique({ where: { id } })
  }

  async create(data: Prisma.PetCreateInput) {
    return prisma.pet.create({ data })
  }

  async update(id: string, data: Prisma.PetUpdateInput) {
    return prisma.pet.update({ where: { id }, data })
  }

  async delete(id: string) {
    return prisma.pet.delete({ where: { id } })
  }
}

export const petRepository = new PetRepository()