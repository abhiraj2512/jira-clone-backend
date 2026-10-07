import {
    IsString,
    IsNotEmpty,
    MaxLength,
    IsOptional,
    IsDateString,
} from 'class-validator';

export class CreateSprintDto {
    @IsString()
    @IsNotEmpty({ message: 'Sprint name is required' })
    @MaxLength(255, { message: 'Sprint name must not exceed 255 characters' })
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000, { message: 'Goal must not exceed 1000 characters' })
    goal?: string;

    @IsOptional()
    @IsDateString({}, { message: 'startDate must be a valid date string (YYYY-MM-DD)' })
    startDate?: string;

    @IsOptional()
    @IsDateString({}, { message: 'endDate must be a valid date string (YYYY-MM-DD)' })
    endDate?: string;
}
