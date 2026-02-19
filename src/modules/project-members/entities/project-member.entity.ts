import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';

export enum ProjectRole {
    PROJECT_ADMIN = 'PROJECT_ADMIN',
    DEVELOPER = 'DEVELOPER',
    VIEWER = 'VIEWER',
}

@Entity('project_members')
@Unique(['userId', 'projectId'])
export class ProjectMember {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid' })
    projectId: string;

    @Column({
        type: 'enum',
        enum: ProjectRole,
        default: ProjectRole.VIEWER,
    })
    role: ProjectRole;

    @CreateDateColumn({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP',
    })
    joinedAt: Date;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Project, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'projectId' })
    project: Project;
}
