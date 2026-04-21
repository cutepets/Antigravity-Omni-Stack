import { Module } from '@nestjs/common'
import { ModuleGuard } from '../../common/guards/module.guard.js'
import { DatabaseModule } from '../../database/database.module.js'
import { StorageModule } from '../storage/storage.module.js'
import { EquipmentController } from './equipment.controller.js'
import { EquipmentService } from './equipment.service.js'

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [EquipmentController],
  providers: [EquipmentService, ModuleGuard],
  exports: [EquipmentService],
})
export class EquipmentModule {}
