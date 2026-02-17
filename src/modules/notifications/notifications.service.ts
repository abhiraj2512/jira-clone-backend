import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
    getStatus(): object {
        return {
            module: 'notifications',
            status: 'initialized',
        };
    }
}
