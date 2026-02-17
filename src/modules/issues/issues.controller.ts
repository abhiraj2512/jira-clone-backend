import { Controller, Get } from '@nestjs/common';
import { IssuesService } from './issues.service';

@Controller('issues')
export class IssuesController {
    constructor(private readonly issuesService: IssuesService) { }

    @Get()
    getStatus() {
        return this.issuesService.getStatus();
    }
}
