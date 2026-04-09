import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const NOW = new Date('2026-04-06T09:00:00+07:00')

const branchSeeds = [
  { id: 'branch-main', code: 'MAIN', name: 'Showroom Trung Tam', address: '12 Nguyen Hue, Quan 1, TP HCM', phone: '02871000001', email: 'main@petcare.local', isMain: true },
  { id: 'branch-bt', code: 'BT', name: 'Chi Nhanh Binh Thanh', address: '88 Xo Viet Nghe Tinh, Binh Thanh, TP HCM', phone: '02871000002', email: 'bt@petcare.local', isMain: false },
  { id: 'branch-q7', code: 'Q7', name: 'Chi Nhanh Quan 7', address: '41 Nguyen Thi Thap, Quan 7, TP HCM', phone: '02871000003', email: 'q7@petcare.local', isMain: false },
] as const

const roleSeeds = [
  { code: 'SUPER_ADMIN', name: 'Chu cua hang', isSystem: true, permissions: ['MANAGE_STAFF', 'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_BRANCHES', 'MANAGE_SETTINGS', 'MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'VIEW_FINANCIAL_REPORTS', 'FULL_BRANCH_ACCESS'] },
  { code: 'ADMIN', name: 'Quan tri vien', isSystem: true, permissions: ['MANAGE_STAFF', 'MANAGE_BRANCHES', 'MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'VIEW_FINANCIAL_REPORTS'] },
  { code: 'MANAGER', name: 'Cua hang truong', isSystem: false, permissions: ['MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'VIEW_FINANCIAL_REPORTS'] },
  { code: 'STAFF', name: 'Nhan vien van hanh', isSystem: false, permissions: ['MANAGE_PETS', 'MANAGE_CUSTOMERS', 'MANAGE_ORDERS'] },
] as const

const customerGroups = [
  { key: 'VIP', name: 'VIP', color: '#f59e0b', discount: 10, pricePolicy: 'Gia VIP', isDefault: false },
  { key: 'LOYAL', name: 'Than thiet', color: '#22c55e', discount: 5, pricePolicy: 'Gia thanh vien', isDefault: true },
  { key: 'SPA', name: 'Spa care', color: '#0ea5e9', discount: 7, pricePolicy: 'Combo grooming', isDefault: false },
  { key: 'HOTEL', name: 'Hotel care', color: '#a855f7', discount: 6, pricePolicy: 'Combo luu tru', isDefault: false },
] as const

const supplierSeeds = [
  { key: 'SUP1', name: 'Royal Pet Trading', phone: '0919000101', email: 'royal@petcare.local', address: 'Kho A, Thu Duc, TP HCM', monthTarget: 18_000_000, yearTarget: 210_000_000, notes: 'Doi tac chien luoc cho nhom thuc an cho cho.' },
  { key: 'SUP2', name: 'Bio Groom Viet Nam', phone: '0919000102', email: 'bio@petcare.local', address: 'Kho B, Di An, Binh Duong', monthTarget: 12_000_000, yearTarget: 150_000_000, notes: 'Chuyen hang grooming, shampoo va cham soc long.' },
  { key: 'SUP3', name: 'PetStyle Accessory', phone: '0919000103', email: 'style@petcare.local', address: 'Kho C, Go Vap, TP HCM', monthTarget: 14_000_000, yearTarget: 170_000_000, notes: 'Nguon phu kien chu luc cho chuoi cua hang.' },
  { key: 'SUP4', name: 'Vet Plus Pharma', phone: '0919000104', email: 'vet@petcare.local', address: 'Kho D, Bien Hoa, Dong Nai', monthTarget: 10_000_000, yearTarget: 120_000_000, notes: 'NCC thuoc va bo tro suc khoe cho thu cung.' },
  { key: 'SUP5', name: 'Natural Cat Litter', phone: '0919000105', email: 'litter@petcare.local', address: 'Kho E, Hoc Mon, TP HCM', monthTarget: 8_000_000, yearTarget: 95_000_000, notes: 'Tap trung cat ve sinh va xit khu mui.' },
  { key: 'SUP6', name: 'Happy Bark Foods', phone: '0919000106', email: 'bark@petcare.local', address: 'Kho F, Tan Phu, TP HCM', monthTarget: 15_000_000, yearTarget: 190_000_000, notes: 'Nhap pate, snack va thuc an meo/chó quay vong nhanh.' },
] as const

const productSeeds = [
  ['DOGFOOD001', 'Hat Royal Canin Mini Adult 2kg', 'Thuc an', 'Royal Canin', 'goi', 325000, 248000, 10, 'SUP1'],
  ['DOGFOOD002', 'Hat SmartHeart Puppy 3kg', 'Thuc an', 'SmartHeart', 'goi', 285000, 214000, 8, 'SUP1'],
  ['DOGFOOD003', 'Pate Happy Bark Chicken 375g', 'Thuc an', 'Happy Bark Foods', 'hop', 42000, 28000, 24, 'SUP6'],
  ['CATFOOD001', 'Hat Me O Salmon 1.2kg', 'Thuc an', 'Me O', 'goi', 128000, 89000, 15, 'SUP6'],
  ['CATFOOD002', 'Pate Me O Tuna 80g', 'Thuc an', 'Me O', 'hop', 18000, 11500, 48, 'SUP6'],
  ['SNACK001', 'Snack dental chew size S', 'Thuc an', 'Happy Bark Foods', 'thanh', 26000, 16000, 40, 'SUP6'],
  ['SNACK002', 'Snack soft cube salmon', 'Thuc an', 'Happy Bark Foods', 'goi', 55000, 35000, 20, 'SUP6'],
  ['LITTER001', 'Cat ve sinh than hoat tinh 10L', 'Ve sinh', 'Natural Cat Litter', 'goi', 145000, 98000, 18, 'SUP5'],
  ['LITTER002', 'Xit khu mui cat 500ml', 'Ve sinh', 'Bio Care', 'chai', 92000, 62000, 12, 'SUP2'],
  ['BATH001', 'Sua tam cho long trang 500ml', 'Ve sinh', 'Bio Care', 'chai', 138000, 92000, 10, 'SUP2'],
  ['BATH002', 'Sua tam hypoallergenic 500ml', 'Ve sinh', 'Bio Care', 'chai', 168000, 118000, 8, 'SUP2'],
  ['BATH003', 'Khan tam kho sieu hut nuoc', 'Ve sinh', 'PetStyle', 'cai', 99000, 65000, 14, 'SUP3'],
  ['ACCESS001', 'Day dat nylon size M', 'Phu kien', 'PetStyle', 'cai', 115000, 72000, 10, 'SUP3'],
  ['ACCESS002', 'Vong co da co khac ten', 'Phu kien', 'PetStyle', 'cai', 145000, 98000, 9, 'SUP3'],
  ['ACCESS003', 'Bat an inox chong truot', 'Phu kien', 'PetStyle', 'cai', 76000, 43000, 18, 'SUP3'],
  ['ACCESS004', 'Long van chuyen size M', 'Phu kien', 'PetStyle', 'cai', 420000, 305000, 4, 'SUP3'],
  ['ACCESS005', 'Ao mua cho mini', 'Phu kien', 'PetStyle', 'cai', 85000, 52000, 10, 'SUP3'],
  ['CARE001', 'Vitamin da va long 60 vien', 'Cham soc', 'Dr Pet', 'hop', 195000, 132000, 8, 'SUP4'],
  ['CARE002', 'Men tieu hoa thu cung 30 goi', 'Cham soc', 'Dr Pet', 'hop', 172000, 118000, 8, 'SUP4'],
  ['CARE003', 'Xit duong long silk finish', 'Cham soc', 'Bio Care', 'chai', 149000, 101000, 10, 'SUP2'],
  ['CARE004', 'Kem duong chan nut ne', 'Cham soc', 'Dr Pet', 'chai', 110000, 73000, 10, 'SUP4'],
  ['MED001', 'Thuoc nho ve sinh tai 60ml', 'Thuoc', 'Virbac', 'chai', 210000, 154000, 6, 'SUP4'],
  ['MED002', 'Thuoc nho tri bo chet 20kg', 'Thuoc', 'Virbac', 'hop', 285000, 214000, 6, 'SUP4'],
  ['MED003', 'Gel rua mat cho meo 100ml', 'Thuoc', 'Virbac', 'chai', 158000, 109000, 7, 'SUP4'],
] as const

const customerNames = [
  'Le Bao An', 'Tran Minh Thu', 'Nguyen Hoang Nam', 'Pham Gia Han', 'Doan Thanh Vy', 'Vo Quoc Huy',
  'Dang Phuong Linh', 'Bui Tuan Kiet', 'Cao My Duyen', 'Ngo Duc Long', 'Vu Thanh Mai', 'Truong Gia Bao',
  'Ly Cam Tu', 'Huynh Dang Khoa', 'Mai Ngoc Yen', 'Nguyen Kim Anh', 'Phan Hoai Phuc', 'Le Khanh Chi',
  'Pham Tan Tai', 'Duong Thu Ha', 'Lam Nha Uyen', 'Chau Manh Cuong', 'Ton Nhat Ha', 'Ngo Bao Tram',
] as const

const streets = [
  'Nguyen Hue, Quan 1', 'Vo Van Tan, Quan 3', 'Xo Viet Nghe Tinh, Binh Thanh', 'Nguyen Thi Thap, Quan 7',
  'Kha Van Can, Thu Duc', 'Le Van Sy, Phu Nhuan', 'Phan Van Tri, Go Vap', 'Tran Xuan Soan, Quan 7',
] as const

const petNames = [
  'Mochi', 'Biscuit', 'Cookie', 'Bun', 'Milo', 'Latte', 'Tofu', 'Sunny', 'Luna', 'Bobo',
  'Misa', 'Benji', 'Gau', 'Suri', 'Peanut', 'Mew', 'Pika', 'Kuma', 'Mint', 'Tiger',
  'Choco', 'Nori', 'Daisy', 'Neo', 'Mimi', 'Snow', 'Bambi', 'Olive', 'Rex', 'Mocha',
] as const

const dogBreeds = ['Poodle', 'Corgi', 'Pomeranian', 'Golden Retriever', 'Pug', 'Shiba', 'Samoyed', 'French Bulldog', 'Maltese', 'Mini Schnauzer'] as const
const catBreeds = ['British Shorthair', 'Munchkin', 'Siamese', 'Scottish Fold', 'Persian', 'Ragdoll', 'Bengal', 'British Longhair', 'Scottish Straight', 'American Curl'] as const

function addDays(base: Date, offset: number) {
  const value = new Date(base)
  value.setDate(value.getDate() + offset)
  return value
}

function setTime(base: Date, hour: number, minute = 0) {
  const value = new Date(base)
  value.setHours(hour, minute, 0, 0)
  return value
}

function sequentialCode(prefix: string, sequence: number, padLength = 6) {
  return `${prefix}${String(sequence).padStart(padLength, '0')}`
}

function orderNumber(date: Date, sequence: number) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `DH${y}${m}${d}${String(sequence).padStart(4, '0')}`
}

function hotelCode(date: Date, branchCode: string, sequence: number) {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `H${yy}${mm}${branchCode}${String(sequence).padStart(3, '0')}`
}

function groomingCode(date: Date, branchCode: string, sequence: number) {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `S${yy}${mm}${branchCode}${String(sequence).padStart(3, '0')}`
}

function voucher(type: 'INCOME' | 'EXPENSE', date: Date, sequence: number) {
  const prefix = type === 'INCOME' ? 'PT' : 'PC'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${prefix}${y}${m}${d}${String(sequence).padStart(4, '0')}`
}

function procurementNumber(prefix: string, date: Date, sequence: number, padLength = 3) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${prefix}${y}${m}${d}${String(sequence).padStart(padLength, '0')}`
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

async function main() {
  console.log('Seeding standardized demo data...')
  await prisma.refreshToken.deleteMany()

  await prisma.$transaction([
    prisma.transaction.deleteMany(),
    prisma.orderPayment.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.groomingSession.deleteMany(),
    prisma.hotelStay.deleteMany(),
    prisma.supplierReturnRefund.deleteMany(),
    prisma.supplierReturnItem.deleteMany(),
    prisma.supplierReturn.deleteMany(),
    prisma.supplierPaymentAllocation.deleteMany(),
    prisma.supplierPayment.deleteMany(),
    prisma.stockReceiptReceiveItem.deleteMany(),
    prisma.stockReceiptReceive.deleteMany(),
    prisma.stockTransaction.deleteMany(),
    prisma.stockReceiptItem.deleteMany(),
    prisma.stockReceipt.deleteMany(),
    prisma.branchStock.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.serviceVariant.deleteMany(),
    prisma.service.deleteMany(),
    prisma.product.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.petVaccination.deleteMany(),
    prisma.petWeightLog.deleteMany(),
    prisma.petHealthNote.deleteMany(),
    prisma.pet.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.customerGroup.deleteMany(),
    prisma.hotelRateTable.deleteMany(),
    prisma.cage.deleteMany(),
    prisma.priceBook.deleteMany(),
    prisma.category.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.unit.deleteMany(),
  ])

  const branchMap = new Map<string, any>()
  for (const seed of branchSeeds) {
    const branch = await prisma.branch.upsert({
      where: { id: seed.id },
      update: { code: seed.code, name: seed.name, address: seed.address, phone: seed.phone, email: seed.email, isMain: seed.isMain, isActive: true } as any,
      create: { ...seed, isActive: true } as any,
    })
    branchMap.set(seed.code, branch)
  }

  const roleMap = new Map<string, any>()
  for (const seed of roleSeeds) {
    const role = await prisma.role.upsert({
      where: { code: seed.code },
      update: { name: seed.name, isSystem: seed.isSystem, permissions: seed.permissions as any } as any,
      create: { ...seed, description: `${seed.name} standard role` } as any,
    })
    roleMap.set(seed.code, role)
  }

  await prisma.systemConfig.upsert({
    where: { id: 'system-config-main' },
    update: {
      shopName: 'PetCare Unified Demo',
      shopPhone: '02871008888',
      shopAddress: '12 Nguyen Hue, Quan 1, TP HCM',
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      loyaltySpendPerPoint: 1000,
      loyaltyPointValue: 100,
      loyaltyPointExpiryMonths: 24,
      loyaltyTierRetentionMonths: 12,
    } as any,
    create: {
      id: 'system-config-main',
      shopName: 'PetCare Unified Demo',
      shopPhone: '02871008888',
      shopAddress: '12 Nguyen Hue, Quan 1, TP HCM',
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      loyaltySpendPerPoint: 1000,
      loyaltyPointValue: 100,
      loyaltyPointExpiryMonths: 24,
      loyaltyTierRetentionMonths: 12,
    } as any,
  })

  const hashes = {
    admin: await bcrypt.hash('Admin@123', 12),
    staff: await bcrypt.hash('Staff@123', 12),
  }

  const userSeeds = [
    { username: 'superadmin', staffCode: 'NV00001', fullName: 'Super Admin', roleCode: 'SUPER_ADMIN', branchCode: 'MAIN', legacyRole: 'SUPER_ADMIN', passwordHash: hashes.admin },
    { username: 'admin', staffCode: 'NV00002', fullName: 'Admin He Thong', roleCode: 'ADMIN', branchCode: 'MAIN', legacyRole: 'ADMIN', passwordHash: hashes.admin },
    { username: 'manager', staffCode: 'NV00003', fullName: 'Quan Ly Trung Tam', roleCode: 'MANAGER', branchCode: 'MAIN', legacyRole: 'MANAGER', passwordHash: hashes.staff },
    { username: 'cashier01', staffCode: 'NV00004', fullName: 'Thu Ngan Main', roleCode: 'STAFF', branchCode: 'MAIN', legacyRole: 'STAFF', passwordHash: hashes.staff },
    { username: 'groomer01', staffCode: 'NV00005', fullName: 'Ky Thuat Grooming 1', roleCode: 'STAFF', branchCode: 'BT', legacyRole: 'STAFF', passwordHash: hashes.staff },
    { username: 'groomer02', staffCode: 'NV00006', fullName: 'Ky Thuat Grooming 2', roleCode: 'STAFF', branchCode: 'Q7', legacyRole: 'STAFF', passwordHash: hashes.staff },
    { username: 'hotel01', staffCode: 'NV00007', fullName: 'Dieu Phoi Hotel 1', roleCode: 'STAFF', branchCode: 'MAIN', legacyRole: 'STAFF', passwordHash: hashes.staff },
    { username: 'hotel02', staffCode: 'NV00008', fullName: 'Dieu Phoi Hotel 2', roleCode: 'STAFF', branchCode: 'BT', legacyRole: 'STAFF', passwordHash: hashes.staff },
  ] as const

  const userMap = new Map<string, any>()
  for (const seed of userSeeds) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: seed.username }, { staffCode: seed.staffCode }],
      },
    })

    const payload = {
      username: seed.username,
      staffCode: seed.staffCode,
      passwordHash: seed.passwordHash,
      fullName: seed.fullName,
      legacyRole: seed.legacyRole as any,
      roleId: roleMap.get(seed.roleCode).id,
      status: 'WORKING',
      employmentType: 'FULL_TIME',
      branchId: branchMap.get(seed.branchCode).id,
      joinDate: new Date('2025-01-01T09:00:00+07:00'),
    }

    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: payload as any })
      : await prisma.user.create({ data: payload as any })
    userMap.set(seed.username, user)
  }

  await prisma.category.createMany({ data: ['Thuc an', 'Ve sinh', 'Phu kien', 'Cham soc', 'Thuoc'].map((name) => ({ name, description: `${name} standard demo category` })) as any[] })
  await prisma.brand.createMany({ data: ['Royal Canin', 'SmartHeart', 'Me O', 'Bio Care', 'PetStyle', 'Virbac', 'Dr Pet'].map((name) => ({ name })) as any[] })
  await prisma.unit.createMany({ data: ['goi', 'chai', 'hop', 'cai', 'thanh'].map((name) => ({ name, description: `${name} unit` })) as any[] })
  await prisma.priceBook.createMany({
    data: [
      { name: 'Gia le toan he thong', channel: 'POS', isDefault: true, isActive: true, sortOrder: 1 },
      { name: 'Gia combo grooming', channel: 'SPA', isDefault: false, isActive: true, sortOrder: 2 },
      { name: 'Gia luu tru qua dem', channel: 'HOTEL', isDefault: false, isActive: true, sortOrder: 3 },
    ] as any[],
  })

  const groupMap = new Map<string, any>()
  for (const seed of customerGroups) {
    const group = await prisma.customerGroup.create({
      data: { name: seed.name, color: seed.color, discount: seed.discount, pricePolicy: seed.pricePolicy, isDefault: seed.isDefault, description: `${seed.name} standard demo group` } as any,
    })
    groupMap.set(seed.key, group)
  }

  const supplierMap = new Map<string, any>()
  for (const seed of supplierSeeds) {
    const supplier = await prisma.supplier.create({
      data: {
        name: seed.name,
        phone: seed.phone,
        email: seed.email,
        address: seed.address,
        notes: seed.notes,
        monthTarget: seed.monthTarget,
        yearTarget: seed.yearTarget,
        isActive: true,
      } as any,
    })
    supplierMap.set(seed.key, supplier)
  }

  const serviceMap = new Map<string, any>()
  const serviceSeeds = [
    { key: 'GROOM_BASIC', code: 'SVCGROOM001', name: 'Tam say co ban', type: 'GROOMING', price: 180000, duration: 60 },
    { key: 'GROOM_SMALL', code: 'SVCGROOM002', name: 'Cat tia cho nho', type: 'GROOMING', price: 250000, duration: 90 },
    { key: 'GROOM_LARGE', code: 'SVCGROOM003', name: 'Cat tia cho lon', type: 'GROOMING', price: 360000, duration: 120 },
    { key: 'GROOM_CAT', code: 'SVCGROOM004', name: 'Spa meo long ngan', type: 'GROOMING', price: 220000, duration: 75 },
    { key: 'GROOM_DETOX', code: 'SVCGROOM005', name: 'Spa detox da nhay cam', type: 'GROOMING', price: 320000, duration: 105 },
    { key: 'HOTEL_STD', code: 'SVCHOTEL001', name: 'Luu tru tieu chuan', type: 'HOTEL', price: 190000, duration: null },
    { key: 'HOTEL_CAT', code: 'SVCHOTEL002', name: 'Luu tru meo premium', type: 'HOTEL', price: 170000, duration: null },
    { key: 'HOTEL_VIP', code: 'SVCHOTEL003', name: 'Phong hotel dieu hoa', type: 'HOTEL', price: 260000, duration: null },
  ] as const
  for (const seed of serviceSeeds) {
    const service = await prisma.service.create({
      data: { name: seed.name, code: seed.code, type: seed.type as any, description: `${seed.name} standard demo service`, price: seed.price, duration: seed.duration, isActive: true } as any,
    })
    serviceMap.set(seed.key, service)
  }
  await prisma.serviceVariant.createMany({
    data: [
      { serviceId: serviceMap.get('GROOM_BASIC').id, name: 'Cho nho duoi 5kg', price: 180000, duration: 60 },
      { serviceId: serviceMap.get('GROOM_SMALL').id, name: 'Cho 5kg den 10kg', price: 250000, duration: 90 },
      { serviceId: serviceMap.get('GROOM_LARGE').id, name: 'Cho tren 10kg', price: 360000, duration: 120 },
      { serviceId: serviceMap.get('GROOM_CAT').id, name: 'Meo long ngan', price: 220000, duration: 75 },
      { serviceId: serviceMap.get('GROOM_DETOX').id, name: 'Da nhay cam', price: 320000, duration: 105 },
      { serviceId: serviceMap.get('HOTEL_STD').id, name: 'Chuong tieu chuan', price: 190000, duration: null },
      { serviceId: serviceMap.get('HOTEL_CAT').id, name: 'Phong meo premium', price: 170000, duration: null },
      { serviceId: serviceMap.get('HOTEL_VIP').id, name: 'Phong dieu hoa', price: 260000, duration: null },
    ] as any[],
  })

  const cageMap = new Map<string, any>()
  for (const [name, type] of [
    ['A01', 'REGULAR'], ['A02', 'REGULAR'], ['A03', 'REGULAR'],
    ['B01', 'REGULAR'], ['B02', 'REGULAR'], ['B03', 'REGULAR'],
    ['C01', 'REGULAR'], ['C02', 'REGULAR'], ['C03', 'REGULAR'],
    ['VIP01', 'HOLIDAY'], ['VIP02', 'HOLIDAY'], ['VIP03', 'HOLIDAY'],
  ] as const) {
    const cage = await prisma.cage.create({
      data: { name, type: type as any, description: `${name} standard hotel cage`, isActive: true } as any,
    })
    cageMap.set(name, cage)
  }

  const rateTableMap = new Map<string, any>()
  for (const seed of [
    { key: 'DOG_SMALL', name: 'Bang gia cho nho 2026', species: 'Cho', minWeight: 0, maxWeight: 5, lineType: 'REGULAR', ratePerNight: 190000 },
    { key: 'DOG_MEDIUM', name: 'Bang gia cho vua 2026', species: 'Cho', minWeight: 5, maxWeight: 12, lineType: 'REGULAR', ratePerNight: 220000 },
    { key: 'DOG_LARGE', name: 'Bang gia cho lon 2026', species: 'Cho', minWeight: 12, maxWeight: 35, lineType: 'REGULAR', ratePerNight: 260000 },
    { key: 'CAT_STD', name: 'Bang gia meo 2026', species: 'Meo', minWeight: 0, maxWeight: 10, lineType: 'REGULAR', ratePerNight: 170000 },
    { key: 'VIP_ALL', name: 'Bang gia phong VIP 2026', species: null, minWeight: 0, maxWeight: 40, lineType: 'HOLIDAY', ratePerNight: 320000 },
  ] as const) {
    const rate = await prisma.hotelRateTable.create({
      data: { name: seed.name, year: 2026, species: seed.species, minWeight: seed.minWeight, maxWeight: seed.maxWeight, lineType: seed.lineType as any, ratePerNight: seed.ratePerNight, isActive: true } as any,
    })
    rateTableMap.set(seed.key, rate)
  }

  const customerMap = new Map<string, any>()
  for (let index = 0; index < customerNames.length; index += 1) {
    const fullName = customerNames[index]!
    const code = sequentialCode('KH', index + 1)
    const groupKey = index % 6 === 0 ? 'VIP' : index % 4 === 0 ? 'HOTEL' : index % 3 === 0 ? 'SPA' : 'LOYAL'
    const customer = await prisma.customer.create({
      data: {
        customerCode: code,
        fullName,
        phone: `09010000${String(index + 1).padStart(2, '0')}`,
        email: `${fullName.toLowerCase().replace(/\s+/g, '.')}@petcare.local`,
        address: `${12 + index * 3} ${streets[index % streets.length]}`,
        tier: (index % 6 === 0 ? 'PLATINUM' : index % 4 === 0 ? 'GOLD' : index % 3 === 0 ? 'SILVER' : 'BRONZE') as any,
        points: 0,
        pointsUsed: index % 5 === 0 ? 40 : 0,
        groupId: groupMap.get(groupKey).id,
        notes: `Demo customer ${code}`,
        debt: 0,
        totalSpent: 0,
        totalOrders: 0,
        isActive: true,
        createdAt: setTime(addDays(NOW, -(30 - index)), 9 + (index % 6), 10),
      } as any,
    })
    customerMap.set(code, customer)
  }

  const petMap = new Map<string, any>()
  for (let index = 0; index < petNames.length; index += 1) {
    const name = petNames[index]!
    const code = sequentialCode('PET', index + 1)
    const customerCode = sequentialCode('KH', (index % customerNames.length) + 1)
    const species = index % 4 === 1 || index % 4 === 2 ? 'Meo' : 'Cho'
    const breed = species === 'Cho' ? dogBreeds[index % dogBreeds.length] : catBreeds[index % catBreeds.length]
    const pet = await prisma.pet.create({
      data: {
        petCode: code,
        name,
        species,
        breed,
        gender: (index % 2 === 0 ? 'MALE' : 'FEMALE') as any,
        dateOfBirth: addDays(NOW, -(260 + index * 9)),
        weight: species === 'Cho' ? 3 + (index % 8) * 2.1 : 2.8 + (index % 6) * 0.5,
        color: ['Kem', 'Trang', 'Xam', 'Nau', 'Vang', 'Socola'][index % 6],
        microchipId: index % 3 === 0 ? `MC${String(index + 1).padStart(8, '0')}` : null,
        notes: `Demo pet ${code}`,
        customerId: customerMap.get(customerCode).id,
        allergies: index % 5 === 0 ? 'Tranh sua tam mui manh' : null,
        temperament: ['Than thien', 'Tinh nghich', 'Diu', 'Canh giac'][index % 4],
        isActive: true,
        createdAt: setTime(addDays(NOW, -(24 - (index % 18))), 8 + (index % 8), 5),
      } as any,
    })
    petMap.set(code, pet)
    await prisma.petWeightLog.create({ data: { petId: pet.id, weight: pet.weight, date: addDays(NOW, -14), notes: 'Cap nhat can nang demo', createdAt: addDays(NOW, -14) } as any })
    await prisma.petVaccination.create({ data: { petId: pet.id, vaccineName: species === 'Cho' ? '7 in 1' : '4 in 1', date: addDays(NOW, -60), nextDueDate: addDays(NOW, 300), notes: 'Lich tiem demo', createdAt: addDays(NOW, -60) } as any })
    if (index % 2 === 0) {
      await prisma.petHealthNote.create({ data: { petId: pet.id, content: 'The trang on dinh, du dieu kien spa/hotel', date: addDays(NOW, -20), createdAt: addDays(NOW, -20) } as any })
    }
  }

  const productMap = new Map<string, any>()
  for (let index = 0; index < productSeeds.length; index += 1) {
    const seed = productSeeds[index]!
    const product = await prisma.product.create({
      data: {
        sku: seed[0],
        barcode: `89310000${String(index + 1).padStart(4, '0')}`,
        name: seed[1],
        category: seed[2],
        brand: seed[3],
        description: `${seed[1]} standard demo product`,
        unit: seed[4],
        price: seed[5],
        costPrice: seed[6],
        minStock: seed[7],
        supplierId: supplierMap.get(seed[8]).id,
        isActive: true,
        weight: seed[2] === 'Thuc an' ? 1.2 + (index % 4) * 0.5 : 0.4 + (index % 3) * 0.1,
        wholesalePrice: Math.round(seed[5] * 0.92),
        createdAt: setTime(addDays(NOW, -(40 - index)), 7 + (index % 6), 20),
      } as any,
    })
    productMap.set(seed[0], product)
    for (let branchIndex = 0; branchIndex < 3; branchIndex += 1) {
      const branchCode = (['MAIN', 'BT', 'Q7'] as const)[branchIndex]!
      await prisma.branchStock.create({
        data: {
          branchId: branchMap.get(branchCode).id,
          productId: product.id,
          stock: index % 6 === 0 && branchCode === 'Q7' ? 4 : 16 + ((index * 7 + branchIndex * 5) % 28),
          reservedStock: index % 5 === 0 ? 1 : 0,
          minStock: seed[7],
        } as any,
      })
    }
  }

  const products = Array.from(productMap.values())
  const orderCounts = new Map<string, number>()
  const incomeCounts = new Map<string, number>()
  const expenseCounts = new Map<string, number>()
  const groomingCounts = new Map<string, number>()
  const hotelCounts = new Map<string, number>()
  const customerStats = new Map<string, { totalSpent: number; totalOrders: number; debt: number }>()
  let receiptSequence = 1
  let receiveSequence = 1
  let paymentSequence = 1
  let returnSequence = 1
  let refundSequence = 1

  for (const customer of Array.from(customerMap.values())) customerStats.set(customer.id, { totalSpent: 0, totalOrders: 0, debt: 0 })

  const nextPerDay = (map: Map<string, number>, date: Date) => {
    const key = date.toISOString().slice(0, 10)
    const count = (map.get(key) ?? 0) + 1
    map.set(key, count)
    return count
  }

  const nextPerMonthBranch = (map: Map<string, number>, date: Date, branchCode: string) => {
    const key = `${branchCode}-${date.getFullYear()}-${date.getMonth() + 1}`
    const count = (map.get(key) ?? 0) + 1
    map.set(key, count)
    return count
  }

  for (let index = 0; index < 24; index += 1) {
    const createdAt = setTime(addDays(NOW, -(24 - index)), 8 + (index % 6), 15)
    const supplierKey = supplierSeeds[index % supplierSeeds.length]!.key
    const supplier = supplierMap.get(supplierKey)
    const branch = branchMap.get(branchSeeds[index % branchSeeds.length]!.code)
    const flow =
      index < 5
        ? 'FULLY_PAID'
        : index < 10
          ? 'FULLY_PARTIAL'
          : index < 14
            ? 'PARTIAL_RECEIVED'
            : index < 18
              ? 'SHORT_CLOSED'
              : index < 21
                ? 'PREPAID_DRAFT'
                : 'CANCELLED'
    const receiptNumber = procurementNumber('PO', createdAt, receiptSequence++)
    const items = Array.from({ length: 2 + (index % 3) }, (_, itemIndex) => {
      const product = products[(index * 2 + itemIndex) % products.length]!
      const quantity = 8 + ((index + itemIndex) % 6) * 2
      const unitPrice = product.costPrice ?? Math.round(product.price * 0.7)
      return {
        productId: product.id,
        productVariantId: null,
        quantity,
        unitPrice,
        totalPrice: quantity * unitPrice,
      }
    })
    const totalAmount = roundCurrency(items.reduce((sum, item) => sum + item.totalPrice, 0))
    const receipt = await prisma.stockReceipt.create({
      data: {
        receiptNumber,
        supplierId: supplier.id,
        branchId: branch.id,
        status: flow === 'CANCELLED' ? 'CANCELLED' : 'DRAFT',
        receiptStatus: flow === 'CANCELLED' ? 'CANCELLED' : 'DRAFT',
        paymentStatus: 'UNPAID',
        totalAmount,
        totalReceivedAmount: 0,
        totalReturnedAmount: 0,
        paidAmount: 0,
        notes: `Demo stock receipt ${receiptNumber} (${flow})`,
        createdAt,
        cancelledAt: flow === 'CANCELLED' ? setTime(createdAt, createdAt.getHours() + 1, 10) : null,
        items: { create: items },
      } as any,
      include: { items: true },
    })

    const receiptItems = receipt.items.map((item: any) => ({
      ...item,
      orderedQuantity: item.quantity,
      receivedQuantity: 0,
      returnedQuantity: 0,
      closedQuantity: 0,
    }))

    let totalReceivedAmount = 0
    let totalReturnedAmount = 0
    let paidAmount = 0
    let latestReceiveAt: Date | null = null
    let shortClosedAt: Date | null = null

    const createReceiveEvent = async (receivedAt: Date, ratios: number[]) => {
      const receiveItems = receiptItems
        .map((item, itemIndex) => {
          const remaining = item.orderedQuantity - item.receivedQuantity - item.closedQuantity
          const plannedQty = Math.min(remaining, Math.max(0, Math.round(item.orderedQuantity * ratios[itemIndex % ratios.length]!)))
          const quantity = item.receivedQuantity === 0 && plannedQty === 0 && remaining > 0 ? 1 : plannedQty
          return quantity > 0 && remaining > 0
            ? {
                item,
                quantity: Math.min(quantity, remaining),
                totalPrice: roundCurrency(Math.min(quantity, remaining) * item.unitPrice),
              }
            : null
        })
        .filter(Boolean) as Array<{ item: any; quantity: number; totalPrice: number }>

      if (receiveItems.length === 0) return

      await prisma.stockReceiptReceive.create({
        data: {
          receiveNumber: procurementNumber('RN', receivedAt, receiveSequence++),
          receiptId: receipt.id,
          branchId: branch.id,
          staffId: userMap.get(index % 2 === 0 ? 'manager' : 'cashier01').id,
          notes: `Ghi nhan nhap hang dot ${receiveSequence - 1} cho ${receipt.receiptNumber}`,
          receivedAt,
          totalQuantity: receiveItems.reduce((sum, entry) => sum + entry.quantity, 0),
          totalAmount: roundCurrency(receiveItems.reduce((sum, entry) => sum + entry.totalPrice, 0)),
          items: {
            create: receiveItems.map((entry) => ({
              receiptItemId: entry.item.id,
              productId: entry.item.productId,
              productVariantId: entry.item.productVariantId,
              quantity: entry.quantity,
              unitPrice: entry.item.unitPrice,
              totalPrice: entry.totalPrice,
            })),
          },
        } as any,
      })

      for (const entry of receiveItems) {
        entry.item.receivedQuantity += entry.quantity
        totalReceivedAmount = roundCurrency(totalReceivedAmount + entry.totalPrice)
        latestReceiveAt = receivedAt
        await prisma.stockReceiptItem.update({
          where: { id: entry.item.id },
          data: { receivedQuantity: { increment: entry.quantity } } as any,
        })
        await prisma.branchStock.updateMany({
          where: {
            branchId: branch.id,
            productId: entry.item.productId,
            productVariantId: entry.item.productVariantId,
          } as any,
          data: { stock: { increment: entry.quantity } } as any,
        })
        await prisma.stockTransaction.create({
          data: {
            productId: entry.item.productId,
            type: 'IN',
            quantity: entry.quantity,
            reason: `Nhap kho tu ${receipt.receiptNumber}`,
            referenceId: receipt.id,
            createdAt: receivedAt,
          } as any,
        })
      }
    }

    if (flow === 'FULLY_PAID' || flow === 'FULLY_PARTIAL') {
      if (index % 2 === 0) {
        await createReceiveEvent(setTime(createdAt, createdAt.getHours() + 2, 0), [0.55, 0.5, 0.6])
        await createReceiveEvent(addDays(setTime(createdAt, createdAt.getHours() + 2, 45), 1), [1, 1, 1])
      } else {
        await createReceiveEvent(setTime(createdAt, createdAt.getHours() + 3, 10), [1, 1, 1])
      }
    }
    if (flow === 'PARTIAL_RECEIVED') {
      await createReceiveEvent(setTime(createdAt, createdAt.getHours() + 2, 25), [0.45, 0.55, 0.5])
    }
    if (flow === 'SHORT_CLOSED') {
      await createReceiveEvent(setTime(createdAt, createdAt.getHours() + 1, 40), [0.65, 0.6, 0.7])
      const closableItems = receiptItems
        .map((item) => {
          const remaining = item.orderedQuantity - item.receivedQuantity - item.closedQuantity
          return remaining > 0 ? { item, quantity: remaining } : null
        })
        .filter(Boolean) as Array<{ item: any; quantity: number }>
      shortClosedAt = addDays(setTime(createdAt, createdAt.getHours() + 4, 5), 1)
      for (const entry of closableItems) {
        entry.item.closedQuantity += entry.quantity
        await prisma.stockReceiptItem.update({
          where: { id: entry.item.id },
          data: { closedQuantity: { increment: entry.quantity } } as any,
        })
      }
    }

    if ((flow === 'FULLY_PAID' || flow === 'FULLY_PARTIAL') && index % 4 === 1) {
      const returnAt = addDays(setTime(createdAt, createdAt.getHours() + 5, 10), 2)
      const returnItems = receiptItems
        .slice(0, 1)
        .map((item) => {
          const quantity = Math.min(2 + (index % 2), item.receivedQuantity)
          return quantity > 0
            ? {
                item,
                quantity,
                totalPrice: roundCurrency(quantity * item.unitPrice),
              }
            : null
        })
        .filter(Boolean) as Array<{ item: any; quantity: number; totalPrice: number }>

      if (returnItems.length > 0) {
        const supplierReturn = await prisma.supplierReturn.create({
          data: {
            returnNumber: procurementNumber('RT', returnAt, returnSequence++),
            receiptId: receipt.id,
            supplierId: supplier.id,
            branchId: branch.id,
            staffId: userMap.get('manager').id,
            notes: `Tra NCC do loi dong goi cho ${receipt.receiptNumber}`,
            totalAmount: roundCurrency(returnItems.reduce((sum, entry) => sum + entry.totalPrice, 0)),
            creditedAmount: roundCurrency(returnItems.reduce((sum, entry) => sum + entry.totalPrice, 0)),
            refundedAmount: 0,
            returnedAt: returnAt,
            items: {
              create: returnItems.map((entry) => ({
                receiptItemId: entry.item.id,
                productId: entry.item.productId,
                productVariantId: entry.item.productVariantId,
                quantity: entry.quantity,
                unitPrice: entry.item.unitPrice,
                totalPrice: entry.totalPrice,
                reason: 'Hang loi / khong lay nua',
              })),
            },
          } as any,
        })

        for (const entry of returnItems) {
          entry.item.returnedQuantity += entry.quantity
          totalReturnedAmount = roundCurrency(totalReturnedAmount + entry.totalPrice)
          await prisma.stockReceiptItem.update({
            where: { id: entry.item.id },
            data: { returnedQuantity: { increment: entry.quantity } } as any,
          })
          await prisma.branchStock.updateMany({
            where: {
              branchId: branch.id,
              productId: entry.item.productId,
              productVariantId: entry.item.productVariantId,
            } as any,
            data: { stock: { decrement: entry.quantity } } as any,
          })
          await prisma.stockTransaction.create({
            data: {
              productId: entry.item.productId,
              type: 'OUT',
              quantity: entry.quantity,
              reason: `Tra NCC ${supplierReturn.returnNumber}`,
              referenceId: supplierReturn.id,
              createdAt: returnAt,
            } as any,
          })
        }

        if (index % 8 === 1) {
          const refundAt = addDays(returnAt, 1)
          const refundAmount = index % 16 === 1
            ? supplierReturn.totalAmount
            : roundCurrency(supplierReturn.totalAmount * 0.6)
          const supplierRefund = await prisma.supplierReturnRefund.create({
            data: {
              refundNumber: procurementNumber('RF', refundAt, refundSequence++),
              supplierReturnId: supplierReturn.id,
              branchId: branch.id,
              staffId: userMap.get('cashier01').id,
              amount: refundAmount,
              paymentMethod: index % 2 === 0 ? 'BANK' : 'CASH',
              notes: `NCC hoan tien cho ${supplierReturn.returnNumber}`,
              receivedAt: refundAt,
            } as any,
          })
          await prisma.transaction.create({
            data: {
              voucherNumber: voucher('INCOME', refundAt, nextPerDay(incomeCounts, refundAt)),
              type: 'INCOME',
              amount: refundAmount,
              description: `Thu hoan tien NCC ${supplierReturn.returnNumber}`,
              category: 'Tra NCC',
              paymentMethod: supplierRefund.paymentMethod,
              branchId: branch.id,
              branchName: branch.name,
              refType: 'SUPPLIER_RETURN_REFUND',
              refId: supplierRefund.id,
              refNumber: supplierRefund.refundNumber,
              payerId: supplier.id,
              payerName: supplier.name,
              notes: supplierRefund.notes,
              source: 'SUPPLIER_RETURN',
              isManual: false,
              staffId: userMap.get('cashier01').id,
              date: refundAt,
              createdAt: refundAt,
            } as any,
          })
          await prisma.supplierReturn.update({
            where: { id: supplierReturn.id },
            data: { refundedAmount: refundAmount } as any,
          })
        }
      }
    }

    const payableAmount = roundCurrency(Math.max(0, totalReceivedAmount - totalReturnedAmount))
    const createSupplierPayment = async (amount: number, paidAt: Date, notes: string, allocateToReceipt: boolean) => {
      const normalizedAmount = roundCurrency(amount)
      if (normalizedAmount <= 0) return
      const appliedAmount = allocateToReceipt ? normalizedAmount : 0
      const supplierPayment = await prisma.supplierPayment.create({
        data: {
          paymentNumber: procurementNumber('SP', paidAt, paymentSequence++),
          supplierId: supplier.id,
          branchId: branch.id,
          staffId: userMap.get('cashier01').id,
          targetReceiptId: allocateToReceipt ? receipt.id : null,
          targetReceiptNumber: allocateToReceipt ? receipt.receiptNumber : null,
          amount: normalizedAmount,
          appliedAmount,
          unappliedAmount: roundCurrency(normalizedAmount - appliedAmount),
          paymentMethod: index % 2 === 0 ? 'BANK' : 'CASH',
          notes,
          paidAt,
        } as any,
      })
      if (allocateToReceipt && appliedAmount > 0) {
        await prisma.supplierPaymentAllocation.create({
          data: {
            paymentId: supplierPayment.id,
            receiptId: receipt.id,
            amount: appliedAmount,
          } as any,
        })
        paidAmount = roundCurrency(paidAmount + appliedAmount)
      }
      const transaction = await prisma.transaction.create({
        data: {
          voucherNumber: voucher('EXPENSE', paidAt, nextPerDay(expenseCounts, paidAt)),
          type: 'EXPENSE',
          amount: normalizedAmount,
          description: allocateToReceipt ? `Thanh toan NCC cho ${receipt.receiptNumber}` : `Tam ung NCC ${supplier.name}`,
          category: 'Nhap hang',
          paymentMethod: supplierPayment.paymentMethod,
          branchId: branch.id,
          branchName: branch.name,
          refType: 'SUPPLIER_PAYMENT',
          refId: supplierPayment.id,
          refNumber: supplierPayment.paymentNumber,
          payerId: supplier.id,
          payerName: supplier.name,
          notes,
          source: 'SUPPLIER_PAYMENT',
          isManual: false,
          staffId: userMap.get('cashier01').id,
          date: paidAt,
          createdAt: paidAt,
        } as any,
      })
      await prisma.supplierPayment.update({
        where: { id: supplierPayment.id },
        data: { transactionId: transaction.id } as any,
      })
    }

    if (flow === 'FULLY_PAID') {
      const firstAmount = roundCurrency(payableAmount * 0.55)
      const secondAmount = roundCurrency(payableAmount - firstAmount)
      await createSupplierPayment(firstAmount, addDays(setTime(createdAt, createdAt.getHours() + 6, 0), 1), `Dot 1 cho ${receipt.receiptNumber}`, true)
      await createSupplierPayment(secondAmount, addDays(setTime(createdAt, createdAt.getHours() + 9, 30), 2), `Dot 2 cho ${receipt.receiptNumber}`, true)
    } else if (flow === 'FULLY_PARTIAL') {
      await createSupplierPayment(roundCurrency(payableAmount * 0.62), addDays(setTime(createdAt, createdAt.getHours() + 5, 20), 1), `Thanh toan mot phan ${receipt.receiptNumber}`, true)
    } else if (flow === 'PARTIAL_RECEIVED') {
      await createSupplierPayment(roundCurrency(payableAmount * 0.45), addDays(setTime(createdAt, createdAt.getHours() + 4, 35), 1), `Dat coc sau nhap dot dau ${receipt.receiptNumber}`, true)
    } else if (flow === 'SHORT_CLOSED') {
      await createSupplierPayment(roundCurrency(payableAmount * (index % 2 === 0 ? 1 : 0.7)), addDays(setTime(createdAt, createdAt.getHours() + 7, 0), 1), `Doi chieu chot thieu ${receipt.receiptNumber}`, true)
    } else if (flow === 'PREPAID_DRAFT') {
      await createSupplierPayment(roundCurrency(totalAmount * 0.3), setTime(createdAt, createdAt.getHours() + 2, 10), `Tam ung truoc cho ${receipt.receiptNumber}`, false)
    }

    const allFulfilled = receiptItems.every((item) => item.receivedQuantity + item.closedQuantity >= item.orderedQuantity)
    const hasAnyReceive = receiptItems.some((item) => item.receivedQuantity > 0)
    const hasAnyClose = receiptItems.some((item) => item.closedQuantity > 0)
    const receiptStatus =
      flow === 'CANCELLED'
        ? 'CANCELLED'
        : allFulfilled && hasAnyClose
          ? 'SHORT_CLOSED'
          : allFulfilled && hasAnyReceive
            ? 'FULL_RECEIVED'
            : hasAnyReceive
              ? 'PARTIAL_RECEIVED'
              : 'DRAFT'
    const paymentStatus =
      payableAmount <= 0
        ? paidAmount > 0
          ? 'PAID'
          : 'UNPAID'
        : paidAmount <= 0
          ? 'UNPAID'
          : paidAmount < payableAmount
            ? 'PARTIAL'
            : 'PAID'

    await prisma.stockReceipt.update({
      where: { id: receipt.id },
      data: {
        status: receiptStatus === 'CANCELLED' ? 'CANCELLED' : receiptStatus === 'DRAFT' ? 'DRAFT' : 'RECEIVED',
        receiptStatus,
        paymentStatus: paymentStatus as any,
        totalAmount,
        totalReceivedAmount,
        totalReturnedAmount,
        paidAmount,
        receivedAt: latestReceiveAt,
        completedAt: receiptStatus === 'FULL_RECEIVED' || receiptStatus === 'SHORT_CLOSED' ? latestReceiveAt ?? shortClosedAt : null,
        shortClosedAt,
      } as any,
    })
  }

  for (const seed of supplierSeeds) {
    const supplier = supplierMap.get(seed.key)
    const receipts = await prisma.stockReceipt.findMany({
      where: { supplierId: supplier.id },
      select: {
        paidAmount: true,
        totalReceivedAmount: true,
        totalReturnedAmount: true,
        status: true,
        receiptStatus: true,
      },
    })
    const payments = await prisma.supplierPayment.findMany({
      where: { supplierId: supplier.id },
      select: { unappliedAmount: true },
    })
    const returns = await prisma.supplierReturn.findMany({
      where: { supplierId: supplier.id },
      select: {
        creditedAmount: true,
        refundedAmount: true,
      },
    })

    const debt = roundCurrency(
      receipts.reduce((sum: number, stockReceipt: any) => {
        if (stockReceipt.status === 'CANCELLED' || stockReceipt.receiptStatus === 'CANCELLED') return sum
        const payable = Math.max(0, Number(stockReceipt.totalReceivedAmount ?? 0) - Number(stockReceipt.totalReturnedAmount ?? 0))
        return sum + Math.max(0, payable - Number(stockReceipt.paidAmount ?? 0))
      }, 0),
    )
    const paymentCredit = roundCurrency(
      payments.reduce((sum: number, payment: any) => sum + Number(payment.unappliedAmount ?? 0), 0),
    )
    const returnCredit = roundCurrency(
      returns.reduce(
        (sum: number, supplierReturn: any) =>
          sum + Math.max(0, Number(supplierReturn.creditedAmount ?? 0) - Number(supplierReturn.refundedAmount ?? 0)),
        0,
      ),
    )

    await prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        debt,
        creditBalance: roundCurrency(paymentCredit + returnCredit),
      } as any,
    })
  }

  const pets = Array.from(petMap.values())
  const groomingKeys = ['GROOM_BASIC', 'GROOM_SMALL', 'GROOM_LARGE', 'GROOM_CAT', 'GROOM_DETOX'] as const
  const hotelKeys = ['HOTEL_STD', 'HOTEL_CAT', 'HOTEL_VIP'] as const
  const salesUsers = ['cashier01', 'manager', 'groomer01', 'hotel01'] as const

  for (let index = 0; index < 24; index += 1) {
    const createdAt = setTime(addDays(NOW, -(12 - Math.floor(index / 2))), 9 + (index % 6), 20)
    const customer = customerMap.get(sequentialCode('KH', (index % customerNames.length) + 1))
    const branchCode = branchSeeds[index % branchSeeds.length]!.code
    const branch = branchMap.get(branchCode)
    const staff = userMap.get(salesUsers[index % salesUsers.length]!)
    const type = index % 3
    const items: any[] = []
    let status: 'PENDING' | 'COMPLETED' | 'CANCELLED'
    let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID'

    if (type === 0) {
      const a = products[(index * 2) % products.length]!
      const b = products[(index * 2 + 3) % products.length]!
      items.push({ type: 'product', description: a.name, quantity: 1 + (index % 2), unitPrice: a.price, subtotal: (1 + (index % 2)) * a.price, productId: a.id, petId: null })
      items.push({ type: 'product', description: b.name, quantity: 1, unitPrice: b.price, subtotal: b.price, productId: b.id, petId: null })
      status = index % 6 === 0 ? 'CANCELLED' : 'COMPLETED'
      paymentStatus = status === 'CANCELLED' ? 'UNPAID' : index % 5 === 0 ? 'PARTIAL' : 'PAID'
    } else if (type === 1) {
      const pet = pets[(index * 2) % pets.length]!
      const addon = products[(index + 5) % products.length]!
      const service = serviceMap.get(groomingKeys[index % groomingKeys.length]!)
      items.push({ type: 'grooming', description: `${service.name} - ${pet.name}`, quantity: 1, unitPrice: service.price, subtotal: service.price, serviceId: service.id, petId: pet.id })
      items.push({ type: 'product', description: addon.name, quantity: 1, unitPrice: addon.price, subtotal: addon.price, productId: addon.id, petId: pet.id })
      status = index % 4 === 0 ? 'PENDING' : 'COMPLETED'
      paymentStatus = status === 'COMPLETED' ? 'PAID' : index % 2 === 0 ? 'PARTIAL' : 'UNPAID'
    } else {
      const pet = pets[(index * 2 + 1) % pets.length]!
      const service = serviceMap.get(hotelKeys[index % hotelKeys.length]!)
      const nights = 2 + (index % 3)
      items.push({ type: 'hotel', description: `${service.name} - ${pet.name} ${nights} dem`, quantity: nights, unitPrice: service.price, subtotal: nights * service.price, serviceId: service.id, petId: pet.id, nights })
      status = index % 5 === 0 ? 'PENDING' : 'COMPLETED'
      paymentStatus = status === 'COMPLETED' ? 'PAID' : 'PARTIAL'
    }

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    const discount = type === 2 ? 30000 : type === 1 ? 15000 : 0
    const shippingFee = type === 0 && index % 4 === 0 ? 20000 : 0
    const total = subtotal - discount + shippingFee
    const paidAmount = paymentStatus === 'PAID' ? total : paymentStatus === 'PARTIAL' ? Math.round(total * 0.6) : 0
    const remainingAmount = Math.max(0, total - paidAmount)
    const order = await prisma.order.create({
      data: { orderNumber: orderNumber(createdAt, nextPerDay(orderCounts, createdAt)), customerId: customer.id, customerName: customer.fullName, staffId: staff.id, branchId: branch.id, status: status as any, paymentStatus: paymentStatus as any, subtotal, discount, shippingFee, total, paidAmount, remainingAmount, notes: 'Standardized demo order', createdAt } as any,
    })

    const createdItems: any[] = []
    for (const item of items) {
      const createdItem = await prisma.orderItem.create({ data: { orderId: order.id, productId: item.productId ?? null, serviceId: item.serviceId ?? null, petId: item.petId ?? null, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, discountItem: 0, vatRate: 0, subtotal: item.subtotal, type: item.type, createdAt } as any })
      createdItems.push({ ...createdItem, source: item })
      if (item.type === 'product' && status === 'COMPLETED') {
        await prisma.stockTransaction.create({ data: { productId: item.productId, type: 'OUT', quantity: item.quantity, reason: `Ban hang ${order.orderNumber}`, referenceId: order.id, createdAt } as any })
      }
    }

    if (type === 1) {
      const serviceItem = createdItems.find((item) => item.type === 'grooming')
      const pet = pets.find((candidate) => candidate.id === serviceItem.source.petId)!
      const sessionStatus = status === 'COMPLETED' ? 'COMPLETED' : index % 2 === 0 ? 'IN_PROGRESS' : 'PENDING'
      const session = await prisma.groomingSession.create({
        data: { sessionCode: groomingCode(createdAt, branchCode, nextPerMonthBranch(groomingCounts, createdAt, branchCode)), petId: pet.id, petName: pet.name, customerId: pet.customerId, branchId: branch.id, staffId: userMap.get(index % 2 === 0 ? 'groomer01' : 'groomer02').id, serviceId: serviceItem.source.serviceId, orderId: order.id, status: sessionStatus as any, startTime: setTime(createdAt, createdAt.getHours(), 35), endTime: sessionStatus === 'COMPLETED' ? setTime(createdAt, createdAt.getHours() + 1, 40) : null, notes: 'Linked grooming session', price: serviceItem.subtotal, createdAt } as any,
      })
      await prisma.orderItem.update({ where: { id: serviceItem.id }, data: { groomingSessionId: session.id } as any })
    }

    if (type === 2) {
      const serviceItem = createdItems.find((item) => item.type === 'hotel')
      const pet = pets.find((candidate) => candidate.id === serviceItem.source.petId)!
      const rate = pet.species === 'Meo' ? rateTableMap.get('CAT_STD') : pet.weight <= 5 ? rateTableMap.get('DOG_SMALL') : pet.weight <= 12 ? rateTableMap.get('DOG_MEDIUM') : rateTableMap.get('DOG_LARGE')
      const lineType = index % 5 === 0 ? 'HOLIDAY' : 'REGULAR'
      const stayStatus = status === 'COMPLETED' ? 'CHECKED_OUT' : index % 2 === 0 ? 'CHECKED_IN' : 'BOOKED'
      const stay = await prisma.hotelStay.create({
        data: { stayCode: hotelCode(createdAt, branchCode, nextPerMonthBranch(hotelCounts, createdAt, branchCode)), petId: pet.id, petName: pet.name, customerId: pet.customerId, cageId: cageMap.get(pet.species === 'Meo' ? `C0${(index % 3) + 1}` : lineType === 'HOLIDAY' ? `VIP0${(index % 3) + 1}` : `B0${(index % 3) + 1}`).id, checkIn: createdAt, estimatedCheckOut: addDays(createdAt, serviceItem.source.nights), checkOutActual: stayStatus === 'CHECKED_OUT' ? addDays(createdAt, serviceItem.source.nights) : null, status: stayStatus as any, lineType: lineType as any, price: serviceItem.subtotal, paymentStatus: paymentStatus as any, notes: 'Linked hotel stay', rateTableId: rate.id, orderId: order.id, branchId: branch.id, dailyRate: rate.ratePerNight, depositAmount: paymentStatus === 'UNPAID' ? 0 : Math.round(serviceItem.subtotal * 0.3), promotion: discount, surcharge: lineType === 'HOLIDAY' ? 25000 : 0, totalPrice: serviceItem.subtotal, createdAt } as any,
      })
      await prisma.orderItem.update({ where: { id: serviceItem.id }, data: { hotelStayId: stay.id } as any })
    }

    if (paidAmount > 0) {
      const method = index % 4 === 0 ? 'BANK' : index % 4 === 1 ? 'CASH' : index % 4 === 2 ? 'MOMO' : 'CARD'
      await prisma.orderPayment.create({ data: { orderId: order.id, method, amount: paidAmount, createdAt } as any })
      await prisma.transaction.create({ data: { voucherNumber: voucher('INCOME', createdAt, nextPerDay(incomeCounts, createdAt)), type: 'INCOME', amount: paidAmount, description: `Thu tien don ${order.orderNumber}`, category: type === 0 ? 'Ban hang' : type === 1 ? 'Grooming' : 'Hotel', paymentMethod: method, branchId: branch.id, branchName: branch.name, orderId: order.id, refType: 'ORDER', refId: order.id, refNumber: order.orderNumber, payerId: customer.id, payerName: customer.fullName, notes: 'Demo payment', source: 'ORDER_PAYMENT', isManual: false, staffId: staff.id, date: createdAt, createdAt } as any })
    }

    const stats = customerStats.get(customer.id)!
    if (status === 'COMPLETED') {
      stats.totalSpent += total
      stats.totalOrders += 1
    }
    if (status !== 'CANCELLED' && remainingAmount > 0) stats.debt += remainingAmount
  }

  for (let index = 0; index < 16; index += 1) {
    const createdAt = setTime(addDays(NOW, -(15 - index)), 10 + (index % 5), 5)
    const pet = pets[(index + 6) % pets.length]!
    const branchCode = branchSeeds[(index + 1) % branchSeeds.length]!.code
    await prisma.groomingSession.create({
      data: { sessionCode: groomingCode(createdAt, branchCode, nextPerMonthBranch(groomingCounts, createdAt, branchCode)), petId: pet.id, petName: pet.name, customerId: pet.customerId, branchId: branchMap.get(branchCode).id, staffId: userMap.get(index % 2 === 0 ? 'groomer01' : 'groomer02').id, serviceId: serviceMap.get(groomingKeys[index % groomingKeys.length]!).id, status: (index < 7 ? 'COMPLETED' : index < 11 ? 'IN_PROGRESS' : index < 14 ? 'PENDING' : 'CANCELLED') as any, startTime: setTime(createdAt, createdAt.getHours(), 20), endTime: index < 7 ? setTime(createdAt, createdAt.getHours() + 1, 30) : null, notes: 'Standalone grooming demo', price: 190000 + (index % 5) * 30000, createdAt } as any,
    })
  }

  for (let index = 0; index < 18; index += 1) {
    const createdAt = setTime(addDays(NOW, -(18 - index)), 11 + (index % 4), 10)
    const pet = pets[(index + 8) % pets.length]!
    const branchCode = branchSeeds[(index + 2) % branchSeeds.length]!.code
    const rate = pet.species === 'Meo' ? rateTableMap.get('CAT_STD') : pet.weight <= 5 ? rateTableMap.get('DOG_SMALL') : pet.weight <= 12 ? rateTableMap.get('DOG_MEDIUM') : rateTableMap.get('DOG_LARGE')
    const lineType = index % 6 === 0 ? 'HOLIDAY' : 'REGULAR'
    const nights = 1 + (index % 4)
    const totalPrice = nights * rate.ratePerNight + (lineType === 'HOLIDAY' ? 30000 : 0) - (index % 4 === 0 ? 20000 : 0)
    await prisma.hotelStay.create({
      data: { stayCode: hotelCode(createdAt, branchCode, nextPerMonthBranch(hotelCounts, createdAt, branchCode)), petId: pet.id, petName: pet.name, customerId: pet.customerId, cageId: cageMap.get(pet.species === 'Meo' ? `C0${(index % 3) + 1}` : lineType === 'HOLIDAY' ? `VIP0${(index % 3) + 1}` : `A0${(index % 3) + 1}`).id, checkIn: createdAt, estimatedCheckOut: addDays(createdAt, nights), checkOutActual: index < 8 ? addDays(createdAt, nights) : null, status: (index < 8 ? 'CHECKED_OUT' : index < 13 ? 'CHECKED_IN' : index < 16 ? 'BOOKED' : 'CANCELLED') as any, lineType: lineType as any, price: totalPrice, paymentStatus: (index < 16 ? 'PAID' : 'UNPAID') as any, notes: 'Standalone hotel demo', rateTableId: rate.id, branchId: branchMap.get(branchCode).id, dailyRate: rate.ratePerNight, depositAmount: Math.round(totalPrice * 0.3), promotion: index % 4 === 0 ? 20000 : 0, surcharge: lineType === 'HOLIDAY' ? 30000 : 0, totalPrice, createdAt } as any,
    })
  }

  for (let index = 0; index < customerNames.length; index += 1) {
    const customer = customerMap.get(sequentialCode('KH', index + 1))
    const stats = customerStats.get(customer.id)!
    await prisma.customer.update({ where: { id: customer.id }, data: { totalSpent: Math.round(stats.totalSpent), totalOrders: stats.totalOrders, debt: Math.round(stats.debt), points: Math.floor(stats.totalSpent / 10000) + (index % 6 === 0 ? 120 : index % 4 === 0 ? 80 : 40) } as any })
  }

  console.log('Seeded customers: 24')
  console.log('Seeded pets: 30')
  console.log('Seeded products: 24')
  console.log('Seeded stock receipts: 24')
  console.log('Seeded grooming sessions: 24')
  console.log('Seeded hotel stays: 24')
  console.log('Seeded orders: 24')
  console.log('Login: superadmin/admin => Admin@123 | manager/cashier01/groomer01/hotel01 => Staff@123')
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
