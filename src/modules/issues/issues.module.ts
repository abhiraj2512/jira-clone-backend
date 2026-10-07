import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { Issue } from './entities/issue.entity';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { Sprint } from '../sprints/entities/sprint.entity';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Issue, ProjectMember, Project, Sprint]),
        ActivityLogModule,
    ],
    controllers: [IssuesController],
    providers: [IssuesService],
})
export class IssuesModule {}
