import { Controller, Get, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectRoleGuard } from '../auth/guards/project-role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProjectRole } from '../project-members/entities/project-member.entity';

@Controller('projects')
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) { }

    @Get()
    getStatus() {
        return this.projectsService.getStatus();
    }

    @Get(':projectId/test')
    @UseGuards(JwtAuthGuard, ProjectRoleGuard)
    @Roles(ProjectRole.PROJECT_ADMIN)
    testRoute() {
        return { message: 'Access granted' };
    }
}
