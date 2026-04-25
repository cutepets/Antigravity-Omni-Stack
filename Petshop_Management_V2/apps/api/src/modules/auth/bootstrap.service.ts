import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { DatabaseService } from '../../database/database.service.js'

const SUPER_ADMIN_PERMISSIONS = [
    'MANAGE_STAFF', 'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_BRANCHES',
    'MANAGE_SETTINGS', 'MANAGE_PRODUCTS', 'MANAGE_SERVICES', 'MANAGE_PETS',
    'MANAGE_CUSTOMERS', 'MANAGE_ORDERS', 'VIEW_FINANCIAL_REPORTS',
    'FULL_BRANCH_ACCESS',
    'stock_count.create', 'stock_count.read', 'stock_count.update',
    'stock_count.count', 'stock_count.approve',
    'equipment.read', 'equipment.create', 'equipment.update',
    'equipment.archive', 'equipment.scan', 'equipment.config',
    'settings.audit_log.read',
]

const DEFAULT_MODULES = [
    { key: 'pet', displayName: 'Quản lý Thú cưng', description: 'Hồ sơ thú cưng, lịch sử sức khỏe, tiêm phòng', icon: '🐾', sortOrder: 1 },
    { key: 'hotel', displayName: 'Hotel Thú cưng', description: 'Dịch vụ lưu trú ngắn và dài hạn cho thú cưng', icon: '🏨', sortOrder: 2 },
    { key: 'grooming', displayName: 'Grooming & Spa', description: 'Dịch vụ làm đẹp, tắm sấy và chăm sóc lông', icon: '✂️', sortOrder: 3 },
    { key: 'attendance', displayName: 'Chấm công', description: 'Quản lý chấm công, ca làm việc và xét duyệt giờ công', icon: '⏱️', sortOrder: 4 },
    { key: 'payroll', displayName: 'Bảng lương', description: 'Tính lương, duyệt kỳ lương và xuất phiếu lương nhân viên', icon: '💰', sortOrder: 5 },
    { key: 'rewards', displayName: 'Thưởng phạt', description: 'Quản lý thưởng, phạt và các khoản điều chỉnh lương', icon: '🎁', sortOrder: 6 },
    { key: 'equipment', displayName: 'Trang thiết bị', description: 'Quản lý trang thiết bị, quét QR và lịch sử cập nhật', icon: '🖥️', sortOrder: 7 },
]

/**
 * Tự động đảm bảo dữ liệu nền tảng tồn tại khi API khởi động:
 * - Tài khoản SuperAdmin mặc định khi DB không có user
 * - Danh sách Module Config mặc định
 * - Phương thức thanh toán hệ thống (Cash, Points)
 *
 */
@Injectable()
export class BootstrapService implements OnModuleInit {
    private readonly logger = new Logger(BootstrapService.name)

    constructor(private readonly db: DatabaseService) { }

    async onModuleInit() {
        await this.ensureDefaultSuperAdmin()
        await this.ensureDefaultModules()
        await this.ensureSystemPaymentMethods()
        await this.ensureDefaultPricing()
    }

