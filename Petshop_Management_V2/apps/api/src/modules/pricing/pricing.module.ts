import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module.js'
import { PricingController } from './pricing.controller.js'
import { PricingService } from './pricing.service.js'

@Module({
  imports: [DatabaseModule],
  controllers: [PricingController],
  providers: [PricingService],
})
export class PricingModule {}
