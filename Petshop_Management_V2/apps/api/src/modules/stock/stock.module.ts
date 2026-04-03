import { Module } from '@nestjs/common'
import { StockController } from './stock.controller.js'
import { StockService } from './stock.service.js'
import { DatabaseModule } from '../../database/database.module.js'

@Module({
  imports: [DatabaseModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
