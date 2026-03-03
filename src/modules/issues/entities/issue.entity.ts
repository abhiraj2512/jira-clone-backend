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
import { Board } from '../../boards/entities/board.entity';
import { Sprint } from '../../sprints/entities/sprint.entity';
import { User } from '../../users/entities/user.entity';

export enum IssueType {
    EPIC = 'EPIC',
    STORY = 'STORY',
    TASK = 'TASK',
    BUG = 'BUG',
}

export enum IssueStatus {
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    DONE = 'DONE',
}

export enum IssuePriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

@Entity('issues')
@Index(['projectId'])
@Index(['boardId'])
@Index(['sprintId'])
@Index(['reporterId'])
@Index(['assigneeId'])
@Index(['status'])
export class Issue {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    projectId: string;

    @Column({ type: 'uuid' })
    boardId: string;

    @Column({ type: 'uuid', nullable: true })
    sprintId: string;

    @Column({ type: 'varchar', length: 20, unique: true })
    issueKey: string;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'enum', enum: IssueType })
    issueType: IssueType;

    @Column({ type: 'enum', enum: IssueStatus, default: IssueStatus.TODO })
    status: IssueStatus;

    @Column({ type: 'enum', enum: IssuePriority, default: IssuePriority.MEDIUM })
    priority: IssuePriority;

    @Column({ type: 'uuid' })
    reporterId: string;

    @Column({ type: 'uuid', nullable: true })
    assigneeId: string;

    @Column({ type: 'int', nullable: true })
    storyPoints: number;

    @Column({ type: 'date', nullable: true })
    dueDate: Date;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt: Date;

    // Relations

    @ManyToOne(() => Project, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'projectId' })
    project: Project;

    @ManyToOne(() => Board, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'boardId' })
    board: Board;

    @ManyToOne(() => Sprint, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'sprintId' })
    sprint: Sprint;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'reporterId' })
    reporter: User;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'assigneeId' })
    assignee: User;
}
