import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [LeaveController],
    providers: [LeaveService],
    exports: [LeaveService],
})
export class LeaveModule { }
