import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectMember, ProjectRole } from '../project-members/entities/project-member.entity';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
    constructor(
        @InjectRepository(Project)
        private readonly projectsRepository: Repository<Project>,
        @InjectRepository(ProjectMember)
        private readonly projectMemberRepository: Repository<ProjectMember>,
    ) { }

    getStatus(): object {
        return {
            module: 'projects',
            status: 'initialized',
        };
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
}
