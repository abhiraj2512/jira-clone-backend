import { IsOptional, IsUUID } from 'class-validator';

export class UpdateIssueSprintDto {
    @IsOptional()
    @IsUUID('4', { message: 'sprintId must be a valid UUID or null' })
    sprintId: string | null;
}
