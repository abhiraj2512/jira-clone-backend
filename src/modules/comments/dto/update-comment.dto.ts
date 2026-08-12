import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCommentDto {
    @IsString()
    @IsNotEmpty({ message: 'Comment content cannot be empty' })
    @MaxLength(2000, { message: 'Comment cannot exceed 2000 characters' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    content: string;
}
