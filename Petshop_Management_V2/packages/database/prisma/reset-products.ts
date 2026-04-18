/**
 * reset-products.ts
 * Xóa toàn bộ dữ liệu sản phẩm, đơn hàng, nhập hàng, thu chi
 * và tạo lại 35 sản phẩm demo đủ chủng loại (bao gồm conversion variant).
 * Giữ nguyên: branch, staff (user/role), customers, pets.
 *
 * Chạy: pnpm tsx packages/database/prisma/reset-products.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Helpers ────────────────────────────────────────────────────────────────

function conversionJson(rate: number, unit: string, baseUnit: string) {
    return JSON.stringify({ rate, unit, baseUnit })
}

// ─── Data ────────────────────────────────────────────────────────────────────

const SUPPLIERS_NEEDED = ['SUP1', 'SUP2', 'SUP3', 'SUP4', 'SUP5', 'SUP6']

/**
 * Format: [sku, name, category, brand, unit, price, costPrice, targetSpecies, supplierKey]
 * Các sản phẩm được chọn đại diện cho từng nhóm hàng
 */
const products = [
    // ────────────────────────── THỨC ĂN CHÓ ─────────────────────────────────
    ['DOGFOOD001', 'Hạt Royal Canin Mini Adult 2kg', 'Thức ăn', 'Royal Canin', 'gói', 325000, 248000, 'Chó', 'SUP1'],
    ['DOGFOOD002', 'Hạt SmartHeart Puppy 10kg', 'Thức ăn', 'SmartHeart', 'gói', 420000, 315000, 'Chó', 'SUP1'],
    ['DOGFOOD003', 'Pate Happy Bark Chicken 375g', 'Thức ăn', 'Happy Bark Foods', 'hộp', 42000, 28000, 'Chó', 'SUP6'],
    ['DOGFOOD004', 'Snack dental chew size S', 'Thức ăn', 'Happy Bark Foods', 'gói', 26000, 16000, 'Chó', 'SUP6'],
    ['DOGFOOD005', 'Hạt Hill\'s Science Diet Adult 4kg', 'Thức ăn', 'Hill\'s', 'gói', 480000, 372000, 'Chó', 'SUP1'],
    ['DOGFOOD006', 'Xúc xích dinh dưỡng cho chó', 'Thức ăn', 'PetBar', 'gói', 85000, 55000, 'Chó', 'SUP6'],

    // ────────────────────────── THỨC ĂN MÈO ─────────────────────────────────
    ['CATFOOD001', 'Hạt Me O Salmon 1.2kg', 'Thức ăn', 'Me O', 'gói', 128000, 89000, 'Mèo', 'SUP6'],
    ['CATFOOD002', 'Pate Me O Tuna 80g (chai đơn)', 'Thức ăn', 'Me O', 'chai', 18000, 11500, 'Mèo', 'SUP6'],
    ['CATFOOD003', 'Hạt Royal Canin Indoor 2kg', 'Thức ăn', 'Royal Canin', 'gói', 295000, 228000, 'Mèo', 'SUP1'],
    ['CATFOOD004', 'Pate Whiskas Ocean Fish 85g', 'Thức ăn', 'Whiskas', 'hộp', 15000, 9500, 'Mèo', 'SUP6'],
    ['CATFOOD005', 'Treat Temptation Classic 85g', 'Thức ăn', 'Temptations', 'gói', 48000, 30000, 'Mèo', 'SUP6'],
    ['CATFOOD006', 'Snack Ciao Tuna Stick 14g', 'Thức ăn', 'Ciao', 'gói', 18000, 11000, 'Mèo', 'SUP6'],

    // ────────────────────────── VỆ SINH / CÁT ───────────────────────────────
    ['LITTER001', 'Cát vệ sinh than hoạt tính 10L', 'Vệ sinh', 'Natural Cat Litter', 'gói', 145000, 98000, 'Mèo', 'SUP5'],
    ['LITTER002', 'Cát vệ sinh tinh thể silica 3.8L', 'Vệ sinh', 'Crystal Sand', 'gói', 95000, 62000, 'Mèo', 'SUP5'],
    ['LITTER003', 'Xịt khử mùi cát 500ml', 'Vệ sinh', 'Bio Care', 'chai', 92000, 62000, 'Chó & Mèo', 'SUP2'],
    ['BATH001', 'Sữa tắm lông trắng 500ml', 'Vệ sinh', 'Bio Care', 'chai', 138000, 92000, 'Chó & Mèo', 'SUP2'],
    ['BATH002', 'Sữa tắm hypoallergenic 500ml', 'Vệ sinh', 'Bio Care', 'chai', 168000, 118000, 'Chó & Mèo', 'SUP2'],
    ['BATH003', 'Nước hoa thú cưng 50ml', 'Vệ sinh', 'PawScent', 'chai', 78000, 48000, 'Chó & Mèo', 'SUP2'],

    // ────────────────────────── PHỤ KIỆN ────────────────────────────────────
    ['ACCESS001', 'Dây đai nylon size M', 'Phụ kiện', 'PetStyle', 'cái', 115000, 72000, 'Chó', 'SUP3'],
    ['ACCESS002', 'Vòng cổ da khắc tên', 'Phụ kiện', 'PetStyle', 'cái', 145000, 98000, 'Chó & Mèo', 'SUP3'],
    ['ACCESS003', 'Bát ăn inox chống trượt size S', 'Phụ kiện', 'PetStyle', 'cái', 76000, 43000, 'Chó & Mèo', 'SUP3'],
    ['ACCESS004', 'Lồng vận chuyển size M', 'Phụ kiện', 'PetStyle', 'cái', 420000, 305000, 'Chó & Mèo', 'SUP3'],
    ['ACCESS005', 'Đồ chơi dây thừng kéo co', 'Phụ kiện', 'FunPet', 'cái', 65000, 38000, 'Chó', 'SUP3'],
    ['ACCESS006', 'Nhà cát mèo 3 tầng', 'Phụ kiện', 'PetStyle', 'cái', 850000, 620000, 'Mèo', 'SUP3'],
    ['ACCESS007', 'Bàn gãi móng sisal', 'Phụ kiện', 'PetStyle', 'cái', 195000, 145000, 'Mèo', 'SUP3'],

    // ────────────────────────── CHĂM SÓC ────────────────────────────────────
    ['CARE001', 'Vitamin da và lông 60 viên', 'Chăm sóc', 'Dr Pet', 'hộp', 195000, 132000, 'Chó & Mèo', 'SUP4'],
    ['CARE002', 'Men tiêu hóa thú cưng 30 gói', 'Chăm sóc', 'Dr Pet', 'hộp', 172000, 118000, 'Chó & Mèo', 'SUP4'],
    ['CARE003', 'Xịt dưỡng lông silk finish', 'Chăm sóc', 'Bio Care', 'chai', 149000, 101000, 'Chó & Mèo', 'SUP2'],
    ['CARE004', 'Dầu cá Omega-3 cho pet 60ml', 'Chăm sóc', 'NutriPet', 'chai', 155000, 110000, 'Chó & Mèo', 'SUP4'],
    ['CARE005', 'Gel làm trắng răng 50g', 'Chăm sóc', 'PetDent', 'tuýp', 89000, 55000, 'Chó & Mèo', 'SUP4'],

    // ────────────────────────── THUỐC ───────────────────────────────────────
    ['MED001', 'Thuốc nhỏ vệ sinh tai 60ml', 'Thuốc', 'Virbac', 'chai', 210000, 154000, 'Chó & Mèo', 'SUP4'],
    ['MED002', 'Thuốc nhỏ trị bọ chét (<20kg)', 'Thuốc', 'Virbac', 'hộp', 285000, 214000, 'Chó', 'SUP4'],
    ['MED003', 'Thuốc tẩy giun 4 con/hộp', 'Thuốc', 'Dr Pet', 'hộp', 125000, 88000, 'Chó & Mèo', 'SUP4'],
    ['MED004', 'Xịt kháng khuẩn vết thương 100ml', 'Thuốc', 'Vetcare', 'chai', 145000, 105000, 'Chó & Mèo', 'SUP4'],

    // ────────────────────────── HAI SẢN PHẨM CÓ CONVERSION VARIANT ──────────
    // Pate Me O Tuna — bán lẻ theo chai hoặc hộp 12 chai
    // Conversion variant cho CATFOOD002 — 1 hộp = 12 chai
    // (Chai là true-variant trên, hộp là conversion variant bên dưới)

    // Sữa tắm Bio Care — bán theo chai hoặc thùng 6 chai
    // (Chai là true-variant BATH001, thùng là conversion variant bên dưới)
] as const

