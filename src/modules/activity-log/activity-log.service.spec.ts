import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { ActivityLog, ActivityActionType } from './entities/activity-log.entity';
import { Issue } from '../issues/entities/issue.entity';
import { ProjectMember, ProjectRole } from '../project-members/entities/project-member.entity';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/entities/project.entity';

const mockRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    findByIds: jest.fn(),
    create: jest.fn((dto: any) => ({ ...dto })),
    save: jest.fn((entity: any) => Promise.resolve({ id: entity.id || 'activity-1', createdAt: new Date(), ...entity })),
    createQueryBuilder: jest.fn(),
});

describe('ActivityLogService', () => {
    let service: ActivityLogService;
    let activityRepo: ReturnType<typeof mockRepo>;
    let issueRepo: ReturnType<typeof mockRepo>;
    let memberRepo: ReturnType<typeof mockRepo>;
    let userRepo: ReturnType<typeof mockRepo>;
    let projectRepo: ReturnType<typeof mockRepo>;

    const PROJ_A_ID = 'proj-a-111';
    const PROJ_B_ID = 'proj-b-222';
    const ISSUE_1_ID = 'issue-111';
    const ADMIN_USER_ID = 'user-admin';
    const DEV_USER_ID = 'user-dev';
    const VIEWER_USER_ID = 'user-viewer';
    const OUTSIDER_USER_ID = 'user-outsider';

    const mockProjectA: Partial<Project> = {
        id: PROJ_A_ID,
        name: 'Project A',
        key: 'PRJA',
    };

    const mockIssue1: Partial<Issue> = {
        id: ISSUE_1_ID,
        projectId: PROJ_A_ID,
        title: 'Active Issue 1',
    };

    const mockAdminMember: Partial<ProjectMember> = {
        userId: ADMIN_USER_ID,
        projectId: PROJ_A_ID,
        role: ProjectRole.PROJECT_ADMIN,
    };

    const mockDevMember: Partial<ProjectMember> = {
        userId: DEV_USER_ID,
        projectId: PROJ_A_ID,
        role: ProjectRole.DEVELOPER,
    };

    const mockViewerMember: Partial<ProjectMember> = {
        userId: VIEWER_USER_ID,
        projectId: PROJ_A_ID,
        role: ProjectRole.VIEWER,
    };

    const mockActor: Partial<User> = {
        id: ADMIN_USER_ID,
        email: 'admin@example.com',
        fullName: 'Admin User',
    };

    beforeEach(async () => {
        activityRepo = mockRepo();
        issueRepo = mockRepo();
        memberRepo = mockRepo();
        userRepo = mockRepo();
        projectRepo = mockRepo();

        userRepo.findByIds.mockResolvedValue([mockActor]);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ActivityLogService,
                { provide: getRepositoryToken(ActivityLog), useValue: activityRepo },
                { provide: getRepositoryToken(Issue), useValue: issueRepo },
                { provide: getRepositoryToken(ProjectMember), useValue: memberRepo },
                { provide: getRepositoryToken(User), useValue: userRepo },
                { provide: getRepositoryToken(Project), useValue: projectRepo },
            ],
        }).compile();

        service = module.get<ActivityLogService>(ActivityLogService);
    });

    describe('recordActivity', () => {
        it('should save activity log successfully', async () => {
            await service.recordActivity(
                ISSUE_1_ID,
                ADMIN_USER_ID,
                ActivityActionType.ISSUE_CREATED,
                null,
                { title: 'New Issue' },
            );

            expect(activityRepo.create).toHaveBeenCalledWith({
                issueId: ISSUE_1_ID,
                userId: ADMIN_USER_ID,
                actionType: ActivityActionType.ISSUE_CREATED,
                oldValue: null,
                newValue: { title: 'New Issue' },
            });
            expect(activityRepo.save).toHaveBeenCalled();
        });

        it('should catch errors gracefully and not throw', async () => {
            activityRepo.save.mockRejectedValueOnce(new Error('DB failure'));

            await expect(
                service.recordActivity(ISSUE_1_ID, ADMIN_USER_ID, ActivityActionType.ISSUE_CREATED),
            ).resolves.not.toThrow();
        });
    });

    describe('getIssueActivity', () => {
        it('should throw NotFoundException if issue does not exist', async () => {
            issueRepo.findOne.mockResolvedValue(null);

            await expect(
                service.getIssueActivity(ADMIN_USER_ID, 'non-existent-issue'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if requesting user is not a project member', async () => {
            issueRepo.findOne.mockResolvedValue(mockIssue1);
            memberRepo.findOne.mockResolvedValue(null);

            await expect(
                service.getIssueActivity(OUTSIDER_USER_ID, ISSUE_1_ID),
            ).rejects.toThrow(new ForbiddenException('You are not a member of this project'));
        });

        it('should allow members to view issue activity', async () => {
            issueRepo.findOne.mockResolvedValue(mockIssue1);
            memberRepo.findOne.mockResolvedValue(mockViewerMember);
            activityRepo.find.mockResolvedValue([
                {
                    id: 'act-1',
                    issueId: ISSUE_1_ID,
                    userId: ADMIN_USER_ID,
                    actionType: ActivityActionType.ISSUE_CREATED,
                    oldValue: null,
                    newValue: { title: 'Active Issue 1' },
                    createdAt: new Date(),
                },
            ]);

            const result = await service.getIssueActivity(VIEWER_USER_ID, ISSUE_1_ID);

            expect(result).toHaveLength(1);
            expect(result[0].actionType).toBe(ActivityActionType.ISSUE_CREATED);
            expect(result[0].actor.email).toBe('admin@example.com');
        });
    });

    describe('getProjectActivity (Audit Trail)', () => {
        it('should throw NotFoundException if project does not exist', async () => {
            projectRepo.findOne.mockResolvedValue(null);

            await expect(
                service.getProjectActivity(ADMIN_USER_ID, 'non-existent-proj'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if user is not a project member (cross-tenant rejection)', async () => {
            projectRepo.findOne.mockResolvedValue(mockProjectA);
            memberRepo.findOne.mockResolvedValue(null);

            await expect(
                service.getProjectActivity(OUTSIDER_USER_ID, PROJ_A_ID),
            ).rejects.toThrow(new ForbiddenException('You are not a member of this project'));
        });

        it('should throw ForbiddenException if user is VIEWER (read-only member cannot access audit log)', async () => {
            projectRepo.findOne.mockResolvedValue(mockProjectA);
            memberRepo.findOne.mockResolvedValue(mockViewerMember);

            await expect(
                service.getProjectActivity(VIEWER_USER_ID, PROJ_A_ID),
            ).rejects.toThrow(new ForbiddenException('Only project admins can view project-level activity audit logs'));
        });

        it('should throw ForbiddenException if user is DEVELOPER (non-admin cannot access audit log)', async () => {
            projectRepo.findOne.mockResolvedValue(mockProjectA);
            memberRepo.findOne.mockResolvedValue(mockDevMember);

            await expect(
                service.getProjectActivity(DEV_USER_ID, PROJ_A_ID),
            ).rejects.toThrow(new ForbiddenException('Only project admins can view project-level activity audit logs'));
        });

        it('should allow PROJECT_ADMIN to query project activity including deleted-issue records', async () => {
            projectRepo.findOne.mockResolvedValue(mockProjectA);
            memberRepo.findOne.mockResolvedValue(mockAdminMember);

            const mockActivities = [
                {
                    id: 'act-active',
                    issueId: ISSUE_1_ID,
                    userId: ADMIN_USER_ID,
                    actionType: ActivityActionType.ISSUE_CREATED,
                    oldValue: null,
                    newValue: { title: 'Active Issue 1' },
                    createdAt: new Date(),
                },
                {
                    id: 'act-deleted',
                    issueId: null, // Issue was removed, FK SET NULL preserved audit row
                    userId: ADMIN_USER_ID,
                    actionType: ActivityActionType.ISSUE_DELETED,
                    oldValue: { title: 'Deleted Issue', projectId: PROJ_A_ID },
                    newValue: null,
                    createdAt: new Date(),
                },
            ];

            const mockQueryBuilder: any = {
                leftJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                orWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockActivities),
            };

            activityRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const results = await service.getProjectActivity(ADMIN_USER_ID, PROJ_A_ID);

            expect(results).toHaveLength(2);
            expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith(Issue, 'issue', 'activity.issueId = issue.id');
            expect(mockQueryBuilder.where).toHaveBeenCalledWith('CAST(issue.projectId AS text) = :projectId', { projectId: PROJ_A_ID });
            expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
                "(activity.issueId IS NULL AND (activity.newValue ->> 'projectId' = :projectId OR activity.oldValue ->> 'projectId' = :projectId))",
                { projectId: PROJ_A_ID },
            );
            expect(results[1].actionType).toBe(ActivityActionType.ISSUE_DELETED);
            expect(results[1].issueId).toBeNull();
            expect(results[1].oldValue).toEqual({ title: 'Deleted Issue', projectId: PROJ_A_ID });
        });
    });
});
