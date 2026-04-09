import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DEMO_NOW = new Date('2026-04-06T09:00:00+07:00')

function generateSku(name: string): string {
  return name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .replace(/[^A-Z0-9]/g, '')
}

function procurementNumber(prefix: string, date: Date, sequence: number, padLength = 3) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${prefix}${y}${m}${d}${String(sequence).padStart(padLength, '0')}`
}

function voucher(type: 'INCOME' | 'EXPENSE', date: Date, sequence: number) {
  const prefix = type === 'INCOME' ? 'PT' : 'PC'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${prefix}${y}${m}${d}${String(sequence).padStart(4, '0')}`
}

async function main() {
  console.log('Starting updated procurement demo seed...')

  let branch = await prisma.branch.findFirst({ where: { isMain: true } })
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        code: 'MAIN',
        name: 'Showroom Trung Tam',
        address: '12 Nguyen Hue, Quan 1, TP HCM',
        phone: '02871000001',
        isMain: true,
        isActive: true,
      } as any,
    })
  }

  const customer = await prisma.customer.upsert({
    where: { phone: '0900111222' },
    update: {},
    create: {
      customerCode: 'KHDEMO01',
      fullName: 'Khach Hang Demo',
      phone: '0900111222',
      email: 'demo@example.com',
      address: '123 Duong Demo, TP.HCM',
      tier: 'BRONZE',
      points: 0,
    } as any,
  })
  console.log(`Customer: ${customer.fullName}`)

  const pet = await prisma.pet.upsert({
    where: { petCode: 'PETDEMO01' },
    update: {},
    create: {
      petCode: 'PETDEMO01',
      name: 'Muc',
      species: 'Cho',
      breed: 'Pug',
      gender: 'MALE',
      weight: 5.5,
      color: 'Den',
      customerId: customer.id,
      notes: 'Thu cung demo',
    } as any,
  })
  console.log(`Pet: ${pet.name}`)

  let supplier = await prisma.supplier.findFirst({ where: { name: 'Cong ty TNHH Demo NCC' } })
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        name: 'Cong ty TNHH Demo NCC',
        phone: '0999888777',
        email: 'supplier@demo.com',
        address: '456 KCN Demo, Dong Nai',
        notes: 'Nha cung cap demo theo workflow moi',
        monthTarget: 8000000,
        yearTarget: 96000000,
        isActive: true,
      } as any,
    })
  }
  console.log(`Supplier: ${supplier.name}`)

  const p1Name = 'Thuc an cho meo Me-O 1.2kg'
  const p1Sku = generateSku(p1Name)
  const product1 = await prisma.product.upsert({
    where: { sku: p1Sku },
    update: {},
    create: {
      name: p1Name,
      sku: p1Sku,
      category: 'Thuc an',
      brand: 'DemoBrand',
      price: 15000,
      costPrice: 8000,
      minStock: 20,
      unit: 'goi',
      isActive: true,
      supplierId: supplier.id,
    } as any,
  })

  const p2Name = 'Cat ve sinh meo 5L'
  const p2Sku = generateSku(p2Name)
  const product2 = await prisma.product.upsert({
    where: { sku: p2Sku },
    update: {},
    create: {
      name: p2Name,
      sku: p2Sku,
      category: 'Ve sinh',
      brand: 'KittyCat',
      price: 85000,
      costPrice: 50000,
      minStock: 30,
      unit: 'bao',
      isActive: true,
      supplierId: supplier.id,
    } as any,
  })
  console.log(`Products: ${product1.name} (${product1.sku}), ${product2.name} (${product2.sku})`)

  await prisma.branchStock.upsert({
    where: {
      branchId_productId_productVariantId: {
        branchId: branch.id,
        productId: product1.id,
        productVariantId: null,
      },
    } as any,
    update: {},
    create: { branchId: branch.id, productId: product1.id, productVariantId: null, stock: 0, reservedStock: 0, minStock: 20 } as any,
  })
  await prisma.branchStock.upsert({
    where: {
      branchId_productId_productVariantId: {
        branchId: branch.id,
        productId: product2.id,
        productVariantId: null,
      },
    } as any,
    update: {},
    create: { branchId: branch.id, productId: product2.id, productVariantId: null, stock: 0, reservedStock: 0, minStock: 30 } as any,
  })

  const draftReceipt = await prisma.stockReceipt.create({
    data: {
      receiptNumber: procurementNumber('PO', DEMO_NOW, 1),
      supplierId: supplier.id,
      branchId: branch.id,
      status: 'DRAFT',
      receiptStatus: 'DRAFT',
      paymentStatus: 'UNPAID',
      totalAmount: 1200000,
      notes: 'Don nhap demo dang tao va da tam ung',
      createdAt: DEMO_NOW,
      items: {
        create: [
          {
            productId: product1.id,
            quantity: 50,
            receivedQuantity: 0,
            returnedQuantity: 0,
            closedQuantity: 0,
            unitPrice: 8000,
            totalPrice: 400000,
          },
          {
            productId: product2.id,
            quantity: 16,
            receivedQuantity: 0,
            returnedQuantity: 0,
            closedQuantity: 0,
            unitPrice: 50000,
            totalPrice: 800000,
          },
        ],
      },
    } as any,
  })

  const advancePayment = await prisma.supplierPayment.create({
    data: {
      paymentNumber: procurementNumber('SP', DEMO_NOW, 1),
      supplierId: supplier.id,
      branchId: branch.id,
      targetReceiptId: null,
      targetReceiptNumber: null,
      amount: 300000,
      appliedAmount: 0,
      unappliedAmount: 300000,
      paymentMethod: 'BANK',
      notes: `Tam ung truoc cho ${draftReceipt.receiptNumber}`,
      paidAt: DEMO_NOW,
    } as any,
  })
  const advanceTransaction = await prisma.transaction.create({
    data: {
      voucherNumber: voucher('EXPENSE', DEMO_NOW, 1),
      type: 'EXPENSE',
      amount: 300000,
      description: `Tam ung NCC ${supplier.name}`,
      category: 'Nhap hang',
      paymentMethod: 'BANK',
      branchId: branch.id,
      branchName: branch.name,
      refType: 'SUPPLIER_PAYMENT',
      refId: advancePayment.id,
      refNumber: advancePayment.paymentNumber,
      payerId: supplier.id,
      payerName: supplier.name,
      notes: advancePayment.notes,
      source: 'SUPPLIER_PAYMENT',
      isManual: false,
      date: DEMO_NOW,
      createdAt: DEMO_NOW,
    } as any,
  })
  await prisma.supplierPayment.update({
    where: { id: advancePayment.id },
    data: { transactionId: advanceTransaction.id } as any,
  })

  const receivedAt = new Date('2026-04-06T13:00:00+07:00')
  const receipt = await prisma.stockReceipt.create({
    data: {
      receiptNumber: procurementNumber('PO', DEMO_NOW, 2),
      supplierId: supplier.id,
      branchId: branch.id,
      status: 'RECEIVED',
      receiptStatus: 'FULL_RECEIVED',
      paymentStatus: 'PARTIAL',
      totalAmount: 1400000,
      totalReceivedAmount: 1400000,
      totalReturnedAmount: 0,
      paidAmount: 900000,
      notes: 'Nhap hang demo theo workflow moi',
      receivedAt,
      completedAt: receivedAt,
      createdAt: new Date('2026-04-06T11:00:00+07:00'),
      items: {
        create: [
          {
            productId: product1.id,
            quantity: 50,
            receivedQuantity: 50,
            returnedQuantity: 0,
            closedQuantity: 0,
            unitPrice: 8000,
            totalPrice: 400000,
          },
          {
            productId: product2.id,
            quantity: 20,
            receivedQuantity: 20,
            returnedQuantity: 0,
            closedQuantity: 0,
            unitPrice: 50000,
            totalPrice: 1000000,
          },
        ],
      },
    } as any,
    include: { items: true },
  })

  await prisma.stockReceiptReceive.create({
    data: {
      receiveNumber: procurementNumber('RN', receivedAt, 1),
      receiptId: receipt.id,
      branchId: branch.id,
      notes: `Nhap kho cho ${receipt.receiptNumber}`,
      receivedAt,
      totalQuantity: 70,
      totalAmount: 1400000,
      items: {
        create: [
          {
            receiptItemId: receipt.items[0].id,
            productId: product1.id,
            productVariantId: null,
            quantity: 50,
            unitPrice: 8000,
            totalPrice: 400000,
          },
          {
            receiptItemId: receipt.items[1].id,
            productId: product2.id,
            productVariantId: null,
            quantity: 20,
            unitPrice: 50000,
            totalPrice: 1000000,
          },
        ],
      },
    } as any,
  })

  await prisma.branchStock.update({
    where: {
      branchId_productId_productVariantId: {
        branchId: branch.id,
        productId: product1.id,
        productVariantId: null,
      },
    } as any,
    data: { stock: { increment: 50 } } as any,
  })
  await prisma.branchStock.update({
    where: {
      branchId_productId_productVariantId: {
        branchId: branch.id,
        productId: product2.id,
        productVariantId: null,
      },
    } as any,
    data: { stock: { increment: 20 } } as any,
  })

  await prisma.stockTransaction.createMany({
    data: [
      { productId: product1.id, type: 'IN', quantity: 50, reason: `Nhap kho tu ${receipt.receiptNumber}`, referenceId: receipt.id, createdAt: receivedAt },
      { productId: product2.id, type: 'IN', quantity: 20, reason: `Nhap kho tu ${receipt.receiptNumber}`, referenceId: receipt.id, createdAt: receivedAt },
    ] as any[],
  })

  const receiptPayment = await prisma.supplierPayment.create({
    data: {
      paymentNumber: procurementNumber('SP', receivedAt, 2),
      supplierId: supplier.id,
      branchId: branch.id,
      targetReceiptId: receipt.id,
      targetReceiptNumber: receipt.receiptNumber,
      amount: 900000,
      appliedAmount: 900000,
      unappliedAmount: 0,
      paymentMethod: 'CASH',
      notes: `Thanh toan mot phan cho ${receipt.receiptNumber}`,
      paidAt: new Date('2026-04-06T15:00:00+07:00'),
    } as any,
  })
  await prisma.supplierPaymentAllocation.create({
    data: {
      paymentId: receiptPayment.id,
      receiptId: receipt.id,
      amount: 900000,
    } as any,
  })
  const receiptPaymentTxn = await prisma.transaction.create({
    data: {
      voucherNumber: voucher('EXPENSE', new Date('2026-04-06T15:00:00+07:00'), 2),
      type: 'EXPENSE',
      amount: 900000,
      description: `Thanh toan NCC cho ${receipt.receiptNumber}`,
      category: 'Nhap hang',
      paymentMethod: 'CASH',
      branchId: branch.id,
      branchName: branch.name,
      refType: 'SUPPLIER_PAYMENT',
      refId: receiptPayment.id,
      refNumber: receiptPayment.paymentNumber,
      payerId: supplier.id,
      payerName: supplier.name,
      notes: receiptPayment.notes,
      source: 'SUPPLIER_PAYMENT',
      isManual: false,
      date: new Date('2026-04-06T15:00:00+07:00'),
      createdAt: new Date('2026-04-06T15:00:00+07:00'),
    } as any,
  })
  await prisma.supplierPayment.update({
    where: { id: receiptPayment.id },
    data: { transactionId: receiptPaymentTxn.id } as any,
  })

  await prisma.supplier.update({
    where: { id: supplier.id },
    data: {
      debt: 500000,
      creditBalance: 300000,
    } as any,
  })

  console.log(`Receipts: ${draftReceipt.receiptNumber}, ${receipt.receiptNumber}`)
  console.log('Inventory updated with latest procurement workflow demo')
}

main()
  .catch((error) => {
    console.error('Seed error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
