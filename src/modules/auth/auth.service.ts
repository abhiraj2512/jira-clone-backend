import {
    Injectable,
    ConflictException,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
    ) { }

    async register(dto: RegisterDto): Promise<Omit<User, 'passwordHash'>> {
        const existing = await this.userRepository.findOne({
            where: { email: dto.email },
        });

        if (existing) {
            throw new ConflictException('Email already in use');
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const user = this.userRepository.create({
            email: dto.email,
            passwordHash,
            fullName: dto.fullName,
        });

        const saved = await this.userRepository.save(user);

        // Strip passwordHash before returning
        const { passwordHash: _hash, ...result } = saved;
        return result;
    }

    async validateUser(email: string, password: string): Promise<User | null> {
        const user = await this.userRepository.findOne({ where: { email } });
        if (!user) return null;

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) return null;

        return user;
    }

    async login(dto: LoginDto): Promise<{ accessToken: string }> {
        const user = await this.validateUser(dto.email, dto.password);

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload = { sub: user.id, email: user.email };
        const accessToken = this.jwtService.sign(payload);

        return { accessToken };
    }
}
