import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { getClientIp } from './common/security/request-ip.util.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { UsersModule } from './modules/staff/staff.module.js'
import { RolesModule } from './modules/roles/roles.module.js'
import { CustomerModule } from './modules/customer/customer.module.js'
import { PetModule } from './modules/pet/pet.module.js'
import { GroomingModule } from './modules/grooming/grooming.module.js'
import { HotelModule } from './modules/hotel/hotel.module.js'
import { OrdersModule } from './modules/orders/orders.module.js'
import { InventoryModule } from './modules/inventory/inventory.module.js'
import { StockModule } from './modules/stock/stock.module.js'
import { StockCountModule } from './modules/stock-count/stock-count.module.js'
import { ReportsModule } from './modules/reports/reports.module.js'
import { SettingsModule } from './modules/settings/settings.module.js'
import { ShiftsModule } from './modules/shifts/shifts.module.js'
import { PricingModule } from './modules/pricing/pricing.module.js'
import { ScheduleModule } from './modules/schedule/schedule.module.js'
import { AttendanceModule } from './modules/attendance/attendance.module.js'
import { LeaveModule } from './modules/leave/leave.module.js'
import { PayrollModule } from './modules/payroll/payroll.module.js'
import { EquipmentModule } from './modules/equipment/equipment.module.js'
import { HealthController } from './health.controller.js'
import { QueueModule } from './modules/queue/queue.module.js'
import { StorageModule } from './modules/storage/storage.module.js'
import { CrmExcelModule } from './modules/crm/crm-excel.module.js'
import { PromotionsModule } from './modules/promotions/promotions.module.js'

@Module({
  imports: [
    // Environment configurations
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting: 100 req / 60s per real client IP
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
      getTracker: (req) => getClientIp(req),
    }),

    // Core modules
    QueueModule,
    StorageModule,
    AuthModule,
    UsersModule,
    RolesModule,

    // Domain modules
    CustomerModule,
    PetModule,
    CrmExcelModule,
    GroomingModule,
    HotelModule,
    PromotionsModule,
    OrdersModule,

    // Phase 1 — Operational modules
    InventoryModule,
    StockModule,
    StockCountModule,
    ReportsModule,
    SettingsModule,
    ShiftsModule,
    PricingModule,

    // Phase 2 — HR modules
    ScheduleModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    EquipmentModule,
  ],
  controllers: [HealthController],
  providers: [
    // Bind ThrottlerGuard globally — every endpoint is rate-limited by default
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule { }
