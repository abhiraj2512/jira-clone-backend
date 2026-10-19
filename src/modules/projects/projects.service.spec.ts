/**
 * Phase 9 - Project Team / Members Management & RBAC Unit Tests
 * Tests all 32 requirements from Phase 9 using Jest mocks.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getEntityManagerToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { Project } from './entities/project.entity';
import { ProjectMember, ProjectRole } from '../project-members/entities/project-member.entity';
import { User } from '../users/entities/user.entity';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityActionType } from '../activity-log/entities/activity-log.entity';
import { ProjectRoleGuard } from '../auth/guards/project-role.guard';

const mockRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto) => ({ ...dto })),
    save: jest.fn((entity) => Promise.resolve({ id: entity.id || 'new-uuid', joinedAt: new Date(), ...entity })),
    remove: jest.fn().mockResolvedValue({}),
    count: jest.fn(),
});

const mockActivityLogService = () => ({
    recordActivity: jest.fn().mockResolvedValue(undefined),
});

describe('Phase 9 — ProjectsService & Members Management', () => {
    let service: ProjectsService;
    let controller: ProjectsController;
    let guard: ProjectRoleGuard;
    let reflector: Reflector;

    let projectRepo: ReturnType<typeof mockRepo>;
    let memberRepo: ReturnType<typeof mockRepo>;
    let userRepo: ReturnType<typeof mockRepo>;
    let activityLogService: ReturnType<typeof mockActivityLogService>;

    const PROJ_A_ID = 'proj-a-111';
    const PROJ_B_ID = 'proj-b-222';

    const ADMIN_USER: User = {
        id: 'user-admin',
        email: 'admin@example.com',
        fullName: 'Admin User',
        passwordHash: 'hash',
        avatarUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const DEV_USER: User = {
        ...ADMIN_USER,
        id: 'user-dev',
        email: 'dev@example.com',
        fullName: 'Dev User',
    };

    const VIEWER_USER: User = {
        ...ADMIN_USER,
        id: 'user-viewer',
        email: 'viewer@example.com',
        fullName: 'Viewer User',
    };

    const NEW_USER: User = {
        ...ADMIN_USER,
        id: 'user-new',
        email: 'newbie@example.com',
        fullName: 'New User',
    };

    const ADMIN_MEMBER: ProjectMember = {
        id: 'mem-admin',
        userId: ADMIN_USER.id,
        projectId: PROJ_A_ID,
        role: ProjectRole.PROJECT_ADMIN,
        joinedAt: new Date('2026-01-01'),
        user: ADMIN_USER,
        project: null as any,
    };

    const DEV_MEMBER: ProjectMember = {
        id: 'mem-dev',
        userId: DEV_USER.id,
        projectId: PROJ_A_ID,
        role: ProjectRole.DEVELOPER,
        joinedAt: new Date('2026-01-02'),
        user: DEV_USER,
        project: null as any,
    };

    const VIEWER_MEMBER: ProjectMember = {
        id: 'mem-viewer',
        userId: VIEWER_USER.id,
        projectId: PROJ_A_ID,
        role: ProjectRole.VIEWER,
        joinedAt: new Date('2026-01-03'),
        user: VIEWER_USER,
        project: null as any,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ProjectsController],
            providers: [
                ProjectsService,
                ProjectRoleGuard,
                Reflector,
                { provide: getRepositoryToken(Project), useFactory: mockRepo },
                { provide: getRepositoryToken(ProjectMember), useFactory: mockRepo },
                { provide: getRepositoryToken(User), useFactory: mockRepo },
                { provide: ActivityLogService, useFactory: mockActivityLogService },
            ],
        }).compile();

        service = module.get<ProjectsService>(ProjectsService);
        controller = module.get<ProjectsController>(ProjectsController);
        guard = module.get<ProjectRoleGuard>(ProjectRoleGuard);
        reflector = module.get<Reflector>(Reflector);

        projectRepo = module.get(getRepositoryToken(Project));
        memberRepo = module.get(getRepositoryToken(ProjectMember));
        userRepo = module.get(getRepositoryToken(User));
        activityLogService = module.get(ActivityLogService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // Helper to simulate ProjectRoleGuard execution
    const runGuard = async (user: any, projectId: string, requiredRoles: ProjectRole[]) => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
        const context = {
            getHandler: () => ({}),
            getClass: () => ({}),
            switchToHttp: () => ({
                getRequest: () => ({
                    user,
                    params: { id: projectId },
                }),
            }),
        } as unknown as ExecutionContext;
        return guard.canActivate(context);
    };

    // =========================================================================
    // 1. AUTHENTICATION (Tests 1-4)
    // =========================================================================
    describe('Authentication', () => {
        it('1. unauthenticated cannot list members (throws when user is missing or non-member)', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(null); // No membership
            await expect(service.getProjectMembers(PROJ_A_ID, 'non-existent-user')).rejects.toThrow(ForbiddenException);
        });

        it('2. unauthenticated cannot add member (guard blocks unauthenticated)', async () => {
            await expect(runGuard(null, PROJ_A_ID, [ProjectRole.PROJECT_ADMIN])).rejects.toThrow(ForbiddenException);
        });

        it('3. unauthenticated cannot change role (guard blocks unauthenticated)', async () => {
            await expect(runGuard(undefined, PROJ_A_ID, [ProjectRole.PROJECT_ADMIN])).rejects.toThrow(ForbiddenException);
        });

        it('4. unauthenticated cannot remove member (guard blocks unauthenticated)', async () => {
            await expect(runGuard({ userId: null }, PROJ_A_ID, [ProjectRole.PROJECT_ADMIN])).rejects.toThrow(ForbiddenException);
        });
    });

    // =========================================================================
    // 2. RBAC (Tests 5-16)
    // =========================================================================
    describe('RBAC', () => {
        it('5. PROJECT_ADMIN can list members', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            memberRepo.find.mockResolvedValue([ADMIN_MEMBER, DEV_MEMBER, VIEWER_MEMBER]);

            const members = await service.getProjectMembers(PROJ_A_ID, ADMIN_USER.id);
            expect(members).toHaveLength(3);
            expect(members[0].role).toBe(ProjectRole.PROJECT_ADMIN);
            expect(members[0].email).toBe(ADMIN_USER.email);
        });

        it('6. DEVELOPER can list members', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);
            memberRepo.find.mockResolvedValue([ADMIN_MEMBER, DEV_MEMBER]);

            const members = await service.getProjectMembers(PROJ_A_ID, DEV_USER.id);
            expect(members).toHaveLength(2);
        });

        it('7. VIEWER can list members', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);
            memberRepo.find.mockResolvedValue([ADMIN_MEMBER, DEV_MEMBER, VIEWER_MEMBER]);

            const members = await service.getProjectMembers(PROJ_A_ID, VIEWER_USER.id);
            expect(members).toHaveLength(3);
        });

        it('8. DEVELOPER cannot add member (guard blocks DEVELOPER)', async () => {
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);
            await expect(runGuard({ userId: DEV_USER.id }, PROJ_A_ID, [ProjectRole.PROJECT_ADMIN])).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('9. VIEWER cannot add member (guard blocks VIEWER)', async () => {
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);
            await expect(runGuard({ userId: VIEWER_USER.id }, PROJ_A_ID, [ProjectRole.PROJECT_ADMIN])).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('10. DEVELOPER cannot change role (guard blocks DEVELOPER)', async () => {
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);
            await expect(runGuard({ userId: DEV_USER.id }, PROJ_A_ID, [ProjectRole.PROJECT_ADMIN])).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('11. VIEWER cannot change role (guard blocks VIEWER)', async () => {
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);
            await expect(runGuard({ userId: VIEWER_USER.id }, PROJ_A_ID, [ProjectRole.PROJECT_ADMIN])).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('12. DEVELOPER cannot remove member (guard blocks DEVELOPER)', async () => {
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER);
            await expect(runGuard({ userId: DEV_USER.id }, PROJ_A_ID, [ProjectRole.PROJECT_ADMIN])).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('13. VIEWER cannot remove member (guard blocks VIEWER)', async () => {
            memberRepo.findOne.mockResolvedValue(VIEWER_MEMBER);
            await expect(runGuard({ userId: VIEWER_USER.id }, PROJ_A_ID, [ProjectRole.PROJECT_ADMIN])).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('14. ADMIN can add member (guard permits and service executes)', async () => {
            memberRepo.findOne.mockImplementation(({ where }: any) => {
                if (where?.userId === ADMIN_USER.id && where?.projectId === PROJ_A_ID) return Promise.resolve(ADMIN_MEMBER);
                if (where?.userId === NEW_USER.id && where?.projectId === PROJ_A_ID) return Promise.resolve(null);
                return Promise.resolve(null);
            });
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            userRepo.findOne.mockResolvedValue(NEW_USER);

            const allowed = await runGuard({ userId: ADMIN_USER.id }, PROJ_A_ID, [ProjectRole.PROJECT_ADMIN]);
            expect(allowed).toBe(true);

            const res = await service.addMember(PROJ_A_ID, { userId: NEW_USER.id, role: ProjectRole.DEVELOPER }, ADMIN_USER.id);
            expect(res.userId).toBe(NEW_USER.id);
            expect(res.role).toBe(ProjectRole.DEVELOPER);
        });

        it('15. ADMIN can change role (guard permits and service executes)', async () => {
            memberRepo.findOne.mockImplementation(({ where }: any) => {
                if (where?.userId === ADMIN_USER.id && where?.projectId === PROJ_A_ID) return Promise.resolve(ADMIN_MEMBER);
                if (Array.isArray(where)) return Promise.resolve({ ...DEV_MEMBER, user: DEV_USER });
                return Promise.resolve(null);
            });
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });

            const allowed = await runGuard({ userId: ADMIN_USER.id }, PROJ_A_ID, [ProjectRole.PROJECT_ADMIN]);
            expect(allowed).toBe(true);

            const res = await service.updateMemberRole(PROJ_A_ID, DEV_MEMBER.id, { role: ProjectRole.VIEWER }, ADMIN_USER.id);
            expect(res.role).toBe(ProjectRole.VIEWER);
        });

        it('16. ADMIN can remove member (guard permits and service executes)', async () => {
            memberRepo.findOne.mockImplementation(({ where }: any) => {
                if (where?.userId === ADMIN_USER.id && where?.projectId === PROJ_A_ID) return Promise.resolve(ADMIN_MEMBER);
                if (Array.isArray(where)) return Promise.resolve({ ...DEV_MEMBER, user: DEV_USER });
                return Promise.resolve(null);
            });
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });

            const allowed = await runGuard({ userId: ADMIN_USER.id }, PROJ_A_ID, [ProjectRole.PROJECT_ADMIN]);
            expect(allowed).toBe(true);

            const res = await service.removeMember(PROJ_A_ID, DEV_MEMBER.id, ADMIN_USER.id);
            expect(res.message).toBe('Member removed successfully');
            expect(memberRepo.remove).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // 3. VALIDATION (Tests 17-20)
    // =========================================================================
    describe('Validation', () => {
        it('17. invalid user rejected when adding member', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            userRepo.findOne.mockResolvedValue(null); // User does not exist

            await expect(
                service.addMember(PROJ_A_ID, { userId: 'invalid-user-id', role: ProjectRole.DEVELOPER }, ADMIN_USER.id),
            ).rejects.toThrow(NotFoundException);
        });

        it('18. duplicate membership rejected with ConflictException', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            userRepo.findOne.mockResolvedValue(DEV_USER);
            memberRepo.findOne.mockResolvedValue(DEV_MEMBER); // Already member

            await expect(
                service.addMember(PROJ_A_ID, { userId: DEV_USER.id, role: ProjectRole.DEVELOPER }, ADMIN_USER.id),
            ).rejects.toThrow(ConflictException);
        });

        it('19. invalid member lookup rejected when updating or removing', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(null); // Member not found

            await expect(
                service.updateMemberRole(PROJ_A_ID, 'non-existent-member', { role: ProjectRole.VIEWER }, ADMIN_USER.id),
            ).rejects.toThrow(NotFoundException);

            await expect(
                service.removeMember(PROJ_A_ID, 'non-existent-member', ADMIN_USER.id),
            ).rejects.toThrow(NotFoundException);
        });

        it('20. invalid project rejected with NotFoundException', async () => {
            projectRepo.findOne.mockResolvedValue(null); // Project not found

            await expect(
                service.getProjectMembers('invalid-project', ADMIN_USER.id),
            ).rejects.toThrow(NotFoundException);

            await expect(
                service.addMember('invalid-project', { userId: NEW_USER.id, role: ProjectRole.DEVELOPER }, ADMIN_USER.id),
            ).rejects.toThrow(NotFoundException);

            await expect(
                service.updateMemberRole('invalid-project', DEV_MEMBER.id, { role: ProjectRole.VIEWER }, ADMIN_USER.id),
            ).rejects.toThrow(NotFoundException);

            await expect(
                service.removeMember('invalid-project', DEV_MEMBER.id, ADMIN_USER.id),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // =========================================================================
    // 4. ADMIN SAFETY (Tests 21-23)
    // =========================================================================
    describe('Admin Safety', () => {
        it('21. cannot demote last PROJECT_ADMIN', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue({ ...ADMIN_MEMBER, user: ADMIN_USER });
            memberRepo.count.mockResolvedValue(1); // Only 1 admin in the project

            await expect(
                service.updateMemberRole(PROJ_A_ID, ADMIN_MEMBER.id, { role: ProjectRole.DEVELOPER }, ADMIN_USER.id),
            ).rejects.toThrow(BadRequestException);
        });

        it('22. cannot remove last PROJECT_ADMIN', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue({ ...ADMIN_MEMBER, user: ADMIN_USER });
            memberRepo.count.mockResolvedValue(1); // Only 1 admin in the project

            await expect(
                service.removeMember(PROJ_A_ID, ADMIN_MEMBER.id, ADMIN_USER.id),
            ).rejects.toThrow(BadRequestException);
        });

        it('23. multiple admins can be safely managed (demotion and removal allowed if >1 admin)', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue({ ...ADMIN_MEMBER, user: ADMIN_USER });
            memberRepo.count.mockResolvedValue(2); // 2 admins exist

            const updateRes = await service.updateMemberRole(
                PROJ_A_ID,
                ADMIN_MEMBER.id,
                { role: ProjectRole.DEVELOPER },
                ADMIN_USER.id,
            );
            expect(updateRes.role).toBe(ProjectRole.DEVELOPER);

            memberRepo.count.mockResolvedValue(2);
            const removeRes = await service.removeMember(PROJ_A_ID, ADMIN_MEMBER.id, ADMIN_USER.id);
            expect(removeRes.message).toBe('Member removed successfully');
        });
    });

    // =========================================================================
    // 5. ACTIVITY LOGGING (Tests 24-26)
    // =========================================================================
    describe('Activity Logging', () => {
        it('24. MEMBER_ADDED logged upon adding member', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            userRepo.findOne.mockResolvedValue(NEW_USER);
            memberRepo.findOne.mockResolvedValue(null);

            await service.addMember(PROJ_A_ID, { userId: NEW_USER.id, role: ProjectRole.DEVELOPER }, ADMIN_USER.id);

            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                null,
                ADMIN_USER.id,
                ActivityActionType.MEMBER_ADDED,
                null,
                expect.objectContaining({
                    memberUserId: NEW_USER.id,
                    role: ProjectRole.DEVELOPER,
                    projectId: PROJ_A_ID,
                }),
            );
        });

        it('25. MEMBER_ROLE_CHANGED logged upon role update', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue({ ...DEV_MEMBER, user: DEV_USER });

            await service.updateMemberRole(PROJ_A_ID, DEV_MEMBER.id, { role: ProjectRole.VIEWER }, ADMIN_USER.id);

            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                null,
                ADMIN_USER.id,
                ActivityActionType.MEMBER_ROLE_CHANGED,
                expect.objectContaining({
                    memberUserId: DEV_MEMBER.userId,
                    role: ProjectRole.DEVELOPER,
                    projectId: PROJ_A_ID,
                }),
                expect.objectContaining({
                    memberUserId: DEV_MEMBER.userId,
                    role: ProjectRole.VIEWER,
                    projectId: PROJ_A_ID,
                }),
            );
        });

        it('26. MEMBER_REMOVED logged upon member removal', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue({ ...DEV_MEMBER, user: DEV_USER });

            await service.removeMember(PROJ_A_ID, DEV_MEMBER.id, ADMIN_USER.id);

            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                null,
                ADMIN_USER.id,
                ActivityActionType.MEMBER_REMOVED,
                expect.objectContaining({
                    memberUserId: DEV_MEMBER.userId,
                    role: ProjectRole.DEVELOPER,
                    projectId: PROJ_A_ID,
                }),
                null,
            );
        });
    });

    // =========================================================================
    // 6. ISOLATION (Tests 27-28)
    // =========================================================================
    describe('Isolation', () => {
        it('27. project A member cannot access project B membership data', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_B_ID });
            memberRepo.findOne.mockResolvedValue(null); // Not a member of project B

            await expect(service.getProjectMembers(PROJ_B_ID, ADMIN_USER.id)).rejects.toThrow(ForbiddenException);
        });

        it('28. cannot modify membership of another project (scoped by projectId)', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_B_ID });
            memberRepo.findOne.mockResolvedValue(null); // Member does not exist in Project B

            await expect(
                service.updateMemberRole(PROJ_B_ID, DEV_MEMBER.id, { role: ProjectRole.VIEWER }, ADMIN_USER.id),
            ).rejects.toThrow(NotFoundException);

            await expect(
                service.removeMember(PROJ_B_ID, DEV_MEMBER.id, ADMIN_USER.id),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // =========================================================================
    // 7. REGRESSION (Tests 29-32)
    // =========================================================================
    describe('Regression', () => {
        it('29. existing project CRUD methods still work', async () => {
            projectRepo.find.mockResolvedValue([{ project: { id: PROJ_A_ID, name: 'Project Alpha' } }]);
            memberRepo.find.mockResolvedValue([{ project: { id: PROJ_A_ID, name: 'Project Alpha' } }]);

            const userProjects = await service.getUserProjects(ADMIN_USER.id);
            expect(userProjects).toHaveLength(1);

            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID, name: 'Project Alpha', key: 'ALPHA' });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            const single = await service.getProjectById(ADMIN_USER.id, PROJ_A_ID);
            expect(single.name).toBe('Project Alpha');
        });

        it('30. sorting of members respects PROJECT_ADMIN first, DEVELOPER, then VIEWER', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue(ADMIN_MEMBER);
            // Pass out-of-order array: VIEWER, DEVELOPER, ADMIN
            memberRepo.find.mockResolvedValue([VIEWER_MEMBER, DEV_MEMBER, ADMIN_MEMBER]);

            const members = await service.getProjectMembers(PROJ_A_ID, ADMIN_USER.id);
            expect(members[0].role).toBe(ProjectRole.PROJECT_ADMIN);
            expect(members[1].role).toBe(ProjectRole.DEVELOPER);
            expect(members[2].role).toBe(ProjectRole.VIEWER);
        });

        it('31. controller endpoints wire through to service correctly', async () => {
            const addSpy = jest.spyOn(service, 'addMember').mockResolvedValue({
                id: 'mem-new',
                userId: NEW_USER.id,
                email: NEW_USER.email,
                fullName: NEW_USER.fullName,
                role: ProjectRole.DEVELOPER,
                createdAt: new Date(),
            });

            const updateSpy = jest.spyOn(service, 'updateMemberRole').mockResolvedValue({
                id: DEV_MEMBER.id,
                userId: DEV_MEMBER.userId,
                email: DEV_USER.email,
                fullName: DEV_USER.fullName,
                role: ProjectRole.VIEWER,
                createdAt: new Date(),
            });

            const removeSpy = jest.spyOn(service, 'removeMember').mockResolvedValue({
                message: 'Member removed successfully',
            });

            await controller.addMember({ user: { userId: ADMIN_USER.id } }, PROJ_A_ID, {
                userId: NEW_USER.id,
                role: ProjectRole.DEVELOPER,
            });
            expect(addSpy).toHaveBeenCalledWith(PROJ_A_ID, { userId: NEW_USER.id, role: ProjectRole.DEVELOPER }, ADMIN_USER.id);

            await controller.updateMemberRole({ user: { userId: ADMIN_USER.id } }, PROJ_A_ID, DEV_MEMBER.id, {
                role: ProjectRole.VIEWER,
            });
            expect(updateSpy).toHaveBeenCalledWith(PROJ_A_ID, DEV_MEMBER.id, { role: ProjectRole.VIEWER }, ADMIN_USER.id);

            await controller.removeMember({ user: { userId: ADMIN_USER.id } }, PROJ_A_ID, DEV_MEMBER.id);
            expect(removeSpy).toHaveBeenCalledWith(PROJ_A_ID, DEV_MEMBER.id, ADMIN_USER.id);
        });

        it('32. activity recording failures do not break member operations', async () => {
            projectRepo.findOne.mockResolvedValue({ id: PROJ_A_ID });
            memberRepo.findOne.mockResolvedValue({ ...DEV_MEMBER, user: DEV_USER });
            // Mock activity logging error (ActivityLogService catches internally or here)
            jest.spyOn(activityLogService, 'recordActivity').mockRejectedValueOnce(new Error('Activity DB error'));

            // Service method should succeed without throwing
            const res = await service.removeMember(PROJ_A_ID, DEV_MEMBER.id, ADMIN_USER.id);
            expect(res.message).toBe('Member removed successfully');
        });
    });
});
