import { PrismaClient } from '@prisma/client'

// Singleton PrismaClient — Lesson L001: chỉ 1 instance duy nhất trong toàn app
// tránh "prepared statement already exists" và connection pool exhaustion

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma
}

export * from '@prisma/client'
