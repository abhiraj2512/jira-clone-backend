import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateProjectDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(10)
    key: string;

    @IsString()
    @IsOptional()
    description?: string;
}
