import { Injectable } from '@nestjs/common';

@Injectable()
export class ProjectMembersService {
    getStatus(): object {
        return {
            module: 'project-members',
            status: 'initialized',
        };
    }
}
