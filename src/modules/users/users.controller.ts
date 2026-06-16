import { Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    getStatus() {
        return this.usersService.getStatus();
    }

    @Post('test')
    async createTestUser() {
        return await this.usersService.createTestUser();
    }

    @Get('profile')
    @UseGuards(JwtAuthGuard)
    getProfile(@Request() req: any) {
        return {
            user: req.user,
        };
    }

    @Get('by-email')
    @UseGuards(JwtAuthGuard)
    async findByEmail(@Query('email') email: string) {
        return this.usersService.findByEmail(email);
    }
}
