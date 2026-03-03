import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { Issue } from './entities/issue.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Issue])],
    controllers: [IssuesController],
    providers: [IssuesService],
})
export class IssuesModule { }
