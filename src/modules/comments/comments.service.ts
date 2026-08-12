import {
    Injectable,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Issue } from '../issues/entities/issue.entity';
import { ProjectMember, ProjectRole } from '../project-members/entities/project-member.entity';
import { User } from '../users/entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityActionType } from '../activity-log/entities/activity-log.entity';

export interface CommentWithAuthor {
    id: string;
    issueId: string;
    userId: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    author: {
        email: string;
        fullName: string;
    };
}

@Injectable()
export class CommentsService {
    constructor(
        @InjectRepository(Comment)
        private readonly commentRepo: Repository<Comment>,
        @InjectRepository(Issue)
        private readonly issueRepo: Repository<Issue>,
        @InjectRepository(ProjectMember)
        private readonly memberRepo: Repository<ProjectMember>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly activityLogService: ActivityLogService,
    ) {}

    private async requireMembership(userId: string, projectId: string): Promise<ProjectMember> {
        const member = await this.memberRepo.findOne({ where: { userId, projectId } });
        if (!member) throw new ForbiddenException('You are not a member of this project');
        return member;
    }

    private async requireIssue(issueId: string): Promise<Issue> {
        const issue = await this.issueRepo.findOne({ where: { id: issueId } });
        if (!issue) throw new NotFoundException('Issue not found');
        return issue;
    }

    async createComment(userId: string, issueId: string, dto: CreateCommentDto): Promise<CommentWithAuthor> {
        const issue = await this.requireIssue(issueId);
        const member = await this.requireMembership(userId, issue.projectId);

        // VIEWER cannot create comments
        if (member.role === ProjectRole.VIEWER) {
            throw new ForbiddenException('Viewers cannot add comments');
        }

        const comment = this.commentRepo.create({
            issueId,
            userId,
            content: dto.content,
        });
        const saved = await this.commentRepo.save(comment);

        // Record activity (non-blocking)
        await this.activityLogService.recordActivity(
            issueId,
            userId,
            ActivityActionType.COMMENT_ADDED,
            null,
            null,
        );

        const author = await this.userRepo.findOne({ where: { id: userId } });
        return this.toCommentWithAuthor(saved, author);
    }

    async getIssueComments(userId: string, issueId: string): Promise<CommentWithAuthor[]> {
        const issue = await this.requireIssue(issueId);
        await this.requireMembership(userId, issue.projectId);

        const comments = await this.commentRepo.find({
            where: { issueId },
            order: { createdAt: 'ASC' },
        });

        const authorIds = [...new Set(comments.map((c) => c.userId))];
        const authors = await this.userRepo.findByIds(authorIds);
        const authorMap = new Map(authors.map((u) => [u.id, u]));

        return comments.map((c) => this.toCommentWithAuthor(c, authorMap.get(c.userId)));
    }

    async updateComment(userId: string, commentId: string, dto: UpdateCommentDto): Promise<CommentWithAuthor> {
        const comment = await this.commentRepo.findOne({ where: { id: commentId } });
        if (!comment) throw new NotFoundException('Comment not found');

        const issue = await this.requireIssue(comment.issueId);
        const member = await this.requireMembership(userId, issue.projectId);

        // Only the comment author can edit their own comment
        // PROJECT_ADMIN can moderate (delete) but NOT edit other users' comments
        if (comment.userId !== userId) {
            throw new ForbiddenException('You can only edit your own comments');
        }

        // VIEWER cannot edit (should not have comments, but belt-and-suspenders)
        if (member.role === ProjectRole.VIEWER) {
            throw new ForbiddenException('Viewers cannot edit comments');
        }

        comment.content = dto.content;
        const updated = await this.commentRepo.save(comment);

        await this.activityLogService.recordActivity(
            comment.issueId,
            userId,
            ActivityActionType.COMMENT_UPDATED,
            null,
            null,
        );

        const author = await this.userRepo.findOne({ where: { id: comment.userId } });
        return this.toCommentWithAuthor(updated, author);
    }

    async deleteComment(userId: string, commentId: string): Promise<{ message: string }> {
        const comment = await this.commentRepo.findOne({ where: { id: commentId } });
        if (!comment) throw new NotFoundException('Comment not found');

        const issue = await this.requireIssue(comment.issueId);
        const member = await this.requireMembership(userId, issue.projectId);

        // Allowed: comment author, or PROJECT_ADMIN (moderation)
        const isAuthor = comment.userId === userId;
        const isAdmin = member.role === ProjectRole.PROJECT_ADMIN;

        if (!isAuthor && !isAdmin) {
            throw new ForbiddenException('You do not have permission to delete this comment');
        }

        const issueIdForActivity = comment.issueId;
        await this.commentRepo.remove(comment);

        await this.activityLogService.recordActivity(
            issueIdForActivity,
            userId,
            ActivityActionType.COMMENT_DELETED,
            null,
            null,
        );

        return { message: 'Comment deleted successfully' };
    }

    private toCommentWithAuthor(comment: Comment, author?: User | null): CommentWithAuthor {
        return {
            id: comment.id,
            issueId: comment.issueId,
            userId: comment.userId,
            content: comment.content,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            author: {
                email: author?.email ?? 'unknown',
                fullName: author?.fullName ?? 'Unknown User',
            },
        };
    }
}
