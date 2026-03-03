import { Controller, Get } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';

@Controller('activity-log')
export class ActivityLogController {
    constructor(private readonly activityLogService: ActivityLogService) { }

    @Get()
    getStatus() {
        return this.activityLogService.getStatus();
    }
}
