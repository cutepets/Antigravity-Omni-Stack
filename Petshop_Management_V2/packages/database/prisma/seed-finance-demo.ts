import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DEMO_TAG = 'FINANCE_DEMO'

const PAYMENT_METHODS = ['CASH', 'BANK', 'MOMO', 'CARD'] as const

function offsetDate(daysAgo: number, hour: number, minute: number) {
  const value = new Date()
  value.setDate(value.getDate() - daysAgo)
  value.setHours(hour, minute, 0, 0)
  return value
}

async function main() {
  const [branch, fallbackBranch] = await prisma.branch.findMany({
    orderBy: { createdAt: 'asc' },
    take: 2,
  })
  const [staff] = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    take: 1,
  })
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'asc' },
    take: 4,
  })
  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: 'asc' },
    take: 3,
  })
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  await prisma.transaction.deleteMany({
    where: {
      OR: [
        { tags: { contains: DEMO_TAG } },
        { voucherNumber: { startsWith: 'DEMO-' } },
      ],
    },
  })

  const demoTransactions = Array.from({ length: 15 }, (_, index) => {
    const isIncome = index % 3 !== 0
    const primaryBranch = index % 2 === 0 ? branch : fallbackBranch ?? branch
    const customer = customers[index % Math.max(customers.length, 1)] ?? null
    const supplier = suppliers[index % Math.max(suppliers.length, 1)] ?? null
    const order = orders[index % Math.max(orders.length, 1)] ?? null
    const paymentMethod = PAYMENT_METHODS[index % PAYMENT_METHODS.length]
    const date = offsetDate(index, 8 + (index % 8), 10 + ((index * 7) % 45))
    const voucherNumber = `DEMO-${isIncome ? 'PT' : 'PC'}-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${String(index + 1).padStart(3, '0')}`
    const amount = 180000 + index * 95000

    if (index % 5 === 0) {
      return {
        voucherNumber,
        type: 'INCOME' as const,
        amount,
        description: `Thu dich vu luu tru POS demo ${index + 1}`,
        category: 'Hotel',
        paymentMethod,
        branchId: primaryBranch?.id ?? null,
        branchName: primaryBranch?.name ?? null,
        payerId: customer?.id ?? null,
        payerName: customer?.fullName ?? 'Khach hotel demo',
        refType: 'ORDER',
        refId: order?.id ?? null,
        refNumber: order?.orderNumber ?? `POS-HOTEL-${String(index + 1).padStart(3, '0')}`,
        notes: `POS trace: HOTEL_STAY:demo-hotel-${index + 1} | HOTEL_CODE:HOTEL-DEMO-${String(index + 1).padStart(3, '0')}`,
        tags: `${DEMO_TAG},POS_ORDER,HOTEL_STAY:demo-hotel-${index + 1},HOTEL_CODE:HOTEL-DEMO-${String(index + 1).padStart(3, '0')}`,
        source: 'ORDER_PAYMENT',
        isManual: false,
        date,
        orderId: order?.id ?? null,
        staffId: staff?.id ?? null,
      }
    }

    if (index % 4 === 0) {
      return {
        voucherNumber,
        type: 'INCOME' as const,
        amount,
        description: `Thu grooming POS demo ${index + 1}`,
        category: 'Grooming',
        paymentMethod,
        branchId: primaryBranch?.id ?? null,
        branchName: primaryBranch?.name ?? null,
        payerId: customer?.id ?? null,
        payerName: customer?.fullName ?? 'Khach grooming demo',
        refType: 'ORDER',
        refId: order?.id ?? null,
        refNumber: order?.orderNumber ?? `POS-GROOM-${String(index + 1).padStart(3, '0')}`,
        notes: `POS trace: GROOMING_SESSION:demo-groom-${index + 1}`,
        tags: `${DEMO_TAG},POS_ORDER,GROOMING_SESSION:demo-groom-${index + 1}`,
        source: 'ORDER_PAYMENT',
        isManual: false,
        date,
        orderId: order?.id ?? null,
        staffId: staff?.id ?? null,
      }
    }

    if (!isIncome) {
      return {
        voucherNumber,
        type: 'EXPENSE' as const,
        amount,
        description: `Chi nhap hang demo ${index + 1}`,
        category: 'Stock',
        paymentMethod,
        branchId: primaryBranch?.id ?? null,
        branchName: primaryBranch?.name ?? null,
        payerId: supplier?.id ?? null,
        payerName: supplier?.name ?? 'Nha cung cap demo',
        refType: 'STOCK_RECEIPT',
        refId: null,
        refNumber: `RCPT-DEMO-${String(index + 1).padStart(3, '0')}`,
        notes: `Chi cong no nha cung cap demo ${index + 1}`,
        tags: DEMO_TAG,
        source: 'STOCK_RECEIPT',
        isManual: false,
        date,
        staffId: staff?.id ?? null,
      }
    }

    return {
      voucherNumber,
      type: 'INCOME' as const,
      amount,
      description: `Thu bo sung demo ${index + 1}`,
      category: 'Manual',
      paymentMethod,
      branchId: primaryBranch?.id ?? null,
      branchName: primaryBranch?.name ?? null,
      payerId: customer?.id ?? null,
      payerName: customer?.fullName ?? 'Khach le',
      refType: 'MANUAL',
      refId: null,
      refNumber: null,
      notes: `Manual finance demo ${index + 1}`,
      tags: DEMO_TAG,
      source: 'MANUAL',
      isManual: true,
      date,
      staffId: staff?.id ?? null,
    }
  })

  await prisma.transaction.createMany({
    data: demoTransactions,
  })

  console.log(`Seeded ${demoTransactions.length} finance demo transactions`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
