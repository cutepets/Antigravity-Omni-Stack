import { Module } from '@nestjs/common'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'
import { DatabaseModule } from '../../database/database.module'
import { OrdersModule } from '../orders/orders.module'
import { QueueModule } from '../queue/queue.module'

@Module({
  imports: [DatabaseModule, OrdersModule, QueueModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
