import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityActionType } from './entities/activity-log.entity';
import { Issue } from '../issues/entities/issue.entity';
import { ProjectMember, ProjectRole } from '../project-members/entities/project-member.entity';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/entities/project.entity';

export interface ActivityWithActor {
    id: string;
    issueId: string | null;
    actionType: ActivityActionType;
    oldValue: Record<string, any> | null;
    newValue: Record<string, any> | null;
    createdAt: Date;
    actor: {
        userId: string;
        email: string;
        fullName: string;
    };
}

@Injectable()
export class ActivityLogService {
    constructor(
        @InjectRepository(ActivityLog)
        private readonly activityRepo: Repository<ActivityLog>,
        @InjectRepository(Issue)
        private readonly issueRepo: Repository<Issue>,
        @InjectRepository(ProjectMember)
        private readonly memberRepo: Repository<ProjectMember>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Project)
        private readonly projectRepo: Repository<Project>,
    ) {}

    /**
     * Internal method used by IssuesService and CommentsService to record an activity.
     * Failures are caught and logged silently so they never break the primary operation.
     */
    async recordActivity(
        issueId: string | null,
        userId: string,
        actionType: ActivityActionType,
        oldValue?: Record<string, any> | null,
        newValue?: Record<string, any> | null,
    ): Promise<void> {
        try {
            const log = this.activityRepo.create({
                issueId,
                userId,
                actionType,
                oldValue: oldValue ?? null,
                newValue: newValue ?? null,
            });
            await this.activityRepo.save(log);
        } catch (err) {
            console.error('[ActivityLog] Failed to record activity:', err);
        }
    }

    async getIssueActivity(requestingUserId: string, issueId: string): Promise<ActivityWithActor[]> {
        const issue = await this.issueRepo.findOne({ where: { id: issueId } });
        if (!issue) throw new NotFoundException('Issue not found');

        const member = await this.memberRepo.findOne({
            where: { userId: requestingUserId, projectId: issue.projectId },
        });
        if (!member) throw new ForbiddenException('You are not a member of this project');

        const activities = await this.activityRepo.find({
            where: { issueId },
            order: { createdAt: 'DESC' },
        });

        const userIds = [...new Set(activities.map((a) => a.userId))];
        const users = await this.userRepo.findByIds(userIds);
        const userMap = new Map(users.map((u) => [u.id, u]));

        return activities.map((a) => {
            const actor = userMap.get(a.userId);
            return {
                id: a.id,
                issueId: a.issueId,
                actionType: a.actionType,
                oldValue: a.oldValue,
                newValue: a.newValue,
                createdAt: a.createdAt,
                actor: {
                    userId: a.userId,
                    email: actor?.email ?? 'unknown',
                    fullName: actor?.fullName ?? 'Unknown User',
                },
            };
        });
    }

    async getProjectActivity(requestingUserId: string, projectId: string): Promise<ActivityWithActor[]> {
        const project = await this.projectRepo.findOne({ where: { id: projectId } });
        if (!project) throw new NotFoundException('Project not found');

        const member = await this.memberRepo.findOne({
            where: { userId: requestingUserId, projectId },
        });
        if (!member) throw new ForbiddenException('You are not a member of this project');
        if (member.role !== ProjectRole.PROJECT_ADMIN) {
            throw new ForbiddenException('Only project admins can view project-level activity audit logs');
        }

        // Query active issue activities belonging to this project OR retained records whose issueId IS NULL
        const activities = await this.activityRepo
            .createQueryBuilder('activity')
            .leftJoin(Issue, 'issue', 'activity.issueId = issue.id')
            .where('CAST(issue.projectId AS text) = :projectId', { projectId })
            .orWhere(
                "(activity.issueId IS NULL AND (activity.newValue ->> 'projectId' = :projectId OR activity.oldValue ->> 'projectId' = :projectId))",
                { projectId },
            )
            .orderBy('activity.createdAt', 'DESC')
            .getMany();

        const userIds = [...new Set(activities.map((a) => a.userId))];
        const users = userIds.length > 0 ? await this.userRepo.findByIds(userIds) : [];
        const userMap = new Map(users.map((u) => [u.id, u]));

        return activities.map((a) => {
            const actor = userMap.get(a.userId);
            return {
                id: a.id,
                issueId: a.issueId,
                actionType: a.actionType,
                oldValue: a.oldValue,
                newValue: a.newValue,
                createdAt: a.createdAt,
                actor: {
                    userId: a.userId,
                    email: actor?.email ?? 'unknown',
                    fullName: actor?.fullName ?? 'Unknown User',
                },
            };
        });
    }
}
