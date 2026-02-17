import { Injectable } from '@nestjs/common';

@Injectable()
export class IssuesService {
    getStatus(): object {
        return {
            module: 'issues',
            status: 'initialized',
        };
    }
}
