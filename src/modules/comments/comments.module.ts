import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';
import { Issue } from '../issues/entities/issue.entity';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { User } from '../users/entities/user.entity';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Comment, Issue, ProjectMember, User]),
        ActivityLogModule,
    ],
    controllers: [CommentsController],
    providers: [CommentsService],
})
export class CommentsModule {}
