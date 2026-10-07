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
    ValidationPipe,
    UsePipes,
} from '@nestjs/common';
import { SprintsService } from './sprints.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';

@Controller()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class SprintsController {
    constructor(private readonly sprintsService: SprintsService) {}

    // POST /projects/:projectId/sprints — Create sprint (ADMIN only)
    @Post('projects/:projectId/sprints')
    @HttpCode(HttpStatus.CREATED)
    async createSprint(
        @Request() req: any,
        @Param('projectId') projectId: string,
        @Body() dto: CreateSprintDto,
    ) {
        return this.sprintsService.createSprint(req.user.userId, projectId, dto);
    }

    // GET /projects/:projectId/sprints — List all sprints for a project
    @Get('projects/:projectId/sprints')
    async listSprints(
        @Request() req: any,
        @Param('projectId') projectId: string,
    ) {
        return this.sprintsService.listSprints(req.user.userId, projectId);
    }

    // GET /projects/:projectId/sprints/backlog — Backlog issues (no sprint)
    @Get('projects/:projectId/sprints/backlog')
    async getBacklog(
        @Request() req: any,
        @Param('projectId') projectId: string,
    ) {
        return this.sprintsService.getBacklogIssues(req.user.userId, projectId);
    }

    // GET /sprints/:id — Get a single sprint
    @Get('sprints/:id')
    async getSprintById(
        @Request() req: any,
        @Param('id') sprintId: string,
    ) {
        return this.sprintsService.getSprintById(req.user.userId, sprintId);
    }

    // PATCH /sprints/:id — Update sprint (ADMIN only)
    @Patch('sprints/:id')
    async updateSprint(
        @Request() req: any,
        @Param('id') sprintId: string,
        @Body() dto: UpdateSprintDto,
    ) {
        return this.sprintsService.updateSprint(req.user.userId, sprintId, dto);
    }

    // POST /sprints/:id/start — Start sprint (ADMIN only)
    @Post('sprints/:id/start')
    @HttpCode(HttpStatus.OK)
    async startSprint(
        @Request() req: any,
        @Param('id') sprintId: string,
    ) {
        return this.sprintsService.startSprint(req.user.userId, sprintId);
    }

    // POST /sprints/:id/complete — Complete sprint (ADMIN only)
    @Post('sprints/:id/complete')
    @HttpCode(HttpStatus.OK)
    async completeSprint(
        @Request() req: any,
        @Param('id') sprintId: string,
    ) {
        return this.sprintsService.completeSprint(req.user.userId, sprintId);
    }

    // DELETE /sprints/:id — Delete PLANNED sprint (ADMIN only)
    @Delete('sprints/:id')
    @HttpCode(HttpStatus.OK)
    async deleteSprint(
        @Request() req: any,
        @Param('id') sprintId: string,
    ) {
        return this.sprintsService.deleteSprint(req.user.userId, sprintId);
    }
}
