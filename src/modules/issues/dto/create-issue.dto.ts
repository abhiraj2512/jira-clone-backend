import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { IssuePriority } from '../entities/issue.entity';

export class CreateIssueDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(IssuePriority)
    @IsOptional()
    priority?: IssuePriority;

    @IsUUID()
    @IsOptional()
    assigneeId?: string;
}
