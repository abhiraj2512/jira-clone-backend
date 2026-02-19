import { Module } from '@nestjs/common';
import { BoardsController } from './boards.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Board } from './entities/board.entity';
import { BoardsService } from './boards.service';

@Module({
    imports: [TypeOrmModule.forFeature([Board])],
    controllers: [BoardsController],
    providers: [BoardsService],
})
export class BoardsModule { }
