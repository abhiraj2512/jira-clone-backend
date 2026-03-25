import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Issue, IssueStatus, IssuePriority } from './entities/issue.entity';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';

@Injectable()
export class IssuesService {
    constructor(
        @InjectRepository(Issue)
        private readonly issueRepository: Repository<Issue>,
        @InjectRepository(ProjectMember)
        private readonly projectMemberRepository: Repository<ProjectMember>,
        @InjectRepository(Project)
        private readonly projectRepository: Repository<Project>,
    ) { }

    async createIssue(userId: string, projectId: string, dto: CreateIssueDto): Promise<Issue> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new NotFoundException('Project not found');
        }

        const isMember = await this.projectMemberRepository.findOne({
            where: { userId, projectId },
        });
        if (!isMember) {
            throw new ForbiddenException('You are not a member of this project');
        }

        if (dto.assigneeId) {
            const isAssigneeMember = await this.projectMemberRepository.findOne({
                where: { userId: dto.assigneeId, projectId },
            });
            if (!isAssigneeMember) {
                throw new BadRequestException('Assignee is not a member of this project');
            }
        }

        const issue = this.issueRepository.create({
            title: dto.title,
            description: dto.description || null,
            status: IssueStatus.TODO,
            priority: dto.priority ?? IssuePriority.MEDIUM,
            projectId,
            reporterId: userId,
            assigneeId: dto.assigneeId || null,
        }) as Issue;

        return await this.issueRepository.save(issue);
    }

    async getProjectIssues(userId: string, projectId: string): Promise<Partial<Issue>[]> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new NotFoundException('Project not found');
        }

        const isMember = await this.projectMemberRepository.findOne({
            where: { userId, projectId },
        });
        if (!isMember) {
            throw new ForbiddenException('You are not a member of this project');
        }

        return await this.issueRepository.find({
            where: { projectId },
            order: { createdAt: 'DESC' },
            select: ['id', 'title', 'status', 'priority', 'assigneeId', 'createdAt'],
        });
    }

    async updateIssue(userId: string, issueId: string, dto: UpdateIssueDto): Promise<Issue> {
        const issue = await this.issueRepository.findOne({ where: { id: issueId } });
        if (!issue) {
            throw new NotFoundException('Issue not found');
        }

        const isMember = await this.projectMemberRepository.findOne({
            where: { userId, projectId: issue.projectId },
        });
        if (!isMember) {
            throw new ForbiddenException('You are not a member of this project');
        }

        if (dto.assigneeId) {
            const isAssigneeMember = await this.projectMemberRepository.findOne({
                where: { userId: dto.assigneeId, projectId: issue.projectId },
            });
            if (!isAssigneeMember) {
                throw new BadRequestException('Assignee is not a member of this project');
            }
        }

        if (dto.title !== undefined) issue.title = dto.title;
        if (dto.description !== undefined) issue.description = dto.description || null;
        if (dto.priority !== undefined) issue.priority = dto.priority;
        if (dto.assigneeId !== undefined) issue.assigneeId = dto.assigneeId || null;

        return await this.issueRepository.save(issue);
    }

    async getIssueById(userId: string, issueId: string): Promise<Issue> {
        const issue = await this.issueRepository.findOne({
            where: { id: issueId },
            select: ['id', 'title', 'description', 'status', 'priority', 'assigneeId', 'reporterId', 'createdAt', 'projectId'],
        });

        if (!issue) {
            throw new NotFoundException('Issue not found');
        }

        const isMember = await this.projectMemberRepository.findOne({
            where: { userId, projectId: issue.projectId },
        });

        if (!isMember) {
            throw new ForbiddenException('You are not a member of this project');
        }

        return issue;
    }

    async updateIssueStatus(userId: string, issueId: string, status: IssueStatus): Promise<Issue> {
        const issue = await this.issueRepository.findOne({ where: { id: issueId } });
        if (!issue) {
            throw new NotFoundException('Issue not found');
        }

        const isMember = await this.projectMemberRepository.findOne({
            where: { userId, projectId: issue.projectId },
        });

        if (!isMember) {
            throw new ForbiddenException('You are not a member of this project');
        }

        // Validate status transition
        const allowedTransitions: Record<IssueStatus, IssueStatus[]> = {
            [IssueStatus.TODO]: [IssueStatus.IN_PROGRESS],
            [IssueStatus.IN_PROGRESS]: [IssueStatus.DONE, IssueStatus.TODO],
            [IssueStatus.DONE]: [IssueStatus.IN_PROGRESS],
        };

        if (!allowedTransitions[issue.status].includes(status)) {
            throw new BadRequestException(`Invalid status transition from ${issue.status} to ${status}`);
        }

        issue.status = status;
        return await this.issueRepository.save(issue);
    }
}

