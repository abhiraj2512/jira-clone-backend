import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMember, ProjectRole } from '../../project-members/entities/project-member.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class ProjectRoleGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        @InjectRepository(ProjectMember)
        private projectMemberRepository: Repository<ProjectMember>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || !user.userId) {
            throw new ForbiddenException('User not authenticated');
        }

        const projectId = request.params?.projectId || request.body?.projectId;

        if (!projectId) {
            throw new ForbiddenException('Project ID is required');
        }

        const projectMember = await this.projectMemberRepository.findOne({
            where: {
                userId: user.userId,
                projectId: projectId,
            },
        });

        if (!projectMember) {
            throw new ForbiddenException('You are not a member of this project');
        }

        if (!requiredRoles.includes(projectMember.role)) {
            throw new ForbiddenException('You do not have the required role for this project');
        }

        return true;
    }
}
