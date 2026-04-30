import { Module } from '@nestjs/common'
import { StaffExcelController } from './staff-excel.controller.js'
import { StaffExcelService } from './staff-excel.service.js'
import { StaffController } from './staff.controller.js'
import { StaffService } from './staff.service.js'
import { DatabaseModule } from '../../database/database.module.js'
import { AuthModule } from '../auth/auth.module.js'
import { StorageModule } from '../storage/storage.module.js'

@Module({
  imports: [DatabaseModule, AuthModule, StorageModule],
  controllers: [StaffExcelController, StaffController],
  providers: [StaffExcelService, StaffService],
})
export class UsersModule {}
