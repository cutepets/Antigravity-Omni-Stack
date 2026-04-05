import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ---- Branch ----
  const branch = await prisma.branch.upsert({
    where: { id: 'branch-main' },
    update: {},
    create: {
      id: 'branch-main',
      name: 'Chi nhánh chính',
      address: '123 Đường ABC, Quận 1, TP.HCM',
      phone: '0901234567',
      isActive: true,
    },
  })
  console.log('✅ Branch:', branch.name)

  // ---- Roles ----
  const superAdminRole = await prisma.role.upsert({
    where: { code: 'SUPER_ADMIN' },
    update: { name: 'Chủ cửa hàng (Super Admin)', permissions: ['MANAGE_STAFF', 'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_BRANCHES', 'MANAGE_SETTINGS', 'MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_VACCINES', 'MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'MANAGE_BILLS', 'MANAGE_MEDICAL_RECORDS', 'VIEW_FINANCIAL_REPORTS', 'FULL_BRANCH_ACCESS'] },
    create: {
      code: 'SUPER_ADMIN',
      name: 'Chủ cửa hàng (Super Admin)',
      description: 'Quyền cao nhất, không thể xóa hoặc sửa quyền.',
      isSystem: true,
      permissions: ['MANAGE_STAFF', 'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_BRANCHES', 'MANAGE_SETTINGS', 'MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_VACCINES', 'MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'MANAGE_BILLS', 'MANAGE_MEDICAL_RECORDS', 'VIEW_FINANCIAL_REPORTS', 'FULL_BRANCH_ACCESS']
    }
  })

  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: { name: 'Quản trị viên (Admin)', permissions: ['MANAGE_STAFF', 'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_BRANCHES', 'MANAGE_SETTINGS', 'MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_VACCINES', 'MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'MANAGE_BILLS', 'MANAGE_MEDICAL_RECORDS', 'VIEW_FINANCIAL_REPORTS', 'FULL_BRANCH_ACCESS'] },
    create: {
      code: 'ADMIN',
      name: 'Quản trị viên (Admin)',
      description: 'Quản trị hệ thống cấp cao.',
      isSystem: true,
      permissions: ['MANAGE_STAFF', 'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_BRANCHES', 'MANAGE_SETTINGS', 'MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_VACCINES', 'MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'MANAGE_BILLS', 'MANAGE_MEDICAL_RECORDS', 'VIEW_FINANCIAL_REPORTS', 'FULL_BRANCH_ACCESS']
    }
  })

  const managerRole = await prisma.role.upsert({
    where: { code: 'MANAGER' },
    update: { name: 'Cửa hàng trưởng (Manager)', permissions: ['MANAGE_STAFF', 'MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'MANAGE_BILLS', 'MANAGE_MEDICAL_RECORDS', 'VIEW_FINANCIAL_REPORTS'] },
    create: {
      code: 'MANAGER',
      name: 'Cửa hàng trưởng (Manager)',
      description: 'Quản lý cửa hàng, có thể xem báo cáo nhưng không thể can thiệp hệ thống lõi.',
      isSystem: false,
      permissions: ['MANAGE_STAFF', 'MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'MANAGE_BILLS', 'MANAGE_MEDICAL_RECORDS', 'VIEW_FINANCIAL_REPORTS']
    }
  })

  const staffRole = await prisma.role.upsert({
    where: { code: 'STAFF' },
    update: { name: 'Thu ngân / Lễ tân (Staff)', permissions: ['MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'MANAGE_MEDICAL_RECORDS'] },
    create: {
      code: 'STAFF',
      name: 'Thu ngân / Lễ tân (Staff)',
      description: 'Chỉ xem tạo đơn hàng, quản lý hóa đơn, đón/trả thú cưng.',
      isSystem: false,
      permissions: ['MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'MANAGE_MEDICAL_RECORDS']
    }
  })
  console.log('✅ Roles created')

  // ---- Super Admin ----
  const superAdminHash = await bcrypt.hash('Admin@123', 12)
  const superAdmin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      staffCode: 'NV00001',
      username: 'superadmin',
      passwordHash: superAdminHash,
      fullName: 'Super Administrator',
      legacyRole: 'SUPER_ADMIN',
      roleId: superAdminRole.id,
      status: 'WORKING',
      employmentType: 'FULL_TIME',
      branchId: branch.id,
      joinDate: new Date('2024-01-01'),
    },
  })
  console.log('✅ Super Admin:', superAdmin.username)

  // ---- Admin ----
  const adminHash = await bcrypt.hash('Admin@123', 12)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      staffCode: 'NV00002',
      username: 'admin',
      passwordHash: adminHash,
      fullName: 'Quản trị viên',
      legacyRole: 'ADMIN',
      roleId: adminRole.id,
      status: 'WORKING',
      employmentType: 'FULL_TIME',
      branchId: branch.id,
      joinDate: new Date('2024-01-01'),
    },
  })
  console.log('✅ Admin:', admin.username)

  // ---- Manager ----
  const managerHash = await bcrypt.hash('Staff@123', 12)
  const manager = await prisma.user.upsert({
    where: { username: 'manager' },
    update: {},
    create: {
      staffCode: 'NV00003',
      username: 'manager',
      passwordHash: managerHash,
      fullName: 'Nguyễn Quản Lý',
      legacyRole: 'MANAGER',
      roleId: managerRole.id,
      status: 'WORKING',
      employmentType: 'FULL_TIME',
      phone: '0909123456',
      branchId: branch.id,
      joinDate: new Date('2024-03-01'),
    },
  })
  console.log('✅ Manager:', manager.username)

  // ---- Staff ----
  const staffHash = await bcrypt.hash('Staff@123', 12)
  const staff = await prisma.user.upsert({
    where: { username: 'staff01' },
    update: {},
    create: {
      staffCode: 'NV00004',
      username: 'staff01',
      passwordHash: staffHash,
      fullName: 'Trần Nhân Viên',
      legacyRole: 'STAFF',
      roleId: staffRole.id,
      status: 'WORKING',
      employmentType: 'FULL_TIME',
      phone: '0908765432',
      branchId: branch.id,
      joinDate: new Date('2024-06-01'),
    },
  })
  console.log('✅ Staff:', staff.username)

  // ---- Customer Groups ----
  const vipGroup = await prisma.customerGroup.upsert({
    where: { name: 'VIP' },
    update: {},
    create: {
      name: 'VIP',
      color: '#f59e0b',
      discount: 10,
      description: 'Khách hàng VIP — giảm 10%',
    },
  })

  const regularGroup = await prisma.customerGroup.upsert({
    where: { name: 'Thông thường' },
    update: {},
    create: {
      name: 'Thông thường',
      color: '#6366f1',
      discount: 0,
      description: 'Khách hàng thông thường',
    },
  })
  console.log('✅ Customer Groups created')

  // ---- Sample Customers ----
  const c1 = await prisma.customer.upsert({
    where: { phone: '0987654321' },
    update: {},
    create: {
      customerCode: 'KH-000001',
      fullName: 'Nguyễn Thị Hoa',
      phone: '0987654321',
      email: 'hoa.nguyen@email.com',
      address: '45 Lê Văn Lương, Hà Nội',
      tier: 'GOLD',
      points: 250,
      groupId: vipGroup.id,
    },
  })
  console.log('✅ Customer 1:', c1.fullName)

  const c2 = await prisma.customer.upsert({
    where: { phone: '0912345678' },
    update: {},
    create: {
      customerCode: 'KH-000002',
      fullName: 'Trần Văn Bình',
      phone: '0912345678',
      tier: 'BRONZE',
      points: 0,
      groupId: regularGroup.id,
    },
  })
  console.log('✅ Customer 2:', c2.fullName)

  // ---- Sample Pets ----
  await prisma.pet.upsert({
    where: { petCode: 'P1A2B3' },
    update: {},
    create: {
      petCode: 'P1A2B3',
      name: 'Mochi',
      species: 'Chó',
      breed: 'Poodle',
      gender: 'MALE',
      weight: 3.5,
      color: 'Trắng',
      customerId: c1.id,
      notes: 'Hay cắn khi tắm',
    },
  })

  await prisma.pet.upsert({
    where: { petCode: 'P4C5D6' },
    update: {},
    create: {
      petCode: 'P4C5D6',
      name: 'Luna',
      species: 'Mèo',
      breed: 'Anh lông ngắn',
      gender: 'FEMALE',
      weight: 4.2,
      color: 'Xám',
      customerId: c1.id,
    },
  })
  console.log('✅ Pets created')

  // ---- Sample Services ----
  const groomService = await prisma.service.upsert({
    where: { code: 'SVC-GROOM-001' },
    update: {},
    create: {
      name: 'Tắm và cắt lông',
      code: 'SVC-GROOM-001',
      type: 'GROOMING',
      price: 150000,
      duration: 60,
      isActive: true,
    },
  })

  await prisma.serviceVariant.createMany({
    skipDuplicates: true,
    data: [
      { serviceId: groomService.id, name: 'Dưới 5kg', price: 150000, duration: 60, isActive: true },
      { serviceId: groomService.id, name: '5kg - 10kg', price: 200000, duration: 90, isActive: true },
      { serviceId: groomService.id, name: 'Trên 10kg', price: 280000, duration: 120, isActive: true },
    ],
  })

  await prisma.service.upsert({
    where: { code: 'SVC-HOTEL-001' },
    update: {},
    create: {
      name: 'Khách sạn thú cưng',
      code: 'SVC-HOTEL-001',
      type: 'HOTEL',
      price: 120000,
      duration: null,
      isActive: true,
    },
  })
  console.log('✅ Services created')

  // ---- Sample Hotel Cages ----
  await prisma.cage.upsert({
    where: { name: 'P-01' },
    update: { type: 'REGULAR', description: 'Chuồng thường khu A' },
    create: {
      name: 'P-01',
      type: 'REGULAR',
      description: 'Chuồng thường khu A',
    },
  })

  await prisma.cage.upsert({
    where: { name: 'P-02' },
    update: { type: 'REGULAR', description: 'Chuồng thường khu A' },
    create: {
      name: 'P-02',
      type: 'REGULAR',
      description: 'Chuồng thường khu A',
    },
  })

  await prisma.cage.upsert({
    where: { name: 'VIP-01' },
    update: { type: 'HOLIDAY', description: 'Phòng VIP / lễ tết' },
    create: {
      name: 'VIP-01',
      type: 'HOLIDAY',
      description: 'Phòng VIP / lễ tết',
    },
  })

  const hotelRateSeeds = [
    { name: 'Bảng giá chó nhỏ 2026', year: 2026, species: 'Chó', minWeight: 0, maxWeight: 5, lineType: 'REGULAR', ratePerNight: 120000 },
    { name: 'Bảng giá chó vừa 2026', year: 2026, species: 'Chó', minWeight: 5, maxWeight: 10, lineType: 'REGULAR', ratePerNight: 180000 },
    { name: 'Bảng giá mèo 2026', year: 2026, species: 'Mèo', minWeight: 0, maxWeight: 10, lineType: 'REGULAR', ratePerNight: 100000 },
    { name: 'Bảng giá VIP 2026', year: 2026, species: null, minWeight: 0, maxWeight: 20, lineType: 'HOLIDAY', ratePerNight: 250000 },
  ] as const

  for (const rate of hotelRateSeeds) {
    const existing = await prisma.hotelRateTable.findFirst({
      where: {
        name: rate.name,
        year: rate.year,
        species: rate.species,
        minWeight: rate.minWeight,
        maxWeight: rate.maxWeight,
        lineType: rate.lineType,
      },
    })

    if (!existing) {
      await prisma.hotelRateTable.create({
        data: {
          name: rate.name,
          year: rate.year,
          species: rate.species,
          minWeight: rate.minWeight,
          maxWeight: rate.maxWeight,
          lineType: rate.lineType,
          ratePerNight: rate.ratePerNight,
          isActive: true,
        },
      })
    }
  }
  console.log('Hotel sample data created')

  // ---- Sample Products ----
  const food = await prisma.product.upsert({
    where: { sku: 'PRD-FOOD-001' },
    update: {},
    create: {
      name: 'Thức ăn hạt Royal Canin',
      sku: 'PRD-FOOD-001',
      category: 'Thức ăn',
      brand: 'Royal Canin',
      price: 450000,
      costPrice: 320000,
      minStock: 10,
      unit: 'gói',
      isActive: true,
    },
  })

  await prisma.branchStock.create({
    data: { branchId: branch.id, productId: food.id, stock: 50 }
  })

  const acc = await prisma.product.upsert({
    where: { sku: 'PRD-ACC-001' },
    update: {},
    create: {
      name: 'Vòng cổ chó mèo',
      sku: 'PRD-ACC-001',
      category: 'Phụ kiện',
      price: 85000,
      costPrice: 45000,
      minStock: 5,
      unit: 'cái',
      isActive: true,
    },
  })

  await prisma.branchStock.create({
    data: { branchId: branch.id, productId: acc.id, stock: 30 }
  })
  console.log('✅ Products created')

  console.log('\n🎉 Seed hoàn tất!')
  console.log('\n📋 Tài khoản đăng nhập:')
  console.log('  superadmin / Admin@123')
  console.log('  admin      / Admin@123')
  console.log('  manager    / Staff@123')
  console.log('  staff01    / Staff@123')
}

main()
  .catch((e) => {
    console.error('❌ Seed thất bại:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
