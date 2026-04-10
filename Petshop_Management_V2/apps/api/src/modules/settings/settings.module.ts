import { Module } from '@nestjs/common'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'
import { DatabaseModule } from '../../database/database.module'
import { OrdersModule } from '../orders/orders.module'

@Module({
  imports: [DatabaseModule, OrdersModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
