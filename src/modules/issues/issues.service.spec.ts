/**
 * IssuesService Unit & RBAC Authorization Tests
 * Tests permission enforcement (VIEWER read-only, DEVELOPER, PROJECT_ADMIN),
 * tenant isolation, status transitions, and activity log tracking.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { Issue, IssueStatus, IssuePriority, IssueType } from './entities/issue.entity';
import { ProjectMember, ProjectRole } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { Sprint, SprintStatus } from '../sprints/entities/sprint.entity';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityActionType } from '../activity-log/entities/activity-log.entity';

const mockRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto) => ({ ...dto })),
    save: jest.fn((entity) => Promise.resolve({ id: entity.id || 'issue-uuid-1', createdAt: new Date(), ...entity })),
    remove: jest.fn().mockResolvedValue({}),
});

const mockActivityLogService = () => ({
    recordActivity: jest.fn().mockResolvedValue(undefined),
});

describe('IssuesService — RBAC & Tenant Isolation', () => {
    let service: IssuesService;
    let issueRepo: ReturnType<typeof mockRepo>;
    let memberRepo: ReturnType<typeof mockRepo>;
    let projectRepo: ReturnType<typeof mockRepo>;
    let sprintRepo: ReturnType<typeof mockRepo>;
    let activityLogService: ReturnType<typeof mockActivityLogService>;

    const PROJ_A_ID = 'proj-a-111';
    const PROJ_B_ID = 'proj-b-222';

    const ADMIN_USER_ID = 'user-admin';
    const DEV_USER_ID = 'user-dev';
    const VIEWER_USER_ID = 'user-viewer';
    const STRANGER_USER_ID = 'user-stranger';

    const ADMIN_MEMBER: ProjectMember = {
        id: 'mem-admin',
        userId: ADMIN_USER_ID,
        projectId: PROJ_A_ID,
        role: ProjectRole.PROJECT_ADMIN,
        joinedAt: new Date('2026-01-01'),
        user: null as any,
        project: null as any,
    };

    const DEV_MEMBER: ProjectMember = {
        id: 'mem-dev',
        userId: DEV_USER_ID,
        projectId: PROJ_A_ID,
        role: ProjectRole.DEVELOPER,
        joinedAt: new Date('2026-01-02'),
        user: null as any,
        project: null as any,
    };

    const VIEWER_MEMBER: ProjectMember = {
        id: 'mem-viewer',
        userId: VIEWER_USER_ID,
        projectId: PROJ_A_ID,
        role: ProjectRole.VIEWER,
        joinedAt: new Date('2026-01-03'),
        user: null as any,
        project: null as any,
    };

    const BASE_ISSUE: Issue = {
        id: 'issue-1',
        projectId: PROJ_A_ID,
        boardId: null,
        sprintId: null,
        issueKey: 'PROJ-1',
        title: 'Initial Task',
        description: 'Task description',
        issueType: IssueType.TASK,
        status: IssueStatus.TODO,
        priority: IssuePriority.MEDIUM,
        reporterId: ADMIN_USER_ID,
        assigneeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        project: null as any,
        reporter: null as any,
        assignee: null,
        sprint: null,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IssuesService,
                { provide: getRepositoryToken(Issue), useFactory: mockRepo },
                { provide: getRepositoryToken(ProjectMember), useFactory: mockRepo },
                { provide: getRepositoryToken(Project), useFactory: mockRepo },
                { provide: getRepositoryToken(Sprint), useFactory: mockRepo },
                { provide: ActivityLogService, useFactory: mockActivityLogService },
            ],
        }).compile();

        service = module.get<IssuesService>(IssuesService);
        issueRepo = module.get(getRepositoryToken(Issue));
        memberRepo = module.get(getRepositoryToken(ProjectMember));
        projectRepo = module.get(getRepositoryToken(Project));
        sprintRepo = module.get(getRepositoryToken(Sprint));
        activityLogService = module.get(ActivityLogService);

        jest.clearAllMocks();
    });

    // =========================================================================
    // 1. VIEWER RESTRICTIONS (The confirmed bugfix)
    // =========================================================================
    describe('1. Viewer Permissions Enforcement', () => {
        it('VIEWER cannot change issue status (throws ForbiddenException)', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE });
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);

            await expect(
                service.updateIssueStatus(VIEWER_USER_ID, BASE_ISSUE.id, IssueStatus.IN_PROGRESS),
            ).rejects.toThrow(ForbiddenException);

            expect(issueRepo.save).not.toHaveBeenCalled();
            expect(activityLogService.recordActivity).not.toHaveBeenCalled();
        });

        it('VIEWER cannot create issues (throws ForbiddenException)', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);

            await expect(
                service.createIssue(VIEWER_USER_ID, PROJ_A_ID, { title: 'Unauthorized by viewer' }),
            ).rejects.toThrow(ForbiddenException);

            expect(issueRepo.save).not.toHaveBeenCalled();
            expect(activityLogService.recordActivity).not.toHaveBeenCalled();
        });

        it('VIEWER cannot update issue metadata (throws ForbiddenException)', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE });
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);

            await expect(
                service.updateIssue(VIEWER_USER_ID, BASE_ISSUE.id, { title: 'New Title by viewer' }),
            ).rejects.toThrow(ForbiddenException);

            expect(issueRepo.save).not.toHaveBeenCalled();
            expect(activityLogService.recordActivity).not.toHaveBeenCalled();
        });

        it('VIEWER cannot modify sprint assignment (throws ForbiddenException)', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE });
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);

            await expect(
                service.updateIssueSprint(VIEWER_USER_ID, BASE_ISSUE.id, 'sprint-1'),
            ).rejects.toThrow(ForbiddenException);

            expect(issueRepo.save).not.toHaveBeenCalled();
        });

        it('VIEWER cannot delete issue (throws ForbiddenException)', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE });
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);

            await expect(
                service.deleteIssue(VIEWER_USER_ID, BASE_ISSUE.id),
            ).rejects.toThrow(ForbiddenException);

            expect(issueRepo.remove).not.toHaveBeenCalled();
        });

        it('VIEWER can view project issues (permitted read operation)', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);
            issueRepo.find.mockResolvedValue([{ ...BASE_ISSUE }]);

            const issues = await service.getProjectIssues(VIEWER_USER_ID, PROJ_A_ID);
            expect(issues).toHaveLength(1);
            expect(issues[0].title).toBe('Initial Task');
        });

        it('VIEWER can view single issue details (permitted read operation)', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE });
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);

            const issue = await service.getIssueById(VIEWER_USER_ID, BASE_ISSUE.id);
            expect(issue.id).toBe(BASE_ISSUE.id);
            expect(issue.title).toBe('Initial Task');
        });
    });

    // =========================================================================
    // 2. PERMITTED MUTATIONS (DEVELOPER and PROJECT_ADMIN)
    // =========================================================================
    describe('2. Authorized Roles Operations', () => {
        it('DEVELOPER can create issue and records ISSUE_CREATED activity', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);
            issueRepo.create.mockReturnValue({ ...BASE_ISSUE, id: 'new-issue' });
            issueRepo.save.mockResolvedValue({ ...BASE_ISSUE, id: 'new-issue' });

            const result = await service.createIssue(DEV_USER_ID, PROJ_A_ID, {
                title: 'New dev task',
                priority: IssuePriority.HIGH,
            });

            expect(result.id).toBe('new-issue');
            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                'new-issue',
                DEV_USER_ID,
                ActivityActionType.ISSUE_CREATED,
                null,
                { title: 'Initial Task' },
            );
        });

        it('DEVELOPER can update issue status and records STATUS_CHANGED activity', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE, status: IssueStatus.TODO });
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);

            await service.updateIssueStatus(DEV_USER_ID, BASE_ISSUE.id, IssueStatus.IN_PROGRESS);

            expect(issueRepo.save).toHaveBeenCalled();
            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                BASE_ISSUE.id,
                DEV_USER_ID,
                ActivityActionType.STATUS_CHANGED,
                { oldStatus: IssueStatus.TODO },
                { newStatus: IssueStatus.IN_PROGRESS },
            );
        });

        it('DEVELOPER can update issue details and assignee', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE, assigneeId: null });
            memberRepo.findOne
                .mockResolvedValueOnce(DEV_MEMBER) // check caller membership
                .mockResolvedValueOnce(ADMIN_MEMBER); // check assignee membership

            await service.updateIssue(DEV_USER_ID, BASE_ISSUE.id, {
                title: 'Updated title',
                assigneeId: ADMIN_USER_ID,
            });

            expect(issueRepo.save).toHaveBeenCalled();
            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                BASE_ISSUE.id,
                DEV_USER_ID,
                ActivityActionType.ASSIGNEE_CHANGED,
                { oldAssigneeId: null },
                { newAssigneeId: ADMIN_USER_ID },
            );
        });

        it('DEVELOPER cannot delete issue (only ADMIN can delete)', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE });
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);

            await expect(
                service.deleteIssue(DEV_USER_ID, BASE_ISSUE.id),
            ).rejects.toThrow(ForbiddenException);

            expect(issueRepo.remove).not.toHaveBeenCalled();
        });

        it('ADMIN can delete issue and records ISSUE_DELETED activity before remove', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);

            const res = await service.deleteIssue(ADMIN_USER_ID, BASE_ISSUE.id);
            expect(res.message).toBe('Issue deleted successfully');
            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                BASE_ISSUE.id,
                ADMIN_USER_ID,
                ActivityActionType.ISSUE_DELETED,
                { title: BASE_ISSUE.title, projectId: BASE_ISSUE.projectId },
                null,
            );
            expect(issueRepo.remove).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // 3. TENANT ISOLATION & NEGATIVE ACCESS TESTS
    // =========================================================================
    describe('3. Tenant Isolation & Cross-Project Protection', () => {
        it('Non-member cannot access issue in Project A (ForbiddenException)', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE, projectId: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(null); // not a member

            await expect(
                service.getIssueById(STRANGER_USER_ID, BASE_ISSUE.id),
            ).rejects.toThrow(ForbiddenException);
        });

        it('Non-member cannot change issue status (ForbiddenException)', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE, projectId: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(null);

            await expect(
                service.updateIssueStatus(STRANGER_USER_ID, BASE_ISSUE.id, IssueStatus.IN_PROGRESS),
            ).rejects.toThrow(ForbiddenException);

            expect(issueRepo.save).not.toHaveBeenCalled();
        });

        it('Cannot assign an issue to a user from another project/tenant', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne
                .mockResolvedValueOnce(DEV_MEMBER) // caller is in Project A
                .mockResolvedValueOnce(null); // assignee is NOT in Project A

            await expect(
                service.createIssue(DEV_USER_ID, PROJ_A_ID, {
                    title: 'Task with cross-tenant assignee',
                    assigneeId: STRANGER_USER_ID,
                }),
            ).rejects.toThrow(BadRequestException);

            expect(issueRepo.save).not.toHaveBeenCalled();
        });

        it('Cannot bind an issue to a sprint belonging to a different project', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE, projectId: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);
            sprintRepo.findOne.mockResolvedValue({
                id: 'sprint-other-proj',
                projectId: PROJ_B_ID, // Different project!
                status: SprintStatus.PLANNED,
            });

            await expect(
                service.updateIssueSprint(DEV_USER_ID, BASE_ISSUE.id, 'sprint-other-proj'),
            ).rejects.toThrow(BadRequestException);

            expect(issueRepo.save).not.toHaveBeenCalled();
        });

        it('Cannot bind an issue to a completed sprint', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE, projectId: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);
            sprintRepo.findOne.mockResolvedValue({
                id: 'sprint-completed',
                projectId: PROJ_A_ID,
                status: SprintStatus.COMPLETED,
            });

            await expect(
                service.updateIssueSprint(DEV_USER_ID, BASE_ISSUE.id, 'sprint-completed'),
            ).rejects.toThrow(BadRequestException);

            expect(issueRepo.save).not.toHaveBeenCalled();
        });

        it('Member of Project B cannot access Project A issues list', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(null); // User has no membership in Project A

            await expect(
                service.getProjectIssues('user-from-proj-b', PROJ_A_ID),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    // =========================================================================
    // 4. STATUS TRANSITION VALIDATION
    // =========================================================================
    describe('4. Status Transition Business Logic', () => {
        it('Invalid direct jump from TODO to DONE is rejected with BadRequestException', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE, status: IssueStatus.TODO });
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);

            await expect(
                service.updateIssueStatus(DEV_USER_ID, BASE_ISSUE.id, IssueStatus.DONE),
            ).rejects.toThrow(BadRequestException);

            expect(issueRepo.save).not.toHaveBeenCalled();
            expect(activityLogService.recordActivity).not.toHaveBeenCalled();
        });

        it('Valid progression: TODO -> IN_PROGRESS -> DONE', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE, status: IssueStatus.IN_PROGRESS });
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);

            await service.updateIssueStatus(DEV_USER_ID, BASE_ISSUE.id, IssueStatus.DONE);

            expect(issueRepo.save).toHaveBeenCalled();
            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                BASE_ISSUE.id,
                DEV_USER_ID,
                ActivityActionType.STATUS_CHANGED,
                { oldStatus: IssueStatus.IN_PROGRESS },
                { newStatus: IssueStatus.DONE },
            );
        });

        it('Valid regression: IN_PROGRESS -> TODO', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE, status: IssueStatus.IN_PROGRESS });
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);

            await service.updateIssueStatus(DEV_USER_ID, BASE_ISSUE.id, IssueStatus.TODO);

            expect(issueRepo.save).toHaveBeenCalled();
        });

        it('Invalid transition from DONE to TODO is rejected (must go to IN_PROGRESS first)', async () => {
            issueRepo.findOne.mockResolvedValue({ ...BASE_ISSUE, status: IssueStatus.DONE });
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);

            await expect(
                service.updateIssueStatus(DEV_USER_ID, BASE_ISSUE.id, IssueStatus.TODO),
            ).rejects.toThrow(BadRequestException);

            expect(issueRepo.save).not.toHaveBeenCalled();
        });
    });
});
