import { Injectable, ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectMember, ProjectRole } from '../project-members/entities/project-member.entity';
import { User } from '../users/entities/user.entity';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityActionType } from '../activity-log/entities/activity-log.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

export interface ProjectMemberResponse {
    id: string;
    userId: string;
    email: string;
    fullName: string;
    role: ProjectRole;
    createdAt: Date;
}

@Injectable()
export class ProjectsService {
    constructor(
        @InjectRepository(Project)
        private readonly projectsRepository: Repository<Project>,
        @InjectRepository(ProjectMember)
        private readonly projectMemberRepository: Repository<ProjectMember>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly activityLogService: ActivityLogService,
    ) { }

    async getUserProjects(userId: string): Promise<Partial<Project>[]> {
        const members = await this.projectMemberRepository.find({
            where: { userId },
            relations: { project: true },
            select: {
                id: true,
                project: {
                    id: true,
                    name: true,
                    key: true,
                    description: true,
                    createdAt: true,
                },
            },
        });
        return members.map(m => m.project);
    }

    async getProjectById(userId: string, projectId: string): Promise<Partial<Project>> {
        const isMember = await this.projectMemberRepository.findOne({
            where: { userId, projectId },
        });

        if (!isMember) {
            throw new ForbiddenException('You are not a member of this project');
        }

        const project = await this.projectsRepository.findOne({
            where: { id: projectId },
            select: ['id', 'name', 'key', 'description', 'createdAt'],
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        return project;
    }

    async createProject(userId: string, dto: CreateProjectDto): Promise<Project> {
        const existingProject = await this.projectsRepository.findOne({ where: { key: dto.key } });
        if (existingProject) {
            throw new ConflictException('Project key already exists');
        }

        const project = this.projectsRepository.create({
            name: dto.name,
            key: dto.key,
            description: dto.description,
            createdById: userId,
        });

        const savedProject = await this.projectsRepository.save(project);

        const member = this.projectMemberRepository.create({
            userId: userId,
            projectId: savedProject.id,
            role: ProjectRole.PROJECT_ADMIN,
        });
        await this.projectMemberRepository.save(member);

        return savedProject;
    }

    async updateProject(projectId: string, dto: UpdateProjectDto): Promise<Partial<Project>> {
        const project = await this.projectsRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new NotFoundException('Project not found');
        }

        if (dto.name) project.name = dto.name;
        if (dto.description !== undefined) project.description = dto.description;

        await this.projectsRepository.save(project);

        return {
            id: project.id,
            name: project.name,
            key: project.key,
            description: project.description,
            createdAt: project.createdAt,
        };
    }

    async deleteProject(projectId: string): Promise<{ message: string }> {
        const project = await this.projectsRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new NotFoundException('Project not found');
        }

        await this.projectsRepository.remove(project);
        return { message: 'Project deleted successfully' };
    }

    async addMember(projectId: string, dto: AddProjectMemberDto, requestingUserId?: string): Promise<ProjectMemberResponse> {
        const project = await this.projectsRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new NotFoundException('Project not found');
        }

        const targetUser = await this.userRepository.findOne({ where: { id: dto.userId } });
        if (!targetUser) {
            throw new NotFoundException('User not found');
        }

        const existingMember = await this.projectMemberRepository.findOne({
            where: { userId: dto.userId, projectId },
        });

        if (existingMember) {
            throw new ConflictException('User already a member');
        }

        const newMember = this.projectMemberRepository.create({
            userId: dto.userId,
            projectId,
            role: dto.role,
        });

        const saved = await this.projectMemberRepository.save(newMember);

        if (requestingUserId) {
            try {
                await this.activityLogService.recordActivity(
                    null,
                    requestingUserId,
                    ActivityActionType.MEMBER_ADDED,
                    null,
                    { memberUserId: dto.userId, role: dto.role, projectId },
                );
            } catch (err) {
                console.error('[ProjectsService] Failed to record activity for addMember:', err);
            }
        }

