import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';

export enum IssueStatus {
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    DONE = 'DONE',
}

export enum IssuePriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
}

export enum IssueType {
    TASK = 'TASK',
    BUG = 'BUG',
    STORY = 'STORY',
    EPIC = 'EPIC',
}

@Entity('issues')
@Index(['projectId'])
@Index(['reporterId'])
@Index(['assigneeId'])
@Index(['status'])
export class Issue {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    projectId: string;

    @Column({ type: 'uuid', nullable: true })
    boardId: string | null;

    @Column({ type: 'uuid', nullable: true })
    sprintId: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    issueKey: string | null;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({
        type: 'enum',
        enum: IssueType,
        default: IssueType.TASK,
        nullable: true,
    })
    issueType: IssueType | null;

    @Column({
        type: 'enum',
        enum: IssueStatus,
        default: IssueStatus.TODO,
    })
    status: IssueStatus;

    @Column({
        type: 'enum',
        enum: IssuePriority,
        default: IssuePriority.MEDIUM,
    })
    priority: IssuePriority;

    @Column({ type: 'uuid' })
    reporterId: string;

    @Column({ type: 'uuid', nullable: true })
    assigneeId: string | null;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt: Date;

    // Relations

    @ManyToOne(() => Project, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'projectId' })
    project: Project;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'reporterId' })
    reporter: User;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'assigneeId' })
    assignee: User | null;
}
