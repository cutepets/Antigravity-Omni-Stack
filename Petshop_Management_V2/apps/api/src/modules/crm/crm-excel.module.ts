import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module.js'
import { CrmExcelController } from './crm-excel.controller.js'
import { CrmExcelService } from './crm-excel.service.js'

@Module({
  imports: [DatabaseModule],
  controllers: [CrmExcelController],
  providers: [CrmExcelService],
})
export class CrmExcelModule {}