        return {
            id: saved.id,
            userId: saved.userId,
            email: targetUser.email,
            fullName: targetUser.fullName,
            role: saved.role,
            createdAt: saved.joinedAt,
        };
    }

    async updateMemberRole(
        projectId: string,
        memberIdOrUserId: string,
        dto: UpdateProjectMemberDto,
        requestingUserId?: string,
    ): Promise<ProjectMemberResponse> {
        const project = await this.projectsRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new NotFoundException('Project not found');
        }

        const member = await this.projectMemberRepository.findOne({
            where: [
                { id: memberIdOrUserId, projectId },
                { userId: memberIdOrUserId, projectId },
            ],
            relations: { user: true },
        });

        if (!member) {
            throw new NotFoundException('Project member not found');
        }

        // Safety check: Cannot demote the only Project Admin
        if (member.role === ProjectRole.PROJECT_ADMIN && dto.role !== ProjectRole.PROJECT_ADMIN) {
            const adminCount = await this.projectMemberRepository.count({
                where: { projectId, role: ProjectRole.PROJECT_ADMIN },
            });
            if (adminCount <= 1) {
                throw new BadRequestException(
                    'Cannot change the role of the only Project Admin. A project must have at least one Project Admin.',
                );
            }
        }

        const oldRole = member.role;
        member.role = dto.role;
        const saved = await this.projectMemberRepository.save(member);

        if (requestingUserId) {
            try {
                await this.activityLogService.recordActivity(
                    null,
                    requestingUserId,
                    ActivityActionType.MEMBER_ROLE_CHANGED,
                    { memberUserId: member.userId, role: oldRole, projectId },
                    { memberUserId: member.userId, role: dto.role, projectId },
                );
            } catch (err) {
                console.error('[ProjectsService] Failed to record activity for updateMemberRole:', err);
            }
        }

        return {
            id: saved.id,
            userId: saved.userId,
            email: member.user?.email ?? '',
            fullName: member.user?.fullName ?? '',
            role: saved.role,
            createdAt: saved.joinedAt,
        };
    }

    async removeMember(
        projectId: string,
        memberIdOrUserId: string,
        requestingUserId?: string,
    ): Promise<{ message: string }> {
        const project = await this.projectsRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new NotFoundException('Project not found');
        }

        const member = await this.projectMemberRepository.findOne({
            where: [
                { id: memberIdOrUserId, projectId },
                { userId: memberIdOrUserId, projectId },
            ],
            relations: { user: true },
        });

        if (!member) {
            throw new NotFoundException('Project member not found');
        }

        // Safety check: Cannot remove the only Project Admin
        if (member.role === ProjectRole.PROJECT_ADMIN) {
            const adminCount = await this.projectMemberRepository.count({
                where: { projectId, role: ProjectRole.PROJECT_ADMIN },
            });
            if (adminCount <= 1) {
                throw new BadRequestException(
                    'Cannot remove the only Project Admin. A project must have at least one Project Admin.',
                );
            }
        }

        const removedUserId = member.userId;
        const removedRole = member.role;

        await this.projectMemberRepository.remove(member);

        if (requestingUserId) {
            try {
                await this.activityLogService.recordActivity(
                    null,
                    requestingUserId,
                    ActivityActionType.MEMBER_REMOVED,
                    { memberUserId: removedUserId, role: removedRole, projectId },
                    null,
                );
            } catch (err) {
                console.error('[ProjectsService] Failed to record activity for removeMember:', err);
            }
        }

        return { message: 'Member removed successfully' };
    }

    async getProjectMembers(projectId: string, userId: string): Promise<ProjectMemberResponse[]> {
        const project = await this.projectsRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new NotFoundException('Project not found');
        }

        const isMember = await this.projectMemberRepository.findOne({
            where: { userId, projectId },
        });

        if (!isMember) {
            throw new ForbiddenException('You are not a member of this project');
        }

        const members = await this.projectMemberRepository.find({
            where: { projectId },
            relations: { user: true },
            select: {
                id: true,
                role: true,
                userId: true,
                joinedAt: true,
                user: {
                    id: true,
                    email: true,
                    fullName: true,
                },
            },
        });

        // Consistent sorting: PROJECT_ADMIN first, then DEVELOPER, then VIEWER.
        const rolePriority: Record<string, number> = {
            [ProjectRole.PROJECT_ADMIN]: 1,
            [ProjectRole.DEVELOPER]: 2,
            [ProjectRole.VIEWER]: 3,
        };

        members.sort((a, b) => {
            const pA = rolePriority[a.role] ?? 99;
            const pB = rolePriority[b.role] ?? 99;
            if (pA !== pB) return pA - pB;
            const nameA = a.user?.fullName || a.user?.email || '';
            const nameB = b.user?.fullName || b.user?.email || '';
            return nameA.localeCompare(nameB);
        });

        return members.map(m => ({
            id: m.id,
            userId: m.userId,
            email: m.user?.email ?? '',
            fullName: m.user?.fullName ?? '',
            role: m.role,
            createdAt: m.joinedAt,
        }));
    }
}
