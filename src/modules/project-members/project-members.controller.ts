import { Controller, Get } from '@nestjs/common';
import { ProjectMembersService } from './project-members.service';

@Controller('project-members')
export class ProjectMembersController {
    constructor(private readonly projectMembersService: ProjectMembersService) { }

    @Get()
    getStatus() {
        return this.projectMembersService.getStatus();
    }
}
