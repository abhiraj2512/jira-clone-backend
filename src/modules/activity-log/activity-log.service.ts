import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityActionType } from './entities/activity-log.entity';
import { Issue } from '../issues/entities/issue.entity';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { User } from '../users/entities/user.entity';

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
}
