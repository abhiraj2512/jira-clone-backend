import { Controller, Get, Post, Patch, Body, UseGuards, Request, Param } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';

@Controller()
export class IssuesController {
    constructor(private readonly issuesService: IssuesService) { }

    @Post('projects/:projectId/issues')
    @UseGuards(JwtAuthGuard)
    async createIssue(
        @Request() req: any,
        @Param('projectId') projectId: string,
        @Body() dto: CreateIssueDto,
    ) {
        return this.issuesService.createIssue(req.user.userId, projectId, dto);
    }

    @Get('projects/:projectId/issues')
    @UseGuards(JwtAuthGuard)
    async getProjectIssues(
        @Request() req: any,
        @Param('projectId') projectId: string,
    ) {
        return this.issuesService.getProjectIssues(req.user.userId, projectId);
    }

    @Patch('issues/:id')
    @UseGuards(JwtAuthGuard)
    async updateIssue(
        @Request() req: any,
        @Param('id') issueId: string,
        @Body() dto: UpdateIssueDto,
    ) {
        return this.issuesService.updateIssue(req.user.userId, issueId, dto);
    }
}
