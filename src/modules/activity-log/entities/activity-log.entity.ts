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
    ISSUE_CREATED    = 'ISSUE_CREATED',
    ISSUE_UPDATED    = 'ISSUE_UPDATED',
    STATUS_CHANGED   = 'STATUS_CHANGED',
    PRIORITY_CHANGED = 'PRIORITY_CHANGED',
    ASSIGNEE_CHANGED = 'ASSIGNEE_CHANGED',
    COMMENT_ADDED    = 'COMMENT_ADDED',
    COMMENT_UPDATED  = 'COMMENT_UPDATED',
    COMMENT_DELETED  = 'COMMENT_DELETED',
    ISSUE_DELETED    = 'ISSUE_DELETED',
    // Legacy values from initial migration (kept for backward compatibility)
    ASSIGNED         = 'ASSIGNED',
    SPRINT_CHANGED   = 'SPRINT_CHANGED',
}

@Entity('activity_logs')
@Index(['issueId'])
export class ActivityLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: true })
    issueId: string | null;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'enum', enum: ActivityActionType })
    actionType: ActivityActionType;

    @Column({ type: 'jsonb', nullable: true })
    oldValue: Record<string, any> | null;

    @Column({ type: 'jsonb', nullable: true })
    newValue: Record<string, any> | null;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    @ManyToOne(() => Issue, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'issueId' })
    issue: Issue | null;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;
}
