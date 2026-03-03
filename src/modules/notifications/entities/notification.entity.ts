import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
    ISSUE_ASSIGNED = 'ISSUE_ASSIGNED',
    ISSUE_UPDATED = 'ISSUE_UPDATED',
    COMMENT_ADDED = 'COMMENT_ADDED',
    SPRINT_STARTED = 'SPRINT_STARTED',
}

@Entity('notifications')
@Index(['userId'])
@Index(['isRead'])
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'enum', enum: NotificationType })
    type: NotificationType;

    @Column({ type: 'uuid', nullable: true })
    referenceId: string;

    @Column({ type: 'boolean', default: false })
    isRead: boolean;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    // Relations

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;
}
