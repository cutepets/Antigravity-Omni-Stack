import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module.js'
import { StorageModule } from '../storage/storage.module.js'
import { PricingController } from './pricing.controller.js'
import { PricingService } from './pricing.service.js'

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [PricingController],
  providers: [PricingService],
})
export class PricingModule {}
