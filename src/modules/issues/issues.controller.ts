import { Controller, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateIssueDto } from './dto/create-issue.dto';

@Controller('projects/:projectId/issues')
export class IssuesController {
    constructor(private readonly issuesService: IssuesService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    async createIssue(
        @Request() req: any,
        @Param('projectId') projectId: string,
        @Body() dto: CreateIssueDto,
    ) {
        return this.issuesService.createIssue(req.user.userId, projectId, dto);
    }
}
