import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { DatabaseModule } from '../../database/database.module.js'
import { ModuleGuard } from '../../common/guards/module.guard.js'
import { GroomingController } from './grooming.controller.js'
import { GroomingService } from './grooming.service.js'
import { CommandHandlers, QueryHandlers } from './application/index.js'

@Module({
  imports: [CqrsModule, DatabaseModule],
  controllers: [GroomingController],
  providers: [
    // Legacy service — retained for compatibility (all ops now via CQRS handlers)
    GroomingService,
    ModuleGuard,
    // CQRS handlers
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [GroomingService],
})
export class GroomingModule { }
