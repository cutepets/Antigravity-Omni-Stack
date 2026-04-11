import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
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
import { ReportsModule } from './modules/reports/reports.module.js'
import { SettingsModule } from './modules/settings/settings.module.js'
import { ShiftsModule } from './modules/shifts/shifts.module.js'
import { HealthController } from './health.controller.js'

@Module({
  imports: [
    // Environment configurations
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting: 100 req / 60s per IP
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // Core modules
    AuthModule,
    UsersModule,
    RolesModule,

    // Domain modules
    CustomerModule,
    PetModule,
    GroomingModule,
    HotelModule,
    OrdersModule,

    // Phase 1 — New modules
    InventoryModule,
    StockModule,
    ReportsModule,
    SettingsModule,
    ShiftsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
