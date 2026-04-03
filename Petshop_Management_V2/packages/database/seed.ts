import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding dynamic roles...')
  
  // Xóa Refresh Token để bắt người dùng login lại (nạp role mới)
  await prisma.refreshToken.deleteMany()

  const adminRole = await prisma.role.upsert({
    where: { code: 'SUPER_ADMIN' },
    update: { isSystem: true, name: 'Quản trị viên (Admin)' },
    create: { code: 'SUPER_ADMIN', name: 'Quản trị viên (Admin)', isSystem: true, permissions: ['VIEW_DASHBOARD', 'MANAGE_USERS', 'MANAGE_ROLES', 'FULL_BRANCH_ACCESS'] }
  })
  
  const cashierRole = await prisma.role.upsert({
    where: { code: 'CASHIER' },
    update: { isSystem: true, name: 'Thu ngân / Lễ tân' },
    create: { code: 'CASHIER', name: 'Thu ngân / Lễ tân', isSystem: true, permissions: ['CREATE_ORDER', 'VIEW_ORDER', 'REFUND_ORDER'] }
  })
  
  const doctorRole = await prisma.role.upsert({
    where: { code: 'DOCTOR' },
    update: { isSystem: true, name: 'Bác sĩ / Groomer' },
    create: { code: 'DOCTOR', name: 'Bác sĩ / Groomer', isSystem: true, permissions: ['VIEW_ORDER', 'MANAGE_APPOINTMENTS'] }
  })
  
  const users = await prisma.user.findMany()
  for (const user of users) {
     if (!user.roleId) {
        if (user.legacyRole === 'ADMIN' || user.legacyRole === 'SUPER_ADMIN') {
           await prisma.user.update({ where: { id: user.id }, data: { roleId: adminRole.id }})
        } else {
           await prisma.user.update({ where: { id: user.id }, data: { roleId: cashierRole.id }})
        }
     }
  }
  
  console.log('Seed completed.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
