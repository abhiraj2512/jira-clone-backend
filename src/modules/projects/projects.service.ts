import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectMember, ProjectRole } from '../project-members/entities/project-member.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
    constructor(
        @InjectRepository(Project)
        private readonly projectsRepository: Repository<Project>,
        @InjectRepository(ProjectMember)
        private readonly projectMemberRepository: Repository<ProjectMember>,
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

    async addMember(projectId: string, dto: AddProjectMemberDto): Promise<ProjectMember> {
        const project = await this.projectsRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new NotFoundException('Project not found');
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

        return await this.projectMemberRepository.save(newMember);
    }

    async getProjectMembers(projectId: string, userId: string): Promise<{ userId: string; email: string; role: string }[]> {
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
                user: {
                    id: true,
                    email: true,
                },
            },
        });

        return members.map(m => ({
            userId: m.userId,
            email: m.user?.email ?? '',
            role: m.role,
        }));
    }
}
