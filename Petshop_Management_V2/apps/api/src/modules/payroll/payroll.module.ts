import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [PayrollController],
    providers: [PayrollService, PayrollCalculatorService],
    exports: [PayrollService],
})
export class PayrollModule { }