    private async ensureDefaultSuperAdmin() {
        const userCount = await this.db.user.count()
        if (userCount > 0) return

        this.logger.warn('⚠️  Không tìm thấy user nào trong DB — kích hoạt bootstrap SuperAdmin...')

        const configuredPassword = process.env['BOOTSTRAP_ADMIN_PASSWORD']?.trim()
        if (process.env['NODE_ENV'] === 'production' && !configuredPassword) {
            throw new Error('Missing required environment variable: BOOTSTRAP_ADMIN_PASSWORD')
        }
        const defaultPassword = configuredPassword || 'Admin@123'

        await this.db.$transaction(async (tx) => {
            // 1. Đảm bảo có ít nhất 1 branch
            let branch = await tx.branch.findFirst({ where: { isActive: true } })
            if (!branch) {
                branch = await tx.branch.create({
                    data: {
                        code: 'MAIN',
                        name: 'Chi nhánh chính',
                        address: '',
                        phone: '',
                        isMain: true,
                        isActive: true,
                    } as any,
                })
                this.logger.log('✅ Đã tạo chi nhánh mặc định: Chi nhánh chính')
            }

            // 2. Đảm bảo có role SUPER_ADMIN
            let role = await tx.role.findFirst({ where: { code: 'SUPER_ADMIN' } })
            if (!role) {
                role = await tx.role.create({
                    data: {
                        code: 'SUPER_ADMIN',
                        name: 'Chủ cửa hàng',
                        isSystem: true,
                        permissions: SUPER_ADMIN_PERMISSIONS,
                        description: 'Quyền quản trị toàn hệ thống',
                    } as any,
                })
                this.logger.log('✅ Đã tạo role: SUPER_ADMIN')
            }

            // 3. Tạo user superadmin
            const passwordHash = await bcrypt.hash(defaultPassword, 12)
            await tx.user.create({
                data: {
                    username: 'superadmin',
                    staffCode: 'NV00001',
                    passwordHash,
                    fullName: 'Super Admin',
                    legacyRole: 'STAFF',
                    roleId: role.id,
                    status: 'WORKING',
                    employmentType: 'FULL_TIME',
                    branchId: branch.id,
                    joinDate: new Date(),
                } as any,
            })

            this.logger.log('✅ Đã tạo tài khoản SuperAdmin bootstrap')
            this.logger.warn('🔴 VUI LÒNG ĐỔI MẬT KHẨU SAU KHI ĐĂNG NHẬP!')
        })
    }

    private async ensureDefaultModules() {
        const db = this.db as any
        const existingCount = await db.moduleConfig.count()
        if (existingCount > 0) return

        this.logger.log('📦 Đang khởi tạo danh sách Module mặc định...')

        for (const mod of DEFAULT_MODULES) {
            await db.moduleConfig.upsert({
                where: { key: mod.key },
                update: {},
                create: {
                    key: mod.key,
                    displayName: mod.displayName,
                    description: mod.description,
                    icon: mod.icon,
                    sortOrder: mod.sortOrder,
                    isActive: true,
                    isCore: false,
                    version: '1.0.0',
                },
            })
        }

        this.logger.log(`✅ Đã tạo ${DEFAULT_MODULES.length} module mặc định`)
    }

    private async ensureSystemPaymentMethods() {
        const db = this.db as any

        // Tiền mặt — mặc định, không thể xóa
        const cash = await db.paymentMethod.findFirst({ where: { isSystem: true, type: 'CASH' } })
        if (!cash) {
            await db.paymentMethod.create({
                data: {
                    code: 'SYS_CASH',
                    name: 'Tiền Mặt',
                    type: 'CASH',
                    isSystem: true,
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    colorKey: 'emerald',
                },
            })
            this.logger.log('✅ Đã khôi phục phương thức thanh toán: Tiền Mặt')
        }

        // Điểm tích lũy
        const points = await db.paymentMethod.findFirst({ where: { isSystem: true, type: 'POINTS' } })
        if (!points) {
            await db.paymentMethod.create({
                data: {
                    code: 'POINTS',
                    name: 'Điểm tích lũy',
                    type: 'POINTS',
                    isSystem: true,
                    isActive: true,
                    isDefault: false,
                    sortOrder: 99,
                    colorKey: 'violet',
                },
            })
            this.logger.log('✅ Đã khôi phục phương thức thanh toán: Điểm tích lũy')
        }
    }

