import { Module } from '@nestjs/common'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'
import { DatabaseModule } from '../../database/database.module'
import { OrdersModule } from '../orders/orders.module'
import { QueueModule } from '../queue/queue.module'
import { StorageModule } from '../storage/storage.module'

@Module({
  imports: [DatabaseModule, OrdersModule, QueueModule, StorageModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
