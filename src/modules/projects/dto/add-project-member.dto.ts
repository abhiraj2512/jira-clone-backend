import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ProjectRole } from '../../project-members/entities/project-member.entity';

export class AddProjectMemberDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsEnum(ProjectRole)
    @IsNotEmpty()
    role: ProjectRole;
}