    private async ensureDefaultPricing() {
        const bandCount = await this.db.serviceWeightBand.count()
        if (bandCount > 0) return

        this.logger.log('💰 Đang khởi tạo bảng giá mặc định...')

        const GROOMING_BANDS = [
            { label: '1-3kg', minWeight: 1, maxWeight: 3, sortOrder: 1 },
            { label: '3-6kg', minWeight: 3, maxWeight: 6, sortOrder: 2 },
            { label: '6-10kg', minWeight: 6, maxWeight: 10, sortOrder: 3 },
            { label: '10-20kg', minWeight: 10, maxWeight: 20, sortOrder: 4 },
            { label: '20-30kg', minWeight: 20, maxWeight: 30, sortOrder: 5 },
            { label: '>30kg', minWeight: 30, maxWeight: null, sortOrder: 6 },
        ]

        const HOTEL_BANDS = [
            { label: '1-5kg', minWeight: 1, maxWeight: 5, sortOrder: 1 },
            { label: '5-10kg', minWeight: 5, maxWeight: 10, sortOrder: 2 },
            { label: '10-20kg', minWeight: 10, maxWeight: 20, sortOrder: 3 },
            { label: '20-30kg', minWeight: 20, maxWeight: 30, sortOrder: 4 },
            { label: '>30kg', minWeight: 30, maxWeight: null, sortOrder: 5 },
        ]

        // Grooming prices per band [BATH, HYGIENE, SHAVE, FULL]
        const GROOMING_PRICES: Record<string, number[]> = {
            '1-3kg': [80000, 120000, 150000, 200000],
            '3-6kg': [100000, 150000, 180000, 250000],
            '6-10kg': [130000, 180000, 220000, 300000],
            '10-20kg': [170000, 230000, 280000, 380000],
            '20-30kg': [220000, 300000, 350000, 480000],
            '>30kg': [280000, 380000, 430000, 580000],
        }

        const SPA_PACKAGES = [
            { code: 'BATH', label: 'Tắm sấy', duration: 30 },
            { code: 'HYGIENE', label: 'Tắm vệ sinh', duration: 45 },
            { code: 'SHAVE', label: 'Cạo lông', duration: 60 },
            { code: 'FULL', label: 'Tắm trọn gói', duration: 90 },
        ]

        // Hotel prices per band { REGULAR, HOLIDAY }
        const HOTEL_PRICES: Record<string, [number, number]> = {
            '1-5kg': [150000, 200000],
            '5-10kg': [180000, 250000],
            '10-20kg': [220000, 300000],
            '20-30kg': [280000, 380000],
            '>30kg': [350000, 480000],
        }

        const currentYear = new Date().getFullYear()

        await this.db.$transaction(async (tx) => {
            // 1. Create weight bands
            const groomingBandIds: Record<string, string> = {}
            for (const band of GROOMING_BANDS) {
                const created = await tx.serviceWeightBand.create({
                    data: {
                        serviceType: 'GROOMING',
                        label: band.label,
                        minWeight: band.minWeight,
                        maxWeight: band.maxWeight,
                        sortOrder: band.sortOrder,
                        isActive: true,
                    },
                })
                groomingBandIds[band.label] = created.id
            }

            const hotelBandIds: Record<string, string> = {}
            for (const band of HOTEL_BANDS) {
                const created = await tx.serviceWeightBand.create({
                    data: {
                        serviceType: 'HOTEL',
                        label: band.label,
                        minWeight: band.minWeight,
                        maxWeight: band.maxWeight,
                        sortOrder: band.sortOrder,
                        isActive: true,
                    },
                })
                hotelBandIds[band.label] = created.id
            }

            // 2. Create grooming spa rules
            for (const [bandLabel, prices] of Object.entries(GROOMING_PRICES)) {
                const bandId = groomingBandIds[bandLabel]
                if (!bandId) continue
                for (let i = 0; i < SPA_PACKAGES.length; i++) {
                    const pkg = SPA_PACKAGES[i]!
                    await tx.spaPriceRule.create({
                        data: {
                            packageCode: pkg.code,
                            label: pkg.label,
                            weightBandId: bandId,
                            price: prices[i]!,
                            durationMinutes: pkg.duration,
                            isActive: true,
                        } as any,
                    })
                }
            }

            // 3. Create hotel rules
            for (const [bandLabel, [regular, holiday]] of Object.entries(HOTEL_PRICES)) {
                const bandId = hotelBandIds[bandLabel]
                if (!bandId) continue
                for (const [dayType, price] of [['REGULAR', regular], ['HOLIDAY', holiday]] as const) {
                    await tx.hotelPriceRule.create({
                        data: {
                            year: currentYear,
                            weightBandId: bandId,
                            dayType,
                            fullDayPrice: price,
                            halfDayPrice: Math.round(price * 0.6),
                            isActive: true,
                        },
                    })
                }
            }

            this.logger.log(`✅ Đã tạo bảng giá mặc định: ${Object.keys(GROOMING_PRICES).length * SPA_PACKAGES.length} Grooming rules, ${Object.keys(HOTEL_PRICES).length * 2} Hotel rules`)
        })
    }
}
