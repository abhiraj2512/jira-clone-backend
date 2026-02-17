import { Injectable } from '@nestjs/common';

@Injectable()
export class SprintsService {
    getStatus(): object {
        return {
            module: 'sprints',
            status: 'initialized',
        };
    }
}
