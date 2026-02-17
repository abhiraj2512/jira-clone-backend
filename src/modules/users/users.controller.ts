import { Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';

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
}
