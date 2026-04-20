import { Module } from '@nestjs/common'
import { InventoryController } from './inventory.controller'
import { InventoryService } from './inventory.service'
import { DatabaseModule } from '../../database/database.module'
import { QueueModule } from '../queue/queue.module'

@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
