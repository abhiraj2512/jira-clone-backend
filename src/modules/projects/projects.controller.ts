import { Controller, Get, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectRoleGuard } from '../auth/guards/project-role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProjectRole } from '../project-members/entities/project-member.entity';
import { CreateProjectDto } from './dto/create-project.dto';

@Controller('projects')
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) { }

    @Get()
    @UseGuards(JwtAuthGuard)
    async getUserProjects(@Request() req: any) {
        return this.projectsService.getUserProjects(req.user.userId);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    async createProject(@Request() req: any, @Body() createProjectDto: CreateProjectDto) {
        return this.projectsService.createProject(req.user.userId, createProjectDto);
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    async getProjectById(@Request() req: any, @Param('id') projectId: string) {
        return this.projectsService.getProjectById(req.user.userId, projectId);
    }

    @Get(':projectId/test')
    @UseGuards(JwtAuthGuard, ProjectRoleGuard)
    @Roles(ProjectRole.PROJECT_ADMIN)
    testRoute() {
        return { message: 'Access granted' };
    }
}
