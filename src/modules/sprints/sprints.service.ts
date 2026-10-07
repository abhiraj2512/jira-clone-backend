import {
    Injectable,
    ForbiddenException,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Sprint, SprintStatus } from './entities/sprint.entity';
import { Issue, IssueStatus } from '../issues/entities/issue.entity';
import { ProjectMember, ProjectRole } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityActionType } from '../activity-log/entities/activity-log.entity';

export interface SprintWithCounts extends Sprint {
    issueCount: number;
    completedIssueCount: number;
    completionPercentage: number;
}

export interface CompleteSprintResult {
    sprint: Sprint;
    movedToBacklogCount: number;
}

@Injectable()
export class SprintsService {
    constructor(
        @InjectRepository(Sprint)
        private readonly sprintRepository: Repository<Sprint>,
        @InjectRepository(Issue)
        private readonly issueRepository: Repository<Issue>,
        @InjectRepository(ProjectMember)
        private readonly memberRepository: Repository<ProjectMember>,
        @InjectRepository(Project)
        private readonly projectRepository: Repository<Project>,
        private readonly activityLogService: ActivityLogService,
    ) {}

    // ── Private helpers ───────────────────────────────────────────────────────

    private async assertProjectMember(userId: string, projectId: string): Promise<ProjectMember> {
        const member = await this.memberRepository.findOne({
            where: { userId, projectId },
        });
        if (!member) throw new ForbiddenException('You are not a member of this project');
        return member;
    }

    private async assertProjectAdmin(userId: string, projectId: string): Promise<void> {
        const member = await this.assertProjectMember(userId, projectId);
        if (member.role !== ProjectRole.PROJECT_ADMIN) {
            throw new ForbiddenException('Only a Project Admin can perform this action');
        }
    }

    private async getSprintWithMemberCheck(userId: string, sprintId: string): Promise<{ sprint: Sprint; member: ProjectMember }> {
        const sprint = await this.sprintRepository.findOne({ where: { id: sprintId } });
        if (!sprint) throw new NotFoundException('Sprint not found');

        const member = await this.assertProjectMember(userId, sprint.projectId);
        return { sprint, member };
    }

    private async buildSprintWithCounts(sprint: Sprint): Promise<SprintWithCounts> {
        const issues = await this.issueRepository.find({
            where: { sprintId: sprint.id },
            select: ['id', 'status'],
        });
        const issueCount = issues.length;
        const completedIssueCount = issues.filter((i) => i.status === IssueStatus.DONE).length;
        const completionPercentage = issueCount === 0
            ? 0
            : Math.round((completedIssueCount / issueCount) * 100);

        return Object.assign(sprint, { issueCount, completedIssueCount, completionPercentage });
    }

    // ── Public API ────────────────────────────────────────────────────────────

