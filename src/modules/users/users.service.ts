import { Injectable } from '@nestjs/common';
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
}
