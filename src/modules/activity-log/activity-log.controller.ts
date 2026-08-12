import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class ActivityLogController {
    constructor(private readonly activityLogService: ActivityLogService) {}

    @Get('issues/:issueId/activity')
    @UseGuards(JwtAuthGuard)
    async getIssueActivity(
        @Request() req: any,
        @Param('issueId') issueId: string,
    ) {
        return this.activityLogService.getIssueActivity(req.user.userId, issueId);
    }
}
