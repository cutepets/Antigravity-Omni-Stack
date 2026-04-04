import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function generateSku(name: string): string {
  return name.split(' ')
             .map(w => w.charAt(0).toUpperCase())
             .join('')
             .replace(/[^A-Z0-9]/g, '');
}

async function main() {
  console.log('🌱 Bắt đầu tạo dữ liệu demo nhập hàng...')

  // 1. Tạo Khách hàng mới
  const customer = await prisma.customer.upsert({
    where: { phone: '0900111222' },
    update: {},
    create: {
      customerCode: 'KH-DEMO-01',
      fullName: 'Khách Hàng Demo',
      phone: '0900111222',
      email: 'demo@example.com',
      address: '123 Đường Demo, TP.HCM',
      tier: 'BRONZE',
      points: 0,
    },
  })
  console.log(`✅ Khách hàng: ${customer.fullName}`)

  // 2. Tạo Thú cưng
  const pet = await prisma.pet.upsert({
    where: { petCode: 'PET-DEMO-01' },
    update: {},
    create: {
      petCode: 'PET-DEMO-01',
      name: 'Mực',
      species: 'Chó',
      breed: 'Pug',
      gender: 'MALE',
      weight: 5.5,
      color: 'Đen',
      customerId: customer.id,
      notes: 'Thú cưng demo',
    },
  })
  console.log(`✅ Thú cưng: ${pet.name}`)

  // 3. Tạo Nhà cung cấp (Supplier)
  let supplier = await prisma.supplier.findFirst({ where: { name: 'Công ty TNHH Demo' } })
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        name: 'Công ty TNHH Demo',
        phone: '0999888777',
        email: 'supplier@demo.com',
        address: '456 KCN Demo, Đồng Nai',
        notes: 'Nhà cung cấp demo',
        isActive: true,
      }
    })
  }
  console.log(`✅ Nhà cung cấp: ${supplier.name}`)

  // 4. Tạo Sản phẩm Demo
  const p1Name = 'Thức ăn cho mèo Me-O 1.2kg';
  const p1Sku = generateSku(p1Name);
  const product1 = await prisma.product.upsert({
    where: { sku: p1Sku },
    update: {},
    create: {
      name: p1Name,
      sku: p1Sku,
      category: 'Thức ăn',
      brand: 'DemoBrand',
      price: 15000,
      costPrice: 8000,
      minStock: 20,
      unit: 'cây',
      isActive: true,
      supplierId: supplier.id
    },
  })

  const p2Name = 'Cát vệ sinh mèo 5L';
  const p2Sku = generateSku(p2Name);
  const product2 = await prisma.product.upsert({
    where: { sku: p2Sku },
    update: {},
    create: {
      name: p2Name,
      sku: p2Sku,
      category: 'Vệ sinh',
      brand: 'KittyCat',
      price: 85000,
      costPrice: 50000,
      minStock: 30,
      unit: 'bao',
      isActive: true,
      supplierId: supplier.id
    },
  })
  console.log(`✅ Sản phẩm: ${product1.name} (SKU: ${product1.sku}), ${product2.name} (SKU: ${product2.sku})`)

  // 4.1 Tạo chi nhánh chính để chứa tồn kho
  let branch = await prisma.branch.findFirst({ where: { isMain: true } });
  if (!branch) {
      branch = await prisma.branch.create({
          data: { name: 'Cửa hàng chính', isMain: true, isActive: true }
      });
  }

  // 5. Tạo Hoá đơn nhập hàng (StockReceipt)
  const receiptNumber = `RC-${new Date().getTime()}`
  const stockReceipt = await prisma.stockReceipt.create({
    data: {
      receiptNumber: receiptNumber,
      supplierId: supplier.id,
      status: 'COMPLETED',
      totalAmount: 8000 * 50 + 50000 * 20,
      paidAmount: 8000 * 50 + 50000 * 20,
      notes: 'Nhập hàng demo',
      items: {
        create: [
          {
            productId: product1.id,
            quantity: 50,
            unitPrice: 8000,
            totalPrice: 8000 * 50,
          },
          {
            productId: product2.id,
            quantity: 20,
            unitPrice: 50000,
            totalPrice: 50000 * 20,
          }
        ]
      }
    }
  })
  console.log(`✅ Nhập hàng: ${stockReceipt.receiptNumber}`)

  // 6. Cập nhật tồn kho (BranchStock & Stock Transaction) cho Product 1
  let bs1 = await (prisma as any).branchStock.findFirst({ where: { branchId: branch.id, productId: product1.id } });
  if (bs1) {
    await (prisma as any).branchStock.update({ where: { id: bs1.id }, data: { stock: { increment: 50 } } });
  } else {
    await (prisma as any).branchStock.create({ data: { branchId: branch.id, productId: product1.id, stock: 50 } });
  }

  await prisma.stockTransaction.create({
    data: {
      productId: product1.id,
      type: 'IN',
      quantity: 50,
      reason: 'Nhập hàng từ NCC',
      referenceId: stockReceipt.id
    }
  })

  // 7. Cập nhật tồn kho (BranchStock & Stock Transaction) cho Product 2
  let bs2 = await (prisma as any).branchStock.findFirst({ where: { branchId: branch.id, productId: product2.id } });
  if (bs2) {
    await (prisma as any).branchStock.update({ where: { id: bs2.id }, data: { stock: { increment: 20 } } });
  } else {
    await (prisma as any).branchStock.create({ data: { branchId: branch.id, productId: product2.id, stock: 20 } });
  }

  await prisma.stockTransaction.create({
    data: {
      productId: product2.id,
      type: 'IN',
      quantity: 20,
      reason: 'Nhập hàng từ NCC',
      referenceId: stockReceipt.id
    }
  })
  console.log(`✅ Kho: Đã cộng tồn kho`)
  console.log('\n🎉 Hoàn tất tạo dữ liệu demo!')
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
