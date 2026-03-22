import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Issue, IssueStatus, IssuePriority } from './entities/issue.entity';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { CreateIssueDto } from './dto/create-issue.dto';

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
        // 1. Check project exists
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new NotFoundException('Project not found');
        }

        // 2. Check requesting user is a project member
        const isMember = await this.projectMemberRepository.findOne({
            where: { userId, projectId },
        });
        if (!isMember) {
            throw new ForbiddenException('You are not a member of this project');
        }

        // 3. If assigneeId provided, ensure assignee is also a project member
        if (dto.assigneeId) {
            const isAssigneeMember = await this.projectMemberRepository.findOne({
                where: { userId: dto.assigneeId, projectId },
            });
            if (!isAssigneeMember) {
                throw new BadRequestException('Assignee is not a member of this project');
            }
        }

        // 4. Create and save issue
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
}
