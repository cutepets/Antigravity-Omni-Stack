import { prisma, Order, Prisma } from '@petshop/database'

export interface FindOrderOptions {
  search?: string
  page?: number
  limit?: number
  status?: string
  customerId?: string
}

export class OrderRepository {
  async findMany(options: FindOrderOptions = {}) {
    const { search, page = 1, limit = 20, status, customerId } = options
    
    const where: Prisma.OrderWhereInput = {}
    
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { customer: { fullName: { contains: search } } },
      ]
    }
    
    if (status) where.status = status
    if (customerId) where.customerId = customerId

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findById(id: string) {
    return prisma.order.findUnique({ where: { id } })
  }

  async create(data: Prisma.OrderCreateInput) {
    return prisma.order.create({ data })
  }

  async update(id: string, data: Prisma.OrderUpdateInput) {
    return prisma.order.update({ where: { id }, data })
  }

  async delete(id: string) {
    return prisma.order.delete({ where: { id } })
  }
}

export const orderRepository = new OrderRepository()