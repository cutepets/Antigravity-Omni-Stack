import { Module } from '@nestjs/common'
import { ReportsController } from './reports.controller.js'
import { ReportsService } from './reports.service.js'
import { DatabaseModule } from '../../database/database.module.js'

@Module({
  imports: [DatabaseModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
