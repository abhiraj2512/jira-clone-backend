import { Injectable } from '@nestjs/common';

@Injectable()
export class CommentsService {
    getStatus(): object {
        return {
            module: 'comments',
            status: 'initialized',
        };
    }
}
