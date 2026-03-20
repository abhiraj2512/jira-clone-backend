import { SetMetadata } from '@nestjs/common';
import { ProjectRole } from '../../project-members/entities/project-member.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ProjectRole[]) => SetMetadata(ROLES_KEY, roles);
