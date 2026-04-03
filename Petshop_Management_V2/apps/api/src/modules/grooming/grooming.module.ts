import { Module } from '@nestjs/common'
import { GroomingService } from './grooming.service.js'
import { GroomingController } from './grooming.controller.js'
import { DatabaseModule } from '../../database/database.module.js'

@Module({
  imports: [DatabaseModule],
  controllers: [GroomingController],
  providers: [GroomingService],
  exports: [GroomingService],
})
export class GroomingModule {}
