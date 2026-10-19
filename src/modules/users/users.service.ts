import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

    getStatus(): object {
        return {
            module: 'users',
            status: 'initialized',
        };
    }

    async createTestUser(): Promise<{ user: User; isNew: boolean }> {
        // Check if test user already exists
        const existingUser = await this.userRepository.findOne({
            where: { email: 'test@example.com' },
        });

        if (existingUser) {
            return {
                user: existingUser,
                isNew: false,
            };
        }

        // Create new test user
        const testUser = this.userRepository.create({
            email: 'test@example.com',
            passwordHash: 'hashedpassword',
            fullName: 'Test User',
            avatarUrl: null,
            isActive: true,
        });

        const savedUser = await this.userRepository.save(testUser);

        return {
            user: savedUser,
            isNew: true,
        };
    }

    async findByEmail(email: string): Promise<{ id: string; email: string; fullName: string }> {
        const user = await this.userRepository.findOne({ where: { email } });
        if (!user) {
            throw new NotFoundException(`No user found with email: ${email}`);
        }
        return { id: user.id, email: user.email, fullName: user.fullName };
    }

    async searchUsers(query?: string): Promise<{ id: string; email: string; fullName: string; avatarUrl: string | null }[]> {
        const qb = this.userRepository.createQueryBuilder('user')
            .select(['user.id', 'user.email', 'user.fullName', 'user.avatarUrl'])
            .where('user.isActive = :isActive', { isActive: true });

        if (query && query.trim()) {
            const searchTerm = `%${query.trim().toLowerCase()}%`;
            qb.andWhere('(LOWER(user.email) LIKE :search OR LOWER(user.fullName) LIKE :search)', { search: searchTerm });
        }

        qb.orderBy('user.fullName', 'ASC')
          .limit(20);

        return qb.getMany();
    }
}
