import { Injectable } from '@nestjs/common';

@Injectable()
export class BoardsService {
    getStatus(): object {
        return {
            module: 'boards',
            status: 'initialized',
        };
    }
}
