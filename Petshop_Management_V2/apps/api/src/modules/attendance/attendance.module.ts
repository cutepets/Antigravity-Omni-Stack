import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { DatabaseModule } from '../../database/database.module';
import { ScheduleModule } from '../schedule/schedule.module';

@Module({
    imports: [DatabaseModule, ScheduleModule],
    controllers: [AttendanceController],
    providers: [AttendanceService],
    exports: [AttendanceService],
})
export class AttendanceModule { }
