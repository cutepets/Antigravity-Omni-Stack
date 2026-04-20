import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { DatabaseModule } from '../../database/database.module';
import { ModuleGuard } from '../../common/guards/module.guard.js';

@Module({
    imports: [DatabaseModule],
    controllers: [PayrollController],
    providers: [PayrollService, PayrollCalculatorService, ModuleGuard],
    exports: [PayrollService],
})
export class PayrollModule { }
