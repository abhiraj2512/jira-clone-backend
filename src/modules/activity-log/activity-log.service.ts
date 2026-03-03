import { Injectable } from '@nestjs/common';

@Injectable()
export class ActivityLogService {
    getStatus() {
        return { status: 'activity-log module is running' };
    }
}
