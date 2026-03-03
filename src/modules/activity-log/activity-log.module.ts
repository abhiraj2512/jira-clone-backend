import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLogController } from './activity-log.controller';
import { ActivityLogService } from './activity-log.service';
import { ActivityLog } from './entities/activity-log.entity';

@Module({
    imports: [TypeOrmModule.forFeature([ActivityLog])],
    controllers: [ActivityLogController],
    providers: [ActivityLogService],
})
export class ActivityLogModule { }
