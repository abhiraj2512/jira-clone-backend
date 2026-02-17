import { Injectable } from '@nestjs/common';

@Injectable()
export class ProjectsService {
    getStatus(): object {
        return {
            module: 'projects',
            status: 'initialized',
        };
    }
}
