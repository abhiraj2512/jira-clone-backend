import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Issue } from '../../issues/entities/issue.entity';
import { User } from '../../users/entities/user.entity';

export enum ActivityActionType {
    STATUS_CHANGED = 'STATUS_CHANGED',
    ASSIGNED = 'ASSIGNED',
    PRIORITY_CHANGED = 'PRIORITY_CHANGED',
    SPRINT_CHANGED = 'SPRINT_CHANGED',
    ISSUE_CREATED = 'ISSUE_CREATED',
}

@Entity('activity_logs')
@Index(['issueId'])
export class ActivityLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    issueId: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'enum', enum: ActivityActionType })
    actionType: ActivityActionType;

    @Column({ type: 'jsonb', nullable: true })
    oldValue: Record<string, any>;

    @Column({ type: 'jsonb', nullable: true })
    newValue: Record<string, any>;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    // Relations

    @ManyToOne(() => Issue, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'issueId' })
    issue: Issue;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;
}
