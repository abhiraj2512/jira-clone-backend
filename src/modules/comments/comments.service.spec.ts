import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';
import { Issue } from '../issues/entities/issue.entity';
import { ProjectMember, ProjectRole } from '../project-members/entities/project-member.entity';
import { User } from '../users/entities/user.entity';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityActionType } from '../activity-log/entities/activity-log.entity';

const mockRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    findByIds: jest.fn(),
    create: jest.fn((dto: any) => ({ ...dto })),
    save: jest.fn((entity: any) => Promise.resolve({ id: entity.id || 'comment-1', createdAt: new Date(), updatedAt: new Date(), ...entity })),
    remove: jest.fn().mockResolvedValue({}),
});

const mockActivityLogService = () => ({
    recordActivity: jest.fn().mockResolvedValue(undefined),
});

describe('CommentsService', () => {
    let service: CommentsService;
    let commentRepo: ReturnType<typeof mockRepo>;
    let issueRepo: ReturnType<typeof mockRepo>;
    let memberRepo: ReturnType<typeof mockRepo>;
    let userRepo: ReturnType<typeof mockRepo>;
    let activityLogService: ReturnType<typeof mockActivityLogService>;

    const mockProjectId = 'proj-1';
    const mockIssueId = 'issue-1';
    const mockCommentId = 'comment-1';
    const adminUserId = 'user-admin';
    const devUserId = 'user-dev';
    const viewerUserId = 'user-viewer';
    const outsiderUserId = 'user-outsider';

    const mockIssue: Partial<Issue> = {
        id: mockIssueId,
        projectId: mockProjectId,
        title: 'Test Issue',
    };

    const mockAuthorUser: Partial<User> = {
        id: devUserId,
        email: 'dev@example.com',
        fullName: 'Dev User',
    };

    beforeEach(async () => {
        commentRepo = mockRepo();
        issueRepo = mockRepo();
        memberRepo = mockRepo();
        userRepo = mockRepo();
        userRepo.findByIds.mockResolvedValue([mockAuthorUser]);
        activityLogService = mockActivityLogService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CommentsService,
                { provide: getRepositoryToken(Comment), useValue: commentRepo },
                { provide: getRepositoryToken(Issue), useValue: issueRepo },
                { provide: getRepositoryToken(ProjectMember), useValue: memberRepo },
                { provide: getRepositoryToken(User), useValue: userRepo },
                { provide: ActivityLogService, useValue: activityLogService },
            ],
        }).compile();

        service = module.get<CommentsService>(CommentsService);
    });

    describe('createComment', () => {
        it('should throw NotFoundException if issue does not exist', async () => {
            issueRepo.findOne!.mockResolvedValue(null);

            await expect(
                service.createComment(devUserId, 'non-existent', { content: 'hello' }),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if user is not a project member (cross-tenant / outsider)', async () => {
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue(null);

            await expect(
                service.createComment(outsiderUserId, mockIssueId, { content: 'hello' }),
            ).rejects.toThrow(new ForbiddenException('You are not a member of this project'));
            expect(commentRepo.save).not.toHaveBeenCalled();
        });

        it('should throw ForbiddenException if user is a VIEWER', async () => {
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue({
                id: 'mem-3',
                userId: viewerUserId,
                projectId: mockProjectId,
                role: ProjectRole.VIEWER,
            } as ProjectMember);

            await expect(
                service.createComment(viewerUserId, mockIssueId, { content: 'hello' }),
            ).rejects.toThrow(new ForbiddenException('Viewers cannot add comments'));
            expect(commentRepo.save).not.toHaveBeenCalled();
        });

        it('should allow DEVELOPER to create a comment and record activity', async () => {
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue({
                id: 'mem-2',
                userId: devUserId,
                projectId: mockProjectId,
                role: ProjectRole.DEVELOPER,
            } as ProjectMember);
            userRepo.findOne!.mockResolvedValue(mockAuthorUser as User);

            const result = await service.createComment(devUserId, mockIssueId, { content: 'My developer comment' });

            expect(result).toBeDefined();
            expect(result.content).toBe('My developer comment');
            expect(commentRepo.save).toHaveBeenCalled();
            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                mockIssueId,
                devUserId,
                ActivityActionType.COMMENT_ADDED,
                null,
                null,
            );
        });

        it('should allow PROJECT_ADMIN to create a comment', async () => {
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue({
                id: 'mem-1',
                userId: adminUserId,
                projectId: mockProjectId,
                role: ProjectRole.PROJECT_ADMIN,
            } as ProjectMember);
            userRepo.findOne!.mockResolvedValue({ id: adminUserId, email: 'admin@example.com', fullName: 'Admin' } as User);

            const result = await service.createComment(adminUserId, mockIssueId, { content: 'Admin comment' });

            expect(result).toBeDefined();
            expect(commentRepo.save).toHaveBeenCalled();
        });
    });

    describe('getIssueComments', () => {
        it('should throw ForbiddenException if user is not a project member', async () => {
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue(null);

            await expect(
                service.getIssueComments(outsiderUserId, mockIssueId),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should allow VIEWER to read comments', async () => {
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue({
                userId: viewerUserId,
                projectId: mockProjectId,
                role: ProjectRole.VIEWER,
            } as ProjectMember);

            commentRepo.find!.mockResolvedValue([
                { id: 'c-1', issueId: mockIssueId, userId: devUserId, content: 'Comment 1', createdAt: new Date(), updatedAt: new Date() } as Comment,
            ]);

            const results = await service.getIssueComments(viewerUserId, mockIssueId);
            expect(results).toHaveLength(1);
            expect(results[0].content).toBe('Comment 1');
        });
    });

    describe('updateComment', () => {
        const mockExistingComment: Partial<Comment> = {
            id: mockCommentId,
            issueId: mockIssueId,
            userId: devUserId,
            content: 'Original content',
        };

        it('should throw NotFoundException if comment does not exist', async () => {
            commentRepo.findOne!.mockResolvedValue(null);

            await expect(
                service.updateComment(devUserId, 'non-existent', { content: 'new content' }),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if user is not a project member (cross-tenant)', async () => {
            commentRepo.findOne!.mockResolvedValue(mockExistingComment as Comment);
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue(null);

            await expect(
                service.updateComment(outsiderUserId, mockCommentId, { content: 'new content' }),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw ForbiddenException if user is not the comment author, even if admin', async () => {
            commentRepo.findOne!.mockResolvedValue(mockExistingComment as Comment);
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue({
                userId: adminUserId,
                projectId: mockProjectId,
                role: ProjectRole.PROJECT_ADMIN,
            } as ProjectMember);

            await expect(
                service.updateComment(adminUserId, mockCommentId, { content: 'admin editing dev comment' }),
            ).rejects.toThrow(new ForbiddenException('You can only edit your own comments'));
            expect(commentRepo.save).not.toHaveBeenCalled();
        });

        it('should throw ForbiddenException if user is VIEWER (even if author)', async () => {
            commentRepo.findOne!.mockResolvedValue({
                ...mockExistingComment,
                userId: viewerUserId,
            } as Comment);
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue({
                userId: viewerUserId,
                projectId: mockProjectId,
                role: ProjectRole.VIEWER,
            } as ProjectMember);

            await expect(
                service.updateComment(viewerUserId, mockCommentId, { content: 'viewer trying to edit' }),
            ).rejects.toThrow(new ForbiddenException('Viewers cannot edit comments'));
            expect(commentRepo.save).not.toHaveBeenCalled();
        });

        it('should allow author (DEVELOPER) to edit their comment and record activity', async () => {
            commentRepo.findOne!.mockResolvedValue({ ...mockExistingComment } as Comment);
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue({
                userId: devUserId,
                projectId: mockProjectId,
                role: ProjectRole.DEVELOPER,
            } as ProjectMember);
            userRepo.findOne!.mockResolvedValue(mockAuthorUser as User);

            const result = await service.updateComment(devUserId, mockCommentId, { content: 'Updated content' });

            expect(result.content).toBe('Updated content');
            expect(commentRepo.save).toHaveBeenCalled();
            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                mockIssueId,
                devUserId,
                ActivityActionType.COMMENT_UPDATED,
                null,
                null,
            );
        });
    });

    describe('deleteComment', () => {
        const mockExistingComment: Partial<Comment> = {
            id: mockCommentId,
            issueId: mockIssueId,
            userId: devUserId,
            content: 'Delete me',
        };

        it('should throw NotFoundException if comment does not exist', async () => {
            commentRepo.findOne!.mockResolvedValue(null);

            await expect(
                service.deleteComment(devUserId, 'non-existent'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if user is not a project member (cross-tenant)', async () => {
            commentRepo.findOne!.mockResolvedValue(mockExistingComment as Comment);
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue(null);

            await expect(
                service.deleteComment(outsiderUserId, mockCommentId),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw ForbiddenException if user is a VIEWER (even if author)', async () => {
            commentRepo.findOne!.mockResolvedValue({
                ...mockExistingComment,
                userId: viewerUserId,
            } as Comment);
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue({
                userId: viewerUserId,
                projectId: mockProjectId,
                role: ProjectRole.VIEWER,
            } as ProjectMember);

            await expect(
                service.deleteComment(viewerUserId, mockCommentId),
            ).rejects.toThrow(new ForbiddenException('Viewers cannot delete comments'));
            expect(commentRepo.remove).not.toHaveBeenCalled();
        });

        it('should throw ForbiddenException if user is another DEVELOPER (not author and not admin)', async () => {
            const anotherDevId = 'user-dev-2';
            commentRepo.findOne!.mockResolvedValue(mockExistingComment as Comment);
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue({
                userId: anotherDevId,
                projectId: mockProjectId,
                role: ProjectRole.DEVELOPER,
            } as ProjectMember);

            await expect(
                service.deleteComment(anotherDevId, mockCommentId),
            ).rejects.toThrow(new ForbiddenException('You do not have permission to delete this comment'));
            expect(commentRepo.remove).not.toHaveBeenCalled();
        });

        it('should allow author (DEVELOPER) to delete their own comment and record activity', async () => {
            commentRepo.findOne!.mockResolvedValue(mockExistingComment as Comment);
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue({
                userId: devUserId,
                projectId: mockProjectId,
                role: ProjectRole.DEVELOPER,
            } as ProjectMember);

            const result = await service.deleteComment(devUserId, mockCommentId);

            expect(result).toEqual({ message: 'Comment deleted successfully' });
            expect(commentRepo.remove).toHaveBeenCalledWith(mockExistingComment);
            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                mockIssueId,
                devUserId,
                ActivityActionType.COMMENT_DELETED,
                null,
                null,
            );
        });

        it('should allow PROJECT_ADMIN to delete other users comments (moderation)', async () => {
            commentRepo.findOne!.mockResolvedValue(mockExistingComment as Comment);
            issueRepo.findOne!.mockResolvedValue(mockIssue as Issue);
            memberRepo.findOne!.mockResolvedValue({
                userId: adminUserId,
                projectId: mockProjectId,
                role: ProjectRole.PROJECT_ADMIN,
            } as ProjectMember);

            const result = await service.deleteComment(adminUserId, mockCommentId);

            expect(result).toEqual({ message: 'Comment deleted successfully' });
            expect(commentRepo.remove).toHaveBeenCalledWith(mockExistingComment);
            expect(activityLogService.recordActivity).toHaveBeenCalledWith(
                mockIssueId,
                adminUserId,
                ActivityActionType.COMMENT_DELETED,
                null,
                null,
            );
        });
    });
});
