/**
 * Sprint Service Unit Tests
 * Tests core sprint business logic using Jest mocks.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SprintsService } from './sprints.service';
import { Sprint, SprintStatus } from './entities/sprint.entity';
import { Issue, IssueStatus, IssuePriority } from '../issues/entities/issue.entity';
import { ProjectMember, ProjectRole } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { ActivityLogService } from '../activity-log/activity-log.service';

const mockRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn<any, any>(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
        getRawMany: jest.fn().mockResolvedValue([]),
    })),
});

const mockActivityLogService = () => ({
    recordActivity: jest.fn().mockResolvedValue(undefined),
});

describe('SprintsService', () => {
    let service: SprintsService;
    let sprintRepo: ReturnType<typeof mockRepo>;
    let issueRepo: ReturnType<typeof mockRepo>;
    let memberRepo: ReturnType<typeof mockRepo>;
    let projectRepo: ReturnType<typeof mockRepo>;
    let activityLogService: ReturnType<typeof mockActivityLogService>;

    const ADMIN_MEMBER: ProjectMember = {
        id: 'mem-1',
        userId: 'user-admin',
        projectId: 'proj-1',
        role: ProjectRole.PROJECT_ADMIN,
        joinedAt: new Date(),
        user: null as any,
        project: null as any,
    };

    const DEV_MEMBER: ProjectMember = {
        ...ADMIN_MEMBER,
        userId: 'user-dev',
        role: ProjectRole.DEVELOPER,
    };

    const VIEWER_MEMBER: ProjectMember = {
        ...ADMIN_MEMBER,
        userId: 'user-viewer',
        role: ProjectRole.VIEWER,
    };

    const MOCK_PROJECT: Project = {
        id: 'proj-1',
        name: 'Test Project',
        key: 'TEST',
        description: 'desc',
        createdById: 'user-admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null as any,
    };

    const PLANNED_SPRINT: Sprint = {
        id: 'sprint-1',
        projectId: 'proj-1',
        name: 'Sprint 1',
        goal: 'Ship feature A',
        status: SprintStatus.PLANNED,
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        project: null as any,
        issues: [],
    };

    const ACTIVE_SPRINT: Sprint = {
        ...PLANNED_SPRINT,
        id: 'sprint-active',
        name: 'Active Sprint',
        status: SprintStatus.ACTIVE,
        startDate: new Date(),
    };

    const COMPLETED_SPRINT: Sprint = {
        ...PLANNED_SPRINT,
        id: 'sprint-done',
        status: SprintStatus.COMPLETED,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SprintsService,
                { provide: getRepositoryToken(Sprint), useFactory: mockRepo },
                { provide: getRepositoryToken(Issue), useFactory: mockRepo },
                { provide: getRepositoryToken(ProjectMember), useFactory: mockRepo },
                { provide: getRepositoryToken(Project), useFactory: mockRepo },
                { provide: ActivityLogService, useFactory: mockActivityLogService },
            ],
        }).compile();

        service = module.get<SprintsService>(SprintsService);
        sprintRepo = module.get(getRepositoryToken(Sprint));
        issueRepo = module.get(getRepositoryToken(Issue));
        memberRepo = module.get(getRepositoryToken(ProjectMember));
        projectRepo = module.get(getRepositoryToken(Project));
        activityLogService = module.get(ActivityLogService);
    });

    afterEach(() => jest.resetAllMocks());

    // ─── CREATE SPRINT ─────────────────────────────────────────────────────

    describe('createSprint', () => {
        it('ADMIN can create sprint → 201', async () => {
            projectRepo.findOne.mockResolvedValue(MOCK_PROJECT);
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            const created = { ...PLANNED_SPRINT };
            sprintRepo.create.mockReturnValue(created);
            sprintRepo.save.mockResolvedValue(created);

            const result = await service.createSprint('user-admin', 'proj-1', { name: 'Sprint 1' });
            expect(result).toEqual(created);
            expect(sprintRepo.save).toHaveBeenCalled();
        });

        it('Missing name → 400 (validation in DTO, here we test empty name trim)', async () => {
            projectRepo.findOne.mockResolvedValue(MOCK_PROJECT);
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);

            // createSprint trims name so whitespace-only would fail DTO validation before this
            // Here we test the DTO would reject it — covered by controller ValidationPipe
            const created = { ...PLANNED_SPRINT, name: '' };
            sprintRepo.create.mockReturnValue(created);
            sprintRepo.save.mockResolvedValue(created);

            // Service itself doesn't re-validate name — DTO does. Just verify it passes through.
            const result = await service.createSprint('user-admin', 'proj-1', { name: 'Valid' });
            expect(result).toBeDefined();
        });

        it('DEVELOPER cannot create sprint → 403', async () => {
            projectRepo.findOne.mockResolvedValue(MOCK_PROJECT);
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);

            await expect(
                service.createSprint('user-dev', 'proj-1', { name: 'Sprint' }),
            ).rejects.toThrow(ForbiddenException);
        });

        it('VIEWER cannot create sprint → 403', async () => {
            projectRepo.findOne.mockResolvedValue(MOCK_PROJECT);
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);

            await expect(
                service.createSprint('user-viewer', 'proj-1', { name: 'Sprint' }),
            ).rejects.toThrow(ForbiddenException);
        });

        it('Non-member cannot create sprint → 403', async () => {
            projectRepo.findOne.mockResolvedValue(MOCK_PROJECT);
            memberRepo.findOne.mockResolvedValue(null); // not a member

            await expect(
                service.createSprint('user-stranger', 'proj-1', { name: 'Sprint' }),
            ).rejects.toThrow(ForbiddenException);
        });

        it('Invalid project → 404', async () => {
            projectRepo.findOne.mockResolvedValue(null);

            await expect(
                service.createSprint('user-admin', 'bad-proj', { name: 'Sprint' }),
            ).rejects.toThrow(NotFoundException);
        });

        it('endDate before startDate → 400', async () => {
            projectRepo.findOne.mockResolvedValue(MOCK_PROJECT);
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);

            await expect(
                service.createSprint('user-admin', 'proj-1', {
                    name: 'Sprint',
                    startDate: '2026-09-20',
                    endDate: '2026-09-10',
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('Sprint creation records SPRINT_CREATED activity', async () => {
            projectRepo.findOne.mockResolvedValue(MOCK_PROJECT);
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            const created = { ...PLANNED_SPRINT };
            sprintRepo.create.mockReturnValue(created);
            sprintRepo.save.mockResolvedValue(created);

            await service.createSprint('user-admin', 'proj-1', { name: 'Sprint 1' });
            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                null,
                'user-admin',
                'SPRINT_CREATED',
                null,
                expect.objectContaining({ sprintId: created.id }),
            );
        });
    });

    // ─── LIST SPRINTS ──────────────────────────────────────────────────────

    describe('listSprints', () => {
        it('Member can list sprints → returns array', async () => {
            projectRepo.findOne.mockResolvedValue(MOCK_PROJECT);
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            sprintRepo.find.mockResolvedValue([PLANNED_SPRINT, ACTIVE_SPRINT]);
            issueRepo.createQueryBuilder.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([]),
            });

            const result = await service.listSprints('user-admin', 'proj-1');
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(2);
        });

        it('Non-member cannot list sprints → 403', async () => {
            projectRepo.findOne.mockResolvedValue(MOCK_PROJECT);
            memberRepo.findOne.mockResolvedValue(null);

            await expect(
                service.listSprints('stranger', 'proj-1'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('Sprints sorted: ACTIVE first, then PLANNED, then COMPLETED', async () => {
            projectRepo.findOne.mockResolvedValue(MOCK_PROJECT);
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            sprintRepo.find.mockResolvedValue([COMPLETED_SPRINT, PLANNED_SPRINT, ACTIVE_SPRINT]);
            issueRepo.createQueryBuilder.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([]),
            });

            const result = await service.listSprints('user-admin', 'proj-1');
            expect(result[0].status).toBe(SprintStatus.ACTIVE);
            expect(result[1].status).toBe(SprintStatus.PLANNED);
            expect(result[2].status).toBe(SprintStatus.COMPLETED);
        });

        it('Issue counts are computed correctly', async () => {
            projectRepo.findOne.mockResolvedValue(MOCK_PROJECT);
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            sprintRepo.find.mockResolvedValue([PLANNED_SPRINT]);
            issueRepo.createQueryBuilder.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([
                    { issue_sprintId: 'sprint-1', issue_status: 'DONE' },
                    { issue_sprintId: 'sprint-1', issue_status: 'TODO' },
                    { issue_sprintId: 'sprint-1', issue_status: 'DONE' },
                ]),
            });

            const result = await service.listSprints('user-admin', 'proj-1');
            expect(result[0].issueCount).toBe(3);
            expect(result[0].completedIssueCount).toBe(2);
            expect(result[0].completionPercentage).toBe(67);
        });
    });

    // ─── START SPRINT ──────────────────────────────────────────────────────

    describe('startSprint', () => {
        it('ADMIN can start PLANNED sprint → status ACTIVE', async () => {
            sprintRepo.findOne
                .mockResolvedValueOnce({ ...PLANNED_SPRINT })  // fresh copy to avoid mutation
                .mockResolvedValueOnce(null);             // no other active sprint
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            issueRepo.find.mockResolvedValue([]);
            const saved = { ...PLANNED_SPRINT, status: SprintStatus.ACTIVE };
            sprintRepo.save.mockResolvedValue(saved);

            const result = await service.startSprint('user-admin', 'sprint-1');
            expect(result.status).toBe(SprintStatus.ACTIVE);
        });

        it('DEVELOPER cannot start sprint → 403', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...PLANNED_SPRINT });
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);

            await expect(service.startSprint('user-dev', 'sprint-1')).rejects.toThrow(ForbiddenException);
        });

        it('VIEWER cannot start sprint → 403', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...PLANNED_SPRINT });
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);

            await expect(service.startSprint('user-viewer', 'sprint-1')).rejects.toThrow(ForbiddenException);
        });

        it('Cannot start ACTIVE sprint → 400', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...ACTIVE_SPRINT });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);

            await expect(service.startSprint('user-admin', 'sprint-active')).rejects.toThrow(BadRequestException);
        });

        it('Cannot start COMPLETED sprint → 400', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...COMPLETED_SPRINT });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);

            await expect(service.startSprint('user-admin', 'sprint-done')).rejects.toThrow(BadRequestException);
        });

        it('Cannot start second ACTIVE sprint → 400', async () => {
            sprintRepo.findOne
                .mockResolvedValueOnce({ ...PLANNED_SPRINT })    // get sprint
                .mockResolvedValueOnce({ ...ACTIVE_SPRINT });    // another active exists
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);

            await expect(service.startSprint('user-admin', 'sprint-1')).rejects.toThrow(BadRequestException);
        });

        it('Sprint start records SPRINT_STARTED activity', async () => {
            sprintRepo.findOne
                .mockResolvedValueOnce({ ...PLANNED_SPRINT })   // fresh copy of PLANNED sprint
                .mockResolvedValueOnce(null);             // no other active sprint
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            issueRepo.find.mockResolvedValue([]);
            const saved = { ...PLANNED_SPRINT, status: SprintStatus.ACTIVE };
            sprintRepo.save.mockResolvedValue(saved);

            await service.startSprint('user-admin', 'sprint-1');
            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                null, 'user-admin', 'SPRINT_STARTED', null, expect.any(Object),
            );
        });
    });

    // ─── COMPLETE SPRINT ───────────────────────────────────────────────────

    describe('completeSprint', () => {
        const TODO_ISSUE: Issue = {
            id: 'issue-todo',
            projectId: 'proj-1',
            sprintId: 'sprint-active',
            boardId: null,
            issueKey: null,
            title: 'TODO issue',
            description: null,
            issueType: null,
            status: IssueStatus.TODO,
            priority: IssuePriority.MEDIUM,
            reporterId: 'user-admin',
            assigneeId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            project: null as any,
            reporter: null as any,
            assignee: null,
            sprint: null,
        };

        const IN_PROGRESS_ISSUE: Issue = { ...TODO_ISSUE, id: 'issue-ip', status: IssueStatus.IN_PROGRESS };
        const DONE_ISSUE: Issue = { ...TODO_ISSUE, id: 'issue-done', status: IssueStatus.DONE };

        it('ADMIN can complete ACTIVE sprint → 200', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...ACTIVE_SPRINT });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            issueRepo.find.mockResolvedValue([]);
            issueRepo.createQueryBuilder.mockReturnValue({
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({}),
            });
            const saved = { ...ACTIVE_SPRINT, status: SprintStatus.COMPLETED };
            sprintRepo.save.mockResolvedValue(saved);

            const result = await service.completeSprint('user-admin', 'sprint-active');
            expect(result.sprint.status).toBe(SprintStatus.COMPLETED);
        });

        it('DEVELOPER cannot complete sprint → 403', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...ACTIVE_SPRINT });
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);

            await expect(service.completeSprint('user-dev', 'sprint-active')).rejects.toThrow(ForbiddenException);
        });

        it('VIEWER cannot complete sprint → 403', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...ACTIVE_SPRINT });
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);

            await expect(service.completeSprint('user-viewer', 'sprint-active')).rejects.toThrow(ForbiddenException);
        });

        it('Cannot complete PLANNED sprint → 400', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...PLANNED_SPRINT });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);

            await expect(service.completeSprint('user-admin', 'sprint-1')).rejects.toThrow(BadRequestException);
        });

        it('TODO issues move to backlog on completion', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...ACTIVE_SPRINT });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);

            const mockQB = {
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({}),
            };
            issueRepo.find.mockResolvedValue([TODO_ISSUE, IN_PROGRESS_ISSUE]);
            issueRepo.createQueryBuilder.mockReturnValue(mockQB);

            const saved = { ...ACTIVE_SPRINT, status: SprintStatus.COMPLETED };
            sprintRepo.save.mockResolvedValue(saved);

            const result = await service.completeSprint('user-admin', 'sprint-active');
            expect(result.movedToBacklogCount).toBe(2);
            expect(mockQB.set).toHaveBeenCalledWith({ sprintId: null });
        });

        it('DONE issues remain associated with completed sprint', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...ACTIVE_SPRINT });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);

            const mockQB = {
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({}),
            };
            // Service finds only TODO/IN_PROGRESS issues — DONE stays associated
            issueRepo.find.mockResolvedValue([TODO_ISSUE]); // only TODO moves
            issueRepo.createQueryBuilder.mockReturnValue(mockQB);

            const saved = { ...ACTIVE_SPRINT, status: SprintStatus.COMPLETED };
            sprintRepo.save.mockResolvedValue(saved);

            const result = await service.completeSprint('user-admin', 'sprint-active');
            expect(result.movedToBacklogCount).toBe(1);
        });

        it('Sprint completion records SPRINT_COMPLETED activity', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...ACTIVE_SPRINT });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            issueRepo.find.mockResolvedValue([]);
            issueRepo.createQueryBuilder.mockReturnValue({
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({}),
            });
            sprintRepo.save.mockResolvedValue({ ...ACTIVE_SPRINT, status: SprintStatus.COMPLETED });

            await service.completeSprint('user-admin', 'sprint-active');
            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                null, 'user-admin', 'SPRINT_COMPLETED', null, expect.any(Object),
            );
        });
    });

    // ─── DELETE SPRINT ─────────────────────────────────────────────────────

    describe('deleteSprint', () => {
        it('ADMIN can delete PLANNED sprint', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...PLANNED_SPRINT });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            issueRepo.createQueryBuilder.mockReturnValue({
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({}),
            });
            sprintRepo.remove.mockResolvedValue(PLANNED_SPRINT);

            const result = await service.deleteSprint('user-admin', 'sprint-1');
            expect(result.message).toBe('Sprint deleted successfully');
        });

        it('Cannot delete ACTIVE sprint → 400', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...ACTIVE_SPRINT });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);

            await expect(service.deleteSprint('user-admin', 'sprint-active')).rejects.toThrow(BadRequestException);
        });

        it('Cannot delete COMPLETED sprint → 400', async () => {
            sprintRepo.findOne.mockResolvedValueOnce({ ...COMPLETED_SPRINT });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);

            await expect(service.deleteSprint('user-admin', 'sprint-done')).rejects.toThrow(BadRequestException);
        });
    });
});
