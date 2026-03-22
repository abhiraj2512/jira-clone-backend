import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Request, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectRoleGuard } from '../auth/guards/project-role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProjectRole } from '../project-members/entities/project-member.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';

@Controller('projects')
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) { }

    // ── Authenticated users only ──────────────────────────────────────────────

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

    // ── Project members only ──────────────────────────────────────────────────

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    async getProjectById(@Request() req: any, @Param('id') projectId: string) {
        return this.projectsService.getProjectById(req.user.userId, projectId);
    }

    @Get(':id/members')
    @UseGuards(JwtAuthGuard)
    async getProjectMembers(@Request() req: any, @Param('id') projectId: string) {
        return this.projectsService.getProjectMembers(projectId, req.user.userId);
    }

    // ── PROJECT_ADMIN only ────────────────────────────────────────────────────

    @Patch(':id')
    @UseGuards(JwtAuthGuard, ProjectRoleGuard)
    @Roles(ProjectRole.PROJECT_ADMIN)
    async updateProject(@Param('id') projectId: string, @Body() dto: UpdateProjectDto) {
        return this.projectsService.updateProject(projectId, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard, ProjectRoleGuard)
    @Roles(ProjectRole.PROJECT_ADMIN)
    async deleteProject(@Param('id') projectId: string) {
        return this.projectsService.deleteProject(projectId);
    }

    @Post(':id/members')
    @UseGuards(JwtAuthGuard, ProjectRoleGuard)
    @Roles(ProjectRole.PROJECT_ADMIN)
    async addMember(@Param('id') projectId: string, @Body() dto: AddProjectMemberDto) {
        return this.projectsService.addMember(projectId, dto);
    }

    // ── Test route (can be removed in production) ─────────────────────────────

    @Get(':projectId/test')
    @UseGuards(JwtAuthGuard, ProjectRoleGuard)
    @Roles(ProjectRole.PROJECT_ADMIN)
    testRoute() {
        return { message: 'Access granted' };
    }
}
