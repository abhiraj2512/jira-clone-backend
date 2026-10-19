import { IsEnum, IsNotEmpty } from 'class-validator';
import { ProjectRole } from '../../project-members/entities/project-member.entity';

export class UpdateProjectMemberDto {
    @IsEnum(ProjectRole)
    @IsNotEmpty()
    role: ProjectRole;
}
