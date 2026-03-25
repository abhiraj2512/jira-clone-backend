import { IsEnum } from 'class-validator';
import { IssueStatus } from '../entities/issue.entity';

export class UpdateIssueStatusDto {
    @IsEnum(IssueStatus)
    status: IssueStatus;
}
