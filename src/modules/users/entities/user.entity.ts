import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'varchar',
        length: 255,
        unique: true,
        nullable: false,
    })
    email: string;

    @Column({
        type: 'varchar',
        length: 255,
        nullable: false,
    })
    passwordHash: string;

    @Column({
        type: 'varchar',
        length: 255,
        nullable: false,
    })
    fullName: string;

    @Column({
        type: 'varchar',
        length: 500,
        nullable: true,
    })
    avatarUrl: string | null;

    @Column({
        type: 'boolean',
        default: true,
        nullable: false,
    })
    isActive: boolean;

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
