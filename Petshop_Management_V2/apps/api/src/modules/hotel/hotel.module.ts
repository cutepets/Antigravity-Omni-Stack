import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { DatabaseModule } from '../../database/database.module.js'
import { ModuleGuard } from '../../common/guards/module.guard.js'
import { HotelController } from './hotel.controller.js'
import { HotelService } from './hotel.service.js'
import { CommandHandlers, QueryHandlers } from './application/index.js'

@Module({
  imports: [CqrsModule, DatabaseModule],
  controllers: [HotelController],
  providers: [
    HotelService,
    ModuleGuard,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [HotelService],
})
export class HotelModule { }