    async createSprint(userId: string, projectId: string, dto: CreateSprintDto): Promise<Sprint> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) throw new NotFoundException('Project not found');

        await this.assertProjectAdmin(userId, projectId);

        // Validate date relationship if both provided
        if (dto.startDate && dto.endDate) {
            const start = new Date(dto.startDate);
            const end = new Date(dto.endDate);
            if (end < start) {
                throw new BadRequestException('End date must not be before start date');
            }
        }

        const sprint = this.sprintRepository.create({
            projectId,
            name: dto.name.trim(),
            goal: dto.goal?.trim() || null,
            startDate: dto.startDate ? new Date(dto.startDate) : null,
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            status: SprintStatus.PLANNED,
        });

        const saved = await this.sprintRepository.save(sprint);

        await this.activityLogService.recordActivity(
            null,
            userId,
            ActivityActionType.SPRINT_CREATED,
            null,
            { sprintId: saved.id, sprintName: saved.name, projectId },
        );

        return saved;
    }

    async listSprints(userId: string, projectId: string): Promise<SprintWithCounts[]> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) throw new NotFoundException('Project not found');

        await this.assertProjectMember(userId, projectId);

        const sprints = await this.sprintRepository.find({
            where: { projectId },
            order: { createdAt: 'DESC' },
        });

        // Sort: ACTIVE first, PLANNED next, COMPLETED last
        const statusOrder: Record<SprintStatus, number> = {
            [SprintStatus.ACTIVE]: 0,
            [SprintStatus.PLANNED]: 1,
            [SprintStatus.COMPLETED]: 2,
        };
        sprints.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

        // Fetch issue counts efficiently
        const sprintIds = sprints.map((s) => s.id);
        if (sprintIds.length === 0) return [];

        // Get all issues for these sprints in one query
        const allIssues = await this.issueRepository
            .createQueryBuilder('issue')
            .select(['issue.sprintId', 'issue.status'])
            .where('issue.sprintId IN (:...sprintIds)', { sprintIds })
            .getRawMany();

        // Build counts map
        const countsMap = new Map<string, { total: number; done: number }>();
        for (const issue of allIssues) {
            const sid = issue.issue_sprintId;
            if (!countsMap.has(sid)) countsMap.set(sid, { total: 0, done: 0 });
            const entry = countsMap.get(sid)!;
            entry.total++;
            if (issue.issue_status === IssueStatus.DONE) entry.done++;
        }

        return sprints.map((sprint) => {
            const counts = countsMap.get(sprint.id) ?? { total: 0, done: 0 };
            const completionPercentage = counts.total === 0
                ? 0
                : Math.round((counts.done / counts.total) * 100);
            return Object.assign(sprint, {
                issueCount: counts.total,
                completedIssueCount: counts.done,
                completionPercentage,
            });
        });
    }

    async getSprintById(userId: string, sprintId: string): Promise<SprintWithCounts> {
        const { sprint } = await this.getSprintWithMemberCheck(userId, sprintId);
        return this.buildSprintWithCounts(sprint);
    }

    async updateSprint(userId: string, sprintId: string, dto: UpdateSprintDto): Promise<Sprint> {
        const { sprint } = await this.getSprintWithMemberCheck(userId, sprintId);

        await this.assertProjectAdmin(userId, sprint.projectId);

        if (sprint.status === SprintStatus.COMPLETED) {
            throw new BadRequestException('Cannot modify a completed sprint');
        }

        // Validate date relationship
        const toDateStr = (val: Date | string | null | undefined): string | undefined => {
            if (!val) return undefined;
            if (val instanceof Date) return val.toISOString();
            return String(val);
        };
        const newStart = dto.startDate !== undefined ? dto.startDate : toDateStr(sprint.startDate);
        const newEnd = dto.endDate !== undefined ? dto.endDate : toDateStr(sprint.endDate);
        if (newStart && newEnd) {
            const start = new Date(newStart);
            const end = new Date(newEnd);
            if (end < start) {
                throw new BadRequestException('End date must not be before start date');
            }
        }

        if (dto.name !== undefined) sprint.name = dto.name.trim();
        if (dto.goal !== undefined) sprint.goal = dto.goal?.trim() || null;
        if (dto.startDate !== undefined) sprint.startDate = dto.startDate ? new Date(dto.startDate) : null;
        if (dto.endDate !== undefined) sprint.endDate = dto.endDate ? new Date(dto.endDate) : null;

        return this.sprintRepository.save(sprint);
    }

    async startSprint(userId: string, sprintId: string): Promise<SprintWithCounts> {
        const { sprint } = await this.getSprintWithMemberCheck(userId, sprintId);

        await this.assertProjectAdmin(userId, sprint.projectId);

        if (sprint.status === SprintStatus.ACTIVE) {
            throw new BadRequestException('Sprint is already active');
        }
        if (sprint.status === SprintStatus.COMPLETED) {
            throw new BadRequestException('Cannot start a completed sprint');
        }

        // Check no other ACTIVE sprint in this project
        const existingActive = await this.sprintRepository.findOne({
            where: { projectId: sprint.projectId, status: SprintStatus.ACTIVE },
        });
        if (existingActive) {
            throw new BadRequestException(
                `Sprint "${existingActive.name}" is already active. Complete it before starting a new one.`,
            );
        }

        sprint.status = SprintStatus.ACTIVE;
        if (!sprint.startDate) {
            sprint.startDate = new Date();
        }

        const saved = await this.sprintRepository.save(sprint);

        await this.activityLogService.recordActivity(
            null,
            userId,
            ActivityActionType.SPRINT_STARTED,
            null,
            { sprintId: saved.id, sprintName: saved.name, projectId: saved.projectId },
        );

        return this.buildSprintWithCounts(saved);
    }

    async completeSprint(userId: string, sprintId: string): Promise<CompleteSprintResult> {
        const { sprint } = await this.getSprintWithMemberCheck(userId, sprintId);

        await this.assertProjectAdmin(userId, sprint.projectId);

        if (sprint.status !== SprintStatus.ACTIVE) {
            throw new BadRequestException('Only an active sprint can be completed');
        }

        // Move unfinished issues to backlog (sprintId = null)
        const unfinishedIssues = await this.issueRepository.find({
            where: [
                { sprintId: sprintId, status: IssueStatus.TODO },
                { sprintId: sprintId, status: IssueStatus.IN_PROGRESS },
            ],
        });

        if (unfinishedIssues.length > 0) {
            await this.issueRepository
                .createQueryBuilder()
                .update(Issue)
                .set({ sprintId: null })
                .where('id IN (:...ids)', { ids: unfinishedIssues.map((i) => i.id) })
                .execute();
        }

        sprint.status = SprintStatus.COMPLETED;
        if (!sprint.endDate) {
            sprint.endDate = new Date();
        }

        const saved = await this.sprintRepository.save(sprint);

        await this.activityLogService.recordActivity(
            null,
            userId,
            ActivityActionType.SPRINT_COMPLETED,
            null,
            {
                sprintId: saved.id,
                sprintName: saved.name,
                projectId: saved.projectId,
                movedToBacklog: unfinishedIssues.length,
            },
        );

        return { sprint: saved, movedToBacklogCount: unfinishedIssues.length };
    }

    async deleteSprint(userId: string, sprintId: string): Promise<{ message: string }> {
        const { sprint } = await this.getSprintWithMemberCheck(userId, sprintId);

        await this.assertProjectAdmin(userId, sprint.projectId);

        if (sprint.status !== SprintStatus.PLANNED) {
            throw new BadRequestException('Only PLANNED sprints can be deleted');
        }

        // Move any issues in this sprint back to backlog
        await this.issueRepository
            .createQueryBuilder()
            .update(Issue)
            .set({ sprintId: null })
            .where('sprintId = :sprintId', { sprintId })
            .execute();

        await this.sprintRepository.remove(sprint);
        return { message: 'Sprint deleted successfully' };
    }

    async getBacklogIssues(userId: string, projectId: string): Promise<Issue[]> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) throw new NotFoundException('Project not found');

        await this.assertProjectMember(userId, projectId);

        return this.issueRepository.find({
            where: { projectId, sprintId: IsNull() },
            order: { createdAt: 'DESC' },
        });
    }
}
