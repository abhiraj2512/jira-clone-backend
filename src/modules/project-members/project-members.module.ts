import { Module } from '@nestjs/common';
import { ProjectMembersController } from './project-members.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMember } from './entities/project-member.entity';
import { ProjectMembersService } from './project-members.service';

@Module({
    imports: [TypeOrmModule.forFeature([ProjectMember])],
    controllers: [ProjectMembersController],
    providers: [ProjectMembersService],
})
export class ProjectMembersModule { }
