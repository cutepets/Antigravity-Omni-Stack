import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { DatabaseModule } from '../../database/database.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { ModuleGuard } from '../../common/guards/module.guard.js';

@Module({
    imports: [DatabaseModule, ScheduleModule],
    controllers: [AttendanceController],
    providers: [AttendanceService, ModuleGuard],
    exports: [AttendanceService],
})
export class AttendanceModule { }
