import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { Issue } from '../../issues/entities/issue.entity';

export enum SprintStatus {
    PLANNED = 'PLANNED',
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
}

@Entity('sprints')
export class Sprint {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ type: 'uuid' })
    projectId: string;

    @Column({
        type: 'varchar',
        length: 255,
        nullable: false,
    })
    name: string;

    @Column({
        type: 'text',
        nullable: true,
    })
    goal: string | null;

    @Column({ type: 'date', nullable: true })
    startDate: Date | null;

    @Column({ type: 'date', nullable: true })
    endDate: Date | null;

    @Column({
        type: 'enum',
        enum: SprintStatus,
        default: SprintStatus.PLANNED,
    })
    status: SprintStatus;

    @ManyToOne(() => Project, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'projectId' })
    project: Project;

    @OneToMany(() => Issue, (issue) => issue.sprint)
    issues: Issue[];

    @CreateDateColumn({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date;

    @UpdateDateColumn({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date;
}
