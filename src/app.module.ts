import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProjectMembersModule } from './modules/project-members/project-members.module';
import { BoardsModule } from './modules/boards/boards.module';
import { IssuesModule } from './modules/issues/issues.module';
import { SprintsModule } from './modules/sprints/sprints.module';
import { CommentsModule } from './modules/comments/comments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    // Global configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // TypeORM configuration
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME || 'jira_clone_db',
      autoLoadEntities: true,
      synchronize: false,
    }),

    // Feature modules
    HealthModule,

    // Domain modules
    UsersModule,
    ProjectsModule,
    ProjectMembersModule,
    BoardsModule,
    IssuesModule,
    SprintsModule,
    CommentsModule,
    NotificationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
