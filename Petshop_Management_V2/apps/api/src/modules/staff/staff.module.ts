import { Module } from '@nestjs/common'
import { StaffController } from './staff.controller.js'
import { StaffService } from './staff.service.js'
import { DatabaseModule } from '../../database/database.module.js'
import { AuthModule } from '../auth/auth.module.js'

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class UsersModule {}
