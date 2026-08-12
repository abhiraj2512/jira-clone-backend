import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller()
export class CommentsController {
    constructor(private readonly commentsService: CommentsService) {}

    @Post('issues/:issueId/comments')
    @UseGuards(JwtAuthGuard)
    async createComment(
        @Request() req: any,
        @Param('issueId') issueId: string,
        @Body() dto: CreateCommentDto,
    ) {
        return this.commentsService.createComment(req.user.userId, issueId, dto);
    }

    @Get('issues/:issueId/comments')
    @UseGuards(JwtAuthGuard)
    async getIssueComments(
        @Request() req: any,
        @Param('issueId') issueId: string,
    ) {
        return this.commentsService.getIssueComments(req.user.userId, issueId);
    }

    @Patch('comments/:id')
    @UseGuards(JwtAuthGuard)
    async updateComment(
        @Request() req: any,
        @Param('id') commentId: string,
        @Body() dto: UpdateCommentDto,
    ) {
        return this.commentsService.updateComment(req.user.userId, commentId, dto);
    }

    @Delete('comments/:id')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    async deleteComment(
        @Request() req: any,
        @Param('id') commentId: string,
    ) {
        return this.commentsService.deleteComment(req.user.userId, commentId);
    }
}
