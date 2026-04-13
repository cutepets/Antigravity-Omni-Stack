import { Module } from '@nestjs/common'
import { StockCountController } from './stock-count.controller.js'
import { StockCountService } from './stock-count.service.js'
import { DatabaseModule } from '../../database/database.module.js'

@Module({
  imports: [DatabaseModule],
  controllers: [StockCountController],
  providers: [StockCountService],
  exports: [StockCountService],
})
export class StockCountModule {}
