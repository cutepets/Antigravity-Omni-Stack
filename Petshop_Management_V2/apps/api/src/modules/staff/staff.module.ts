import { Module } from '@nestjs/common'
import { StaffController } from './staff.controller.js'
import { StaffService } from './staff.service.js'
import { DatabaseModule } from '../../database/database.module.js'
import { AuthModule } from '../auth/auth.module.js'
import { StorageModule } from '../storage/storage.module.js'

@Module({
  imports: [DatabaseModule, AuthModule, StorageModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class UsersModule {}
