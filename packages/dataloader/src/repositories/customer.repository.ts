import { prisma, Customer, Prisma } from '@petshop/database'

export interface FindCustomerOptions {
  search?: string
  page?: number
  limit?: number
  tier?: string
  isActive?: boolean
}

export class CustomerRepository {
  async findMany(options: FindCustomerOptions = {}) {
    const { search, page = 1, limit = 20, tier, isActive } = options
    
    const where: Prisma.CustomerWhereInput = {}
    
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
      ]
    }
    
    if (tier) where.tier = tier
    if (isActive !== undefined) where.isActive = isActive

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findById(id: string) {
    return prisma.customer.findUnique({ where: { id } })
  }

  async create(data: Prisma.CustomerCreateInput) {
    return prisma.customer.create({ data })
  }

  async update(id: string, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({ where: { id }, data })
  }

  async delete(id: string) {
    return prisma.customer.delete({ where: { id } })
  }
}

export const customerRepository = new CustomerRepository()