/**
 * Conversion variants: mỗi entry liên kết với một true-variant SKU
 * Format: [trueSku, convSku, convName, convPrice, convCostPrice, rate, convUnitLabel]
 * rate: 1 convUnit = rate trueUnit
 */
const conversionVariants = [
    // 1 hộp Me O Tuna = 12 chai đơn
    ['CATFOOD002', 'CATFOOD002HOP', 'Pate Me O Tuna 80g (thùng 12 chai)', 200000, 128000, 12, 'hộp'],
    // 1 thùng sữa tắm Bio Care = 6 chai
    ['BATH001', 'BATH001THUNG', 'Sữa tắm lông trắng 500ml (thùng 6 chai)', 780000, 520000, 6, 'thùng'],
    // 1 thùng snack Ciao = 10 gói
    ['CATFOOD006', 'CATFOOD006THUNG', 'Snack Ciao Tuna Stick 14g (thùng 10 gói)', 168000, 100000, 10, 'thùng'],
] as const

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🗑️  Đang xóa dữ liệu sản phẩm, đơn hàng, nhập hàng, thu chi...')

    // Xóa theo thứ tự FK (không xóa branch, user, role, customer, pet)
    await prisma.$transaction([
        prisma.transaction.deleteMany(),
        prisma.orderPayment.deleteMany(),
        prisma.orderItem.deleteMany(),
        prisma.order.deleteMany(),
        prisma.supplierReturnRefund.deleteMany(),
        prisma.supplierReturnItem.deleteMany(),
        prisma.supplierReturn.deleteMany(),
        prisma.supplierPaymentAllocation.deleteMany(),
        prisma.supplierPayment.deleteMany(),
        prisma.stockReceiptReceiveItem.deleteMany(),
        prisma.stockReceiptReceive.deleteMany(),
        prisma.stockTransaction.deleteMany(),
        prisma.stockCountItem.deleteMany(),
        prisma.stockCountShiftSession.deleteMany(),
        prisma.stockCountSession.deleteMany(),
        prisma.stockReceiptItem.deleteMany(),
        prisma.stockReceipt.deleteMany(),
        prisma.branchStock.deleteMany(),
        prisma.productVariant.deleteMany(),
        prisma.product.deleteMany(),
        prisma.category.deleteMany(),
        prisma.brand.deleteMany(),
        prisma.unit.deleteMany(),
        prisma.supplier.deleteMany(),
    ])
    console.log('✅ Xóa xong')

    // ── Tạo lại danh mục, thương hiệu, đơn vị ──────────────────────────────
    console.log('📂 Tạo categories, brands, units...')
    await prisma.category.createMany({
        data: ['Thức ăn', 'Vệ sinh', 'Phụ kiện', 'Chăm sóc', 'Thuốc'].map((name) => ({
            name,
            description: `${name} demo`,
        })) as any[],
    })
    await prisma.brand.createMany({
        data: [
            'Royal Canin', 'SmartHeart', 'Hill\'s', 'Orijen', 'Acana',
            'Happy Bark Foods', 'PetBar', 'VitaCraft',
            'Me O', 'Whiskas', 'Purina', 'Temptations', 'Ciao',
            'Natural Cat Litter', 'Crystal Sand',
            'Bio Care', 'PawScent',
            'PetStyle', 'FunPet',
            'Dr Pet', 'NutriPet', 'PetDent', 'Virbac', 'Vetcare',
        ].map((name) => ({ name })) as any[],
    })
    await prisma.unit.createMany({
        data: ['gói', 'chai', 'hộp', 'cái', 'thanh', 'tuýp', 'thùng'].map((name) => ({
            name,
            description: `${name} unit`,
        })) as any[],
    })

    // ── Tạo suppliers ────────────────────────────────────────────────────────
    console.log('🏭 Tạo suppliers...')
    const supplierDefs = [
        { key: 'SUP1', name: 'Royal Pet Trading', phone: '0919000101', email: 'royal@petcare.local', address: 'Kho A, Thủ Đức, TP HCM', monthTarget: 18_000_000, yearTarget: 210_000_000, notes: 'Đối tác chiến lược thức ăn chó.' },
        { key: 'SUP2', name: 'Bio Groom Viet Nam', phone: '0919000102', email: 'bio@petcare.local', address: 'Kho B, Dĩ An, Bình Dương', monthTarget: 12_000_000, yearTarget: 150_000_000, notes: 'Grooming, shampoo.' },
        { key: 'SUP3', name: 'PetStyle Accessory', phone: '0919000103', email: 'style@petcare.local', address: 'Kho C, Gò Vấp, TP HCM', monthTarget: 14_000_000, yearTarget: 170_000_000, notes: 'Phụ kiện chủ lực.' },
        { key: 'SUP4', name: 'Vet Plus Pharma', phone: '0919000104', email: 'vet@petcare.local', address: 'Kho D, Biên Hòa, Đồng Nai', monthTarget: 10_000_000, yearTarget: 120_000_000, notes: 'Thuốc và bổ trợ sức khỏe.' },
        { key: 'SUP5', name: 'Natural Cat Litter', phone: '0919000105', email: 'litter@petcare.local', address: 'Kho E, Hóc Môn, TP HCM', monthTarget: 8_000_000, yearTarget: 95_000_000, notes: 'Cát vệ sinh.' },
        { key: 'SUP6', name: 'Happy Bark Foods', phone: '0919000106', email: 'bark@petcare.local', address: 'Kho F, Tân Phú, TP HCM', monthTarget: 15_000_000, yearTarget: 190_000_000, notes: 'Pate, snack quay vòng nhanh.' },
    ]
    const supplierMap = new Map<string, any>()
    for (const def of supplierDefs) {
        const supplier = await prisma.supplier.create({
            data: {
                name: def.name, phone: def.phone, email: def.email,
                address: def.address, notes: def.notes,
                monthTarget: def.monthTarget, yearTarget: def.yearTarget,
                isActive: true,
            } as any,
        })
        supplierMap.set(def.key, supplier)
    }

    // ── Lấy branches ────────────────────────────────────────────────────────
    const branches = await prisma.branch.findMany({ orderBy: { isMain: 'desc' } })
    if (branches.length === 0) {
        throw new Error('Không có branch nào trong DB! Chạy seed.ts trước.')
    }
    const branchMap = new Map<string, any>(branches.map((b: any) => [b.code, b]))

    // ── Tạo sản phẩm ────────────────────────────────────────────────────────
    console.log('📦 Tạo sản phẩm...')
    const productVariantMap = new Map<string, any>() // sku → variant record

    for (const [sku, name, category, brand, unit, price, costPrice, species, supKey] of products) {
        const id = `prod-${sku.toLowerCase()}`
        const p = await prisma.product.create({
            data: {
                id,
                sku,
                name,
                targetSpecies: species,
                price,
                costPrice,
                category,
                brand,
                unit,
                supplierId: supplierMap.get(supKey)!.id,
                isActive: true,
            } as any,
        })

        // True-variant (không có conversions)
        const variant = await prisma.productVariant.create({
            data: {
                sku,
                barcode: `893${sku.slice(-6).padStart(6, '0')}`,
                name,
                productId: p.id,
                price,
                costPrice,
                isActive: true,
                // conversions = null → true-variant
            } as any,
        })
        productVariantMap.set(sku, { product: p, variant })

        // BranchStock cho tất cả chi nhánh — stock = 0 để a nhập hàng thực tế
        for (const branch of branches) {
            await prisma.branchStock.create({
                data: {
                    branchId: branch.id,
                    productId: p.id,
                    stock: 0,
                    minStock: 5,
                } as any,
            })
        }
    }

    // ── Tạo conversion variants ──────────────────────────────────────────────
    console.log('🔄 Tạo conversion variants...')
    for (const [trueSku, convSku, convName, convPrice, convCostPrice, rate, convUnitLabel] of conversionVariants) {
        const entry = productVariantMap.get(trueSku)
        if (!entry) {
            console.warn(`⚠️  Không tìm thấy true-variant cho ${trueSku}`)
            continue
        }

        const convVariant = await prisma.productVariant.create({
            data: {
                sku: convSku,
                barcode: `893CV${convSku.slice(-5).padStart(5, '0')}`,
                name: convName,
                productId: entry.product.id,
                price: convPrice,
                costPrice: convCostPrice,
                isActive: true,
                // conversions là JSON để hệ thống nhận biết đây là conversion variant
                conversions: conversionJson(rate, convUnitLabel, entry.variant.name ? 'chai' : 'đơn vị'),
            } as any,
        })
        console.log(`  ✓ ${convSku}: 1 ${convUnitLabel} = ${rate} ${trueSku}`)
    }

    const totalProducts = products.length
    const totalVariants = products.length + conversionVariants.length
    console.log(`\n🎉 Hoàn tất!`)
    console.log(`   Sản phẩm: ${totalProducts}`)
    console.log(`   Variants: ${totalVariants} (${products.length} true + ${conversionVariants.length} conversion)`)
    console.log(`   Chi nhánh: tồn kho = 0 (để test nhập hàng thực tế)`)
    console.log(`\n👉 Bước tiếp theo: Nhập hàng thực tế qua UI để test flow nhập → bán → kiểm tra tồn`)
}

main()
    .catch((e) => {
        console.error('❌ Lỗi khi reset-products:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
