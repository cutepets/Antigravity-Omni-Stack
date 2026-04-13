import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DEMO_PREFIX = 'ANL'

type DemoBatch = {
  receivedAt: Date
  quantity: number
  sellDays: number
  soldQuantity?: number
}

type DemoProduct = {
  sku: string
  name: string
  category: string
  brand: string
  unit: string
  price: number
  costPrice: number
  minStock: number
  batches: DemoBatch[]
}

const demoProducts: DemoProduct[] = [
  {
    sku: 'INVAN001',
    name: 'Demo shampoo turnover 500ml',
    category: 'Ve sinh',
    brand: 'Analytics Demo',
    unit: 'chai',
    price: 129000,
    costPrice: 79000,
    minStock: 18,
    batches: [
      { receivedAt: new Date('2025-11-05T09:00:00+07:00'), quantity: 60, sellDays: 12 },
      { receivedAt: new Date('2025-12-10T09:00:00+07:00'), quantity: 80, sellDays: 15 },
      { receivedAt: new Date('2026-01-08T09:00:00+07:00'), quantity: 70, sellDays: 10 },
      { receivedAt: new Date('2026-02-18T09:00:00+07:00'), quantity: 90, sellDays: 18 },
      { receivedAt: new Date('2026-03-22T09:00:00+07:00'), quantity: 110, sellDays: 16 },
      { receivedAt: new Date('2026-04-05T09:00:00+07:00'), quantity: 100, sellDays: 14, soldQuantity: 35 },
    ],
  },
  {
    sku: 'INVAN002',
    name: 'Demo cat litter 10L',
    category: 'Ve sinh',
    brand: 'Analytics Demo',
    unit: 'goi',
    price: 155000,
    costPrice: 99000,
    minStock: 20,
    batches: [
      { receivedAt: new Date('2025-11-14T09:00:00+07:00'), quantity: 120, sellDays: 20 },
      { receivedAt: new Date('2026-01-20T09:00:00+07:00'), quantity: 100, sellDays: 14 },
      { receivedAt: new Date('2026-04-02T09:00:00+07:00'), quantity: 140, sellDays: 18, soldQuantity: 40 },
    ],
  },
  {
    sku: 'INVAN003',
    name: 'Demo accessory slow mover',
    category: 'Phu kien',
    brand: 'Analytics Demo',
    unit: 'cai',
    price: 219000,
    costPrice: 143000,
    minStock: 8,
    batches: [
      { receivedAt: new Date('2025-11-28T09:00:00+07:00'), quantity: 28, sellDays: 26 },
      { receivedAt: new Date('2026-01-12T09:00:00+07:00'), quantity: 24, sellDays: 22 },
      { receivedAt: new Date('2026-03-03T09:00:00+07:00'), quantity: 36, sellDays: 28 },
      { receivedAt: new Date('2026-04-08T09:00:00+07:00'), quantity: 30, sellDays: 16, soldQuantity: 9 },
    ],
  },
]

