import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjectMember1771523590072 implements MigrationInterface {
    name = 'CreateProjectMember1771523590072'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."project_members_role_enum" AS ENUM('PROJECT_ADMIN', 'DEVELOPER', 'VIEWER')`);
        await queryRunner.query(`CREATE TABLE "project_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "projectId" uuid NOT NULL, "role" "public"."project_members_role_enum" NOT NULL DEFAULT 'VIEWER', "joinedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_326b2a901eb18ac24eabc9b0581" UNIQUE ("userId", "projectId"), CONSTRAINT "PK_0b2f46f804be4aea9234c78bcc9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "project_members" ADD CONSTRAINT "FK_08d1346ff91abba68e5a637cfdb" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_members" ADD CONSTRAINT "FK_d19892d8f03928e5bfc7313780c" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT "FK_d19892d8f03928e5bfc7313780c"`);
        await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT "FK_08d1346ff91abba68e5a637cfdb"`);
        await queryRunner.query(`DROP TABLE "project_members"`);
        await queryRunner.query(`DROP TYPE "public"."project_members_role_enum"`);
    }

}
