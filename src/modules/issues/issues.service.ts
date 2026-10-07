import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Issue, IssueStatus, IssuePriority } from './entities/issue.entity';
import { ProjectMember, ProjectRole } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { Sprint, SprintStatus } from '../sprints/entities/sprint.entity';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityActionType } from '../activity-log/entities/activity-log.entity';

@Injectable()
export class IssuesService {
    constructor(
        @InjectRepository(Issue)
        private readonly issueRepository: Repository<Issue>,
        @InjectRepository(ProjectMember)
        private readonly projectMemberRepository: Repository<ProjectMember>,
        @InjectRepository(Project)
        private readonly projectRepository: Repository<Project>,
        @InjectRepository(Sprint)
        private readonly sprintRepository: Repository<Sprint>,
        private readonly activityLogService: ActivityLogService,
    ) {}

    async createIssue(userId: string, projectId: string, dto: CreateIssueDto): Promise<Issue> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) throw new NotFoundException('Project not found');

        const isMember = await this.projectMemberRepository.findOne({ where: { userId, projectId } });
        if (!isMember) throw new ForbiddenException('You are not a member of this project');

        if (dto.assigneeId) {
            const isAssigneeMember = await this.projectMemberRepository.findOne({
                where: { userId: dto.assigneeId, projectId },
            });
            if (!isAssigneeMember) throw new BadRequestException('Assignee is not a member of this project');
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

        const saved = await this.issueRepository.save(issue);

        await this.activityLogService.recordActivity(
            saved.id,
            userId,
            ActivityActionType.ISSUE_CREATED,
            null,
            { title: saved.title },
        );

        return saved;
    }

    async getProjectIssues(userId: string, projectId: string): Promise<Partial<Issue>[]> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) throw new NotFoundException('Project not found');

        const isMember = await this.projectMemberRepository.findOne({ where: { userId, projectId } });
        if (!isMember) throw new ForbiddenException('You are not a member of this project');

        return await this.issueRepository.find({
            where: { projectId },
            order: { createdAt: 'DESC' },
            select: ['id', 'title', 'status', 'priority', 'assigneeId', 'sprintId', 'createdAt', 'updatedAt'],
        });
    }

    async updateIssue(userId: string, issueId: string, dto: UpdateIssueDto): Promise<Issue> {
        const issue = await this.issueRepository.findOne({ where: { id: issueId } });
        if (!issue) throw new NotFoundException('Issue not found');

        const isMember = await this.projectMemberRepository.findOne({
            where: { userId, projectId: issue.projectId },
        });
        if (!isMember) throw new ForbiddenException('You are not a member of this project');

        if (dto.assigneeId) {
            const isAssigneeMember = await this.projectMemberRepository.findOne({
                where: { userId: dto.assigneeId, projectId: issue.projectId },
            });
            if (!isAssigneeMember) throw new BadRequestException('Assignee is not a member of this project');
        }

        // Capture old values for activity tracking
        const oldTitle       = issue.title;
        const oldDescription = issue.description;
        const oldPriority    = issue.priority;
        const oldAssigneeId  = issue.assigneeId;

        if (dto.title !== undefined)       issue.title       = dto.title;
        if (dto.description !== undefined) issue.description = dto.description || null;
        if (dto.priority !== undefined)    issue.priority    = dto.priority;
        if (dto.assigneeId !== undefined)  issue.assigneeId  = dto.assigneeId || null;

        const updated = await this.issueRepository.save(issue);

        // Record specific activity types based on what changed
        const priorityChanged  = dto.priority !== undefined  && dto.priority !== oldPriority;
        const assigneeChanged  = dto.assigneeId !== undefined && dto.assigneeId !== oldAssigneeId;
        const titleOrDescChanged =
            (dto.title !== undefined && dto.title !== oldTitle) ||
            (dto.description !== undefined && dto.description !== oldDescription);

        if (priorityChanged) {
            await this.activityLogService.recordActivity(
                updated.id, userId, ActivityActionType.PRIORITY_CHANGED,
                { oldPriority },
                { newPriority: dto.priority },
            );
        }

        if (assigneeChanged) {
            await this.activityLogService.recordActivity(
                updated.id, userId, ActivityActionType.ASSIGNEE_CHANGED,
                { oldAssigneeId },
                { newAssigneeId: dto.assigneeId || null },
            );
        }

        if (titleOrDescChanged) {
            await this.activityLogService.recordActivity(
                updated.id, userId, ActivityActionType.ISSUE_UPDATED,
                null,
                null,
            );
        }

        return updated;
    }

    async getIssueById(userId: string, issueId: string): Promise<Issue> {
        const issue = await this.issueRepository.findOne({
            where: { id: issueId },
            select: ['id', 'title', 'description', 'status', 'priority', 'assigneeId', 'reporterId', 'createdAt', 'updatedAt', 'projectId', 'sprintId'],
        });
        if (!issue) throw new NotFoundException('Issue not found');

        const isMember = await this.projectMemberRepository.findOne({
            where: { userId, projectId: issue.projectId },
        });
        if (!isMember) throw new ForbiddenException('You are not a member of this project');

        return issue;
    }

    async updateIssueStatus(userId: string, issueId: string, status: IssueStatus): Promise<Issue> {
        const issue = await this.issueRepository.findOne({ where: { id: issueId } });
        if (!issue) throw new NotFoundException('Issue not found');

        const isMember = await this.projectMemberRepository.findOne({
            where: { userId, projectId: issue.projectId },
        });
        if (!isMember) throw new ForbiddenException('You are not a member of this project');

        const allowedTransitions: Record<IssueStatus, IssueStatus[]> = {
            [IssueStatus.TODO]:        [IssueStatus.IN_PROGRESS],
            [IssueStatus.IN_PROGRESS]: [IssueStatus.DONE, IssueStatus.TODO],
            [IssueStatus.DONE]:        [IssueStatus.IN_PROGRESS],
        };

        if (!allowedTransitions[issue.status].includes(status)) {
            throw new BadRequestException(`Invalid status transition from ${issue.status} to ${status}`);
        }

        const oldStatus = issue.status;
        issue.status = status;
        const updated = await this.issueRepository.save(issue);

        await this.activityLogService.recordActivity(
            updated.id, userId, ActivityActionType.STATUS_CHANGED,
            { oldStatus },
            { newStatus: status },
        );

        return updated;
    }

    async updateIssueSprint(userId: string, issueId: string, sprintId: string | null): Promise<Issue> {
        const issue = await this.issueRepository.findOne({ where: { id: issueId } });
        if (!issue) throw new NotFoundException('Issue not found');

        const membership = await this.projectMemberRepository.findOne({
            where: { userId, projectId: issue.projectId },
        });
        if (!membership) throw new ForbiddenException('You are not a member of this project');
        if (membership.role === ProjectRole.VIEWER) {
            throw new ForbiddenException('Viewers cannot modify sprint assignment');
        }

        const oldSprintId = issue.sprintId;

        if (sprintId !== null) {
            // Validate sprint exists and belongs to same project
            const sprint = await this.sprintRepository.findOne({ where: { id: sprintId } });
            if (!sprint) throw new NotFoundException('Sprint not found');
            if (sprint.projectId !== issue.projectId) {
                throw new BadRequestException('Sprint does not belong to the same project');
            }
            if (sprint.status === SprintStatus.COMPLETED) {
                throw new BadRequestException('Cannot add issue to a completed sprint');
            }
        }

        issue.sprintId = sprintId;
        const updated = await this.issueRepository.save(issue);

        // Record activity
        if (sprintId !== null && sprintId !== oldSprintId) {
            await this.activityLogService.recordActivity(
                updated.id, userId, ActivityActionType.ISSUE_ADDED_TO_SPRINT,
                { oldSprintId },
                { newSprintId: sprintId },
            );
        } else if (sprintId === null && oldSprintId !== null) {
            await this.activityLogService.recordActivity(
                updated.id, userId, ActivityActionType.ISSUE_REMOVED_FROM_SPRINT,
                { oldSprintId },
                { newSprintId: null },
            );
        }

        return updated;
    }

    async deleteIssue(userId: string, issueId: string): Promise<{ message: string }> {
        const issue = await this.issueRepository.findOne({ where: { id: issueId } });
        if (!issue) throw new NotFoundException('Issue not found');

        const membership = await this.projectMemberRepository.findOne({
            where: { userId, projectId: issue.projectId },
        });
        if (!membership) throw new ForbiddenException('You are not a member of this project');
        if (membership.role !== ProjectRole.PROJECT_ADMIN) {
            throw new ForbiddenException('Only a Project Admin can delete issues');
        }

        // Record ISSUE_DELETED activity BEFORE removing the issue.
        // The FK on activity_logs.issueId is now ON DELETE SET NULL,
        // so this activity record will survive with issueId = null after deletion.
        await this.activityLogService.recordActivity(
            issueId, userId, ActivityActionType.ISSUE_DELETED,
            { title: issue.title },
            null,
        );

        await this.issueRepository.remove(issue);
        return { message: 'Issue deleted successfully' };
    }
}
