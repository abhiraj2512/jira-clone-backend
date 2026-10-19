import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { Project } from './entities/project.entity';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { AuthModule } from '../auth/auth.module';

import { User } from '../users/entities/user.entity';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Project, ProjectMember, User]),
        AuthModule,
        ActivityLogModule,
    ],
    controllers: [ProjectsController],
    providers: [ProjectsService],
})
export class ProjectsModule { }
