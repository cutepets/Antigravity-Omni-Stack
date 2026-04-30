import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module.js'
import { PromotionEngineService } from './engine/promotion-engine.service.js'
import { PromotionApplicationService } from './promotion-application.service.js'
import { PromotionsController } from './promotions.controller.js'
import { PromotionsService } from './promotions.service.js'

@Module({
  imports: [DatabaseModule],
  controllers: [PromotionsController],
  providers: [PromotionEngineService, PromotionApplicationService, PromotionsService],
  exports: [PromotionApplicationService],
})
export class PromotionsModule {}
