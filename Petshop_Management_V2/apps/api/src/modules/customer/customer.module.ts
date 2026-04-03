import { Module } from '@nestjs/common'
import { CustomerController } from './customer.controller.js'
import { CustomerService } from './customer.service.js'
import { DatabaseModule } from '../../database/database.module.js'

@Module({
  imports: [DatabaseModule],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
