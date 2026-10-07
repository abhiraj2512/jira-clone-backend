import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';
import { Sprint } from './entities/sprint.entity';
import { Issue } from '../issues/entities/issue.entity';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Sprint, Issue, ProjectMember, Project]),
        ActivityLogModule,
    ],
    controllers: [SprintsController],
    providers: [SprintsService],
    exports: [SprintsService],
})
export class SprintsModule {}
