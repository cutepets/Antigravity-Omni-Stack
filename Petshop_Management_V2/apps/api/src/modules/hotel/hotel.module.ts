import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { DatabaseModule } from '../../database/database.module.js'
import { ModuleGuard } from '../../common/guards/module.guard.js'
import { OrdersModule } from '../orders/orders.module.js'
import { HotelController } from './hotel.controller.js'
import { HotelService } from './hotel.service.js'
import { HotelDaycareAutomationService } from './hotel-daycare-automation.service.js'
import { CommandHandlers, QueryHandlers } from './application/index.js'

@Module({
  imports: [CqrsModule, DatabaseModule, OrdersModule],
  controllers: [HotelController],
  providers: [
    HotelService,
    HotelDaycareAutomationService,
    ModuleGuard,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [HotelService],
})
export class HotelModule { }