function procurementNumber(prefix: string, date: Date, sequence: number) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${prefix}${year}${month}${day}${String(sequence).padStart(3, '0')}`
}

function addDays(base: Date, offset: number) {
  const value = new Date(base)
  value.setDate(value.getDate() + offset)
  return value
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function getSalesKey(productId: string) {
  return `product:${productId}`
}

function spreadQuantity(totalQuantity: number, days: number) {
  const safeDays = Math.max(1, days)
  const baseQuantity = Math.floor(totalQuantity / safeDays)
  let remainder = totalQuantity % safeDays

  return Array.from({ length: safeDays }, () => {
    const value = baseQuantity + (remainder > 0 ? 1 : 0)
    remainder = Math.max(0, remainder - 1)
    return value
  })
}

async function ensureBranch() {
  const branch = await prisma.branch.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  if (!branch) {
    throw new Error('Khong tim thay chi nhanh nao. Hay seed he thong truoc.')
  }

  return branch
}

async function ensureSupplier() {
  const existing = await prisma.supplier.findFirst({
    where: { name: 'Inventory Analytics Demo Supplier' },
  })

  if (existing) return existing

  return prisma.supplier.create({
    data: {
      name: 'Inventory Analytics Demo Supplier',
      phone: '0909000999',
      email: 'inventory.analytics.demo@petcare.local',
      address: 'Kho demo analytics',
      notes: 'Supplier phuc vu seed du lieu inventory analytics',
      isActive: true,
    } as any,
  })
}

async function seedProduct(branch: { id: string }, supplier: { id: string }, productSeed: DemoProduct) {
  const product = await prisma.product.upsert({
    where: { sku: productSeed.sku },
    update: {
      name: productSeed.name,
      category: productSeed.category,
      brand: productSeed.brand,
      unit: productSeed.unit,
      price: productSeed.price,
      costPrice: productSeed.costPrice,
      minStock: productSeed.minStock,
      supplierId: supplier.id,
      isActive: true,
      deletedAt: null,
    } as any,
    create: {
      name: productSeed.name,
      sku: productSeed.sku,
      category: productSeed.category,
      brand: productSeed.brand,
      unit: productSeed.unit,
      price: productSeed.price,
      costPrice: productSeed.costPrice,
      minStock: productSeed.minStock,
      supplierId: supplier.id,
      isActive: true,
    } as any,
  })

  await prisma.productSalesDaily.deleteMany({
    where: {
      productId: product.id,
      branchId: branch.id,
    },
  })

  await prisma.stockReceipt.deleteMany({
    where: {
      receiptNumber: {
        startsWith: `${DEMO_PREFIX}-${productSeed.sku}-`,
      },
    },
  })

  let totalReceived = 0
  let totalSold = 0

  for (let index = 0; index < productSeed.batches.length; index += 1) {
    const batch = productSeed.batches[index]!
    const quantity = batch.quantity
    const soldQuantity = Math.min(quantity, Math.max(0, batch.soldQuantity ?? quantity))
    const totalAmount = roundCurrency(quantity * productSeed.costPrice)

    const receipt = await prisma.stockReceipt.create({
      data: {
        receiptNumber: `${DEMO_PREFIX}-${productSeed.sku}-${String(index + 1).padStart(2, '0')}`,
        supplierId: supplier.id,
        branchId: branch.id,
        status: 'RECEIVED',
        receiptStatus: 'FULL_RECEIVED',
        paymentStatus: 'PAID',
        totalAmount,
        totalReceivedAmount: totalAmount,
        paidAmount: totalAmount,
        notes: 'Demo inventory analytics batch',
        receivedAt: batch.receivedAt,
        completedAt: batch.receivedAt,
      } as any,
    })

    const receiptItem = await prisma.stockReceiptItem.create({
      data: {
        receiptId: receipt.id,
        productId: product.id,
        quantity,
        receivedQuantity: quantity,
        unitPrice: productSeed.costPrice,
        totalPrice: totalAmount,
      } as any,
    })

    const receiveEvent = await prisma.stockReceiptReceive.create({
      data: {
        receiveNumber: procurementNumber(`${DEMO_PREFIX}R`, batch.receivedAt, index + 1),
        receiptId: receipt.id,
        branchId: branch.id,
        notes: 'Demo inventory analytics receive',
        receivedAt: batch.receivedAt,
        totalQuantity: quantity,
        totalAmount,
      } as any,
    })

    await prisma.stockReceiptReceiveItem.create({
      data: {
        receiveId: receiveEvent.id,
        receiptItemId: receiptItem.id,
        productId: product.id,
        quantity,
        unitPrice: productSeed.costPrice,
        totalPrice: totalAmount,
      } as any,
    })

    const dailySpread = spreadQuantity(soldQuantity, batch.sellDays)
    for (let dayIndex = 0; dayIndex < dailySpread.length; dayIndex += 1) {
      const dayQuantity = dailySpread[dayIndex]!
      const salesDate = addDays(batch.receivedAt, dayIndex)
      salesDate.setHours(0, 0, 0, 0)

      await prisma.productSalesDaily.upsert({
        where: {
          date_branchScope_salesKey: {
            date: salesDate,
            branchScope: branch.id,
            salesKey: getSalesKey(product.id),
          },
        },
        create: {
          date: salesDate,
          branchId: branch.id,
          branchScope: branch.id,
          productId: product.id,
          salesKey: getSalesKey(product.id),
          quantitySold: dayQuantity,
          revenue: roundCurrency(dayQuantity * productSeed.price),
        } as any,
        update: {
          quantitySold: { increment: dayQuantity },
          revenue: { increment: roundCurrency(dayQuantity * productSeed.price) },
        } as any,
      })
    }

    totalReceived += quantity
    totalSold += soldQuantity
  }

  await prisma.branchStock.upsert({
    where: {
      branchId_productId_productVariantId: {
        branchId: branch.id,
        productId: product.id,
        productVariantId: null,
      },
    },
    update: {
      stock: Math.max(0, totalReceived - totalSold),
      reservedStock: 0,
      minStock: productSeed.minStock,
    } as any,
    create: {
      branchId: branch.id,
      productId: product.id,
      productVariantId: null,
      stock: Math.max(0, totalReceived - totalSold),
      reservedStock: 0,
      minStock: productSeed.minStock,
    } as any,
  })

  return {
    sku: productSeed.sku,
    currentStock: Math.max(0, totalReceived - totalSold),
    totalReceived,
    totalSold,
  }
}

async function main() {
  const branch = await ensureBranch()
  const supplier = await ensureSupplier()

  const results = []
  for (const productSeed of demoProducts) {
    results.push(await seedProduct(branch, supplier, productSeed))
  }

  console.log('Seeded inventory analytics demo batches:')
  for (const result of results) {
    console.log(
      `- ${result.sku}: received ${result.totalReceived}, sold ${result.totalSold}, current stock ${result.currentStock}`,
    )
  }
}

main()
  .catch((error) => {
    console.error('Inventory analytics seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